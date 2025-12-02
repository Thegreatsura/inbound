import { Elysia, t } from "elysia"
import { validateAndRateLimit } from "../lib/auth"
import { db } from "@/lib/db"
import {
  endpoints,
  emailGroups,
  endpointDeliveries,
  emailAddresses,
  emailDomains,
} from "@/lib/db/schema"
import { eq, and, desc, count } from "drizzle-orm"

// Request/Response Types (OpenAPI-compatible)
const EndpointParamsSchema = t.Object({
  id: t.String(),
})

const DeliveryStatsSchema = t.Object({
  total: t.Number(),
  successful: t.Number(),
  failed: t.Number(),
  lastDelivery: t.Nullable(t.String()),
})

const DeliveryItemSchema = t.Object({
  id: t.String(),
  emailId: t.Nullable(t.String()),
  deliveryType: t.String(),
  status: t.String(),
  attempts: t.Number(),
  lastAttemptAt: t.Nullable(t.String()),
  responseData: t.Any(),
  createdAt: t.Nullable(t.String()),
})

const AssociatedEmailSchema = t.Object({
  id: t.String(),
  address: t.String(),
  isActive: t.Boolean(),
  createdAt: t.Nullable(t.String()),
})

const CatchAllDomainSchema = t.Object({
  id: t.String(),
  domain: t.String(),
  status: t.String(),
})

const EndpointDetailResponse = t.Object({
  id: t.String(),
  name: t.String(),
  type: t.Union([
    t.Literal("webhook"),
    t.Literal("email"),
    t.Literal("email_group"),
  ]),
  config: t.Any(),
  isActive: t.Boolean(),
  description: t.Nullable(t.String()),
  userId: t.String(),
  createdAt: t.Nullable(t.String()),
  updatedAt: t.Nullable(t.String()),
  groupEmails: t.Nullable(t.Array(t.String())),
  deliveryStats: DeliveryStatsSchema,
  recentDeliveries: t.Array(DeliveryItemSchema),
  associatedEmails: t.Array(AssociatedEmailSchema),
  catchAllDomains: t.Array(CatchAllDomainSchema),
})

const ErrorResponse = t.Object({
  error: t.String(),
  message: t.String(),
  statusCode: t.Number(),
})

const NotFoundResponse = t.Object({
  error: t.String(),
})

export const getEndpoint = new Elysia().get(
  "/endpoints/:id",
  async ({ request, params, set }) => {
    const { id } = params
    console.log(
      "🔍 GET /api/e2/endpoints/:id - Starting request for endpoint:",
      id
    )

    // Auth & rate limit validation - throws on error
    const userId = await validateAndRateLimit(request, set)
    console.log("✅ Authentication successful for userId:", userId)

    // Get endpoint with user verification
    console.log("🔍 Querying endpoint from database")
    const endpointResult = await db
      .select()
      .from(endpoints)
      .where(and(eq(endpoints.id, id), eq(endpoints.userId, userId)))
      .limit(1)

    if (!endpointResult[0]) {
      console.log("❌ Endpoint not found for user:", userId, "endpoint:", id)
      set.status = 404
      return { error: "Endpoint not found" }
    }

    const endpoint = endpointResult[0]
    console.log("✅ Found endpoint:", endpoint.name, "type:", endpoint.type)

    // Get group emails if it's an email_group endpoint
    let groupEmails: string[] | null = null
    if (endpoint.type === "email_group") {
      console.log("📧 Fetching group emails for email_group endpoint")
      const groupEmailsResult = await db
        .select({ emailAddress: emailGroups.emailAddress })
        .from(emailGroups)
        .where(eq(emailGroups.endpointId, endpoint.id))
        .orderBy(emailGroups.createdAt)

      groupEmails = groupEmailsResult.map((g) => g.emailAddress)
      console.log("📧 Found", groupEmails.length, "group emails")
    }

    // Get delivery statistics
    console.log("📊 Fetching delivery statistics")
    const deliveryStatsResult = await db
      .select({
        total: count(),
        status: endpointDeliveries.status,
      })
      .from(endpointDeliveries)
      .where(eq(endpointDeliveries.endpointId, endpoint.id))
      .groupBy(endpointDeliveries.status)

    let totalDeliveries = 0
    let successfulDeliveries = 0
    let failedDeliveries = 0

    for (const stat of deliveryStatsResult) {
      totalDeliveries += stat.total
      if (stat.status === "success") successfulDeliveries += stat.total
      if (stat.status === "failed") failedDeliveries += stat.total
    }

    console.log(
      "📊 Delivery stats - Total:",
      totalDeliveries,
      "Success:",
      successfulDeliveries,
      "Failed:",
      failedDeliveries
    )

    // Get recent deliveries
    console.log("📋 Fetching recent deliveries")
    const recentDeliveries = await db
      .select({
        id: endpointDeliveries.id,
        emailId: endpointDeliveries.emailId,
        deliveryType: endpointDeliveries.deliveryType,
        status: endpointDeliveries.status,
        attempts: endpointDeliveries.attempts,
        lastAttemptAt: endpointDeliveries.lastAttemptAt,
        responseData: endpointDeliveries.responseData,
        createdAt: endpointDeliveries.createdAt,
      })
      .from(endpointDeliveries)
      .where(eq(endpointDeliveries.endpointId, endpoint.id))
      .orderBy(desc(endpointDeliveries.createdAt))
      .limit(10)

    console.log("📋 Found", recentDeliveries.length, "recent deliveries")

    // Get associated email addresses
    console.log("📮 Fetching associated email addresses")
    const associatedEmails = await db
      .select({
        id: emailAddresses.id,
        address: emailAddresses.address,
        isActive: emailAddresses.isActive,
        createdAt: emailAddresses.createdAt,
      })
      .from(emailAddresses)
      .where(eq(emailAddresses.endpointId, endpoint.id))
      .orderBy(emailAddresses.createdAt)

    console.log("📮 Found", associatedEmails.length, "associated email addresses")

    // Get catch-all domains using this endpoint
    console.log("🌐 Fetching catch-all domains")
    const catchAllDomains = await db
      .select({
        id: emailDomains.id,
        domain: emailDomains.domain,
        status: emailDomains.status,
      })
      .from(emailDomains)
      .where(eq(emailDomains.catchAllEndpointId, endpoint.id))

    console.log("🌐 Found", catchAllDomains.length, "catch-all domains")

    // Get the most recent delivery date
    const lastDeliveryResult = await db
      .select({ lastDelivery: endpointDeliveries.lastAttemptAt })
      .from(endpointDeliveries)
      .where(eq(endpointDeliveries.endpointId, endpoint.id))
      .orderBy(desc(endpointDeliveries.lastAttemptAt))
      .limit(1)

    const lastDeliveryDate = lastDeliveryResult[0]?.lastDelivery || null

    const response = {
      id: endpoint.id,
      name: endpoint.name,
      type: endpoint.type as "webhook" | "email" | "email_group",
      config: JSON.parse(endpoint.config),
      isActive: endpoint.isActive || false,
      description: endpoint.description,
      userId: endpoint.userId,
      createdAt: endpoint.createdAt
        ? new Date(endpoint.createdAt).toISOString()
        : null,
      updatedAt: endpoint.updatedAt
        ? new Date(endpoint.updatedAt).toISOString()
        : null,
      groupEmails,
      deliveryStats: {
        total: totalDeliveries,
        successful: successfulDeliveries,
        failed: failedDeliveries,
        lastDelivery: lastDeliveryDate
          ? new Date(lastDeliveryDate).toISOString()
          : null,
      },
      recentDeliveries: recentDeliveries.map((d) => ({
        id: d.id,
        emailId: d.emailId,
        deliveryType: d.deliveryType,
        status: d.status,
        attempts: d.attempts || 0,
        lastAttemptAt: d.lastAttemptAt
          ? new Date(d.lastAttemptAt).toISOString()
          : null,
        responseData: d.responseData ? JSON.parse(d.responseData) : null,
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
      })),
      associatedEmails: associatedEmails.map((e) => ({
        id: e.id,
        address: e.address,
        isActive: e.isActive || false,
        createdAt: e.createdAt ? new Date(e.createdAt).toISOString() : null,
      })),
      catchAllDomains,
    }

    console.log(
      "✅ GET /api/e2/endpoints/:id - Successfully returning endpoint data"
    )
    return response
  },
  {
    params: EndpointParamsSchema,
    response: {
      200: EndpointDetailResponse,
      401: ErrorResponse,
      404: NotFoundResponse,
      500: ErrorResponse,
    },
    detail: {
      tags: ["Endpoints"],
      summary: "Get endpoint details",
      description:
        "Get detailed information about a specific endpoint including delivery stats, recent deliveries, associated emails, and catch-all domains",
    },
  }
)
