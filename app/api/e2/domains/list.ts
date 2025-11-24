import { Elysia, t } from "elysia"
import { validateAndRateLimit } from "../lib/auth"
import { db } from "@/lib/db"
import { emailDomains, emailAddresses, endpoints } from "@/lib/db/schema"
import { eq, and, desc, count } from "drizzle-orm"

// Request/Response Types (OpenAPI-compatible)
const ListDomainsQuery = t.Object({
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 50 })),
  offset: t.Optional(t.Number({ minimum: 0, default: 0 })),
  status: t.Optional(
    t.Union([
      t.Literal("pending"),
      t.Literal("verified"),
      t.Literal("failed"),
    ])
  ),
  canReceive: t.Optional(t.Union([t.Literal("true"), t.Literal("false")])),
})

const DomainStatsSchema = t.Object({
  totalEmailAddresses: t.Number(),
  activeEmailAddresses: t.Number(),
  hasCatchAll: t.Boolean(),
})

const CatchAllEndpointSchema = t.Optional(
  t.Object({
    id: t.String(),
    name: t.String(),
    type: t.String(),
    isActive: t.Boolean(),
  })
)

const DomainSchema = t.Object({
  id: t.String(),
  domain: t.String(),
  status: t.String(),
  canReceiveEmails: t.Boolean(),
  hasMxRecords: t.Boolean(),
  domainProvider: t.Nullable(t.String()),
  providerConfidence: t.Nullable(t.String()),
  lastDnsCheck: t.Nullable(t.Date()),
  lastSesCheck: t.Nullable(t.Date()),
  isCatchAllEnabled: t.Boolean(),
  catchAllEndpointId: t.Nullable(t.String()),
  mailFromDomain: t.Nullable(t.String()),
  mailFromDomainStatus: t.Nullable(t.String()),
  mailFromDomainVerifiedAt: t.Nullable(t.Date()),
  receiveDmarcEmails: t.Boolean(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  userId: t.String(),
  stats: DomainStatsSchema,
  catchAllEndpoint: CatchAllEndpointSchema,
})

const PaginationSchema = t.Object({
  limit: t.Number(),
  offset: t.Number(),
  total: t.Number(),
  hasMore: t.Boolean(),
})

const ListDomainsResponse = t.Object({
  data: t.Array(DomainSchema),
  pagination: PaginationSchema,
})

export const listDomains = new Elysia().get(
  "/domains",
  async ({ request, query, set }) => {
    console.log("🌐 GET /api/e2/domains - Starting request")

    // Auth & rate limit validation - throws on error
    const userId = await validateAndRateLimit(request, set)
    console.log("✅ Authentication successful for userId:", userId)

    // Extract and validate query parameters
    const limit = Math.min(query.limit || 50, 100)
    const offset = query.offset || 0
    const status = query.status
    const canReceive = query.canReceive

    console.log("📊 Query parameters:", {
      limit,
      offset,
      status,
      canReceive,
    })

    // Build where conditions
    const conditions = [eq(emailDomains.userId, userId)]

    if (status && ["pending", "verified", "failed"].includes(status)) {
      conditions.push(eq(emailDomains.status, status))
      console.log("🔍 Filtering by status:", status)
    }

    if (canReceive !== undefined) {
      const canReceiveEmails = canReceive === "true"
      conditions.push(eq(emailDomains.canReceiveEmails, canReceiveEmails))
      console.log("🔍 Filtering by canReceive:", canReceiveEmails)
    }

    const whereConditions =
      conditions.length > 1 ? and(...conditions) : conditions[0]

    // Get domains
    console.log("🔍 Querying domains from database")
    const domains = await db
      .select({
        id: emailDomains.id,
        domain: emailDomains.domain,
        status: emailDomains.status,
        canReceiveEmails: emailDomains.canReceiveEmails,
        hasMxRecords: emailDomains.hasMxRecords,
        domainProvider: emailDomains.domainProvider,
        providerConfidence: emailDomains.providerConfidence,
        lastDnsCheck: emailDomains.lastDnsCheck,
        lastSesCheck: emailDomains.lastSesCheck,
        isCatchAllEnabled: emailDomains.isCatchAllEnabled,
        catchAllEndpointId: emailDomains.catchAllEndpointId,
        mailFromDomain: emailDomains.mailFromDomain,
        mailFromDomainStatus: emailDomains.mailFromDomainStatus,
        mailFromDomainVerifiedAt: emailDomains.mailFromDomainVerifiedAt,
        receiveDmarcEmails: emailDomains.receiveDmarcEmails,
        createdAt: emailDomains.createdAt,
        updatedAt: emailDomains.updatedAt,
        userId: emailDomains.userId,
      })
      .from(emailDomains)
      .where(whereConditions)
      .orderBy(desc(emailDomains.createdAt))
      .limit(limit)
      .offset(offset)

    // Get total count for pagination
    const totalCountResult = await db
      .select({ count: count() })
      .from(emailDomains)
      .where(whereConditions)

    const totalCount = totalCountResult[0]?.count || 0

    console.log(
      "📊 Found",
      domains.length,
      "domains out of",
      totalCount,
      "total"
    )

    // Enhance domains with stats and catch-all endpoint info
    const enhancedDomains = await Promise.all(
      domains.map(async (domain) => {
        // Get email address count
        const emailCountResult = await db
          .select({ count: count() })
          .from(emailAddresses)
          .where(eq(emailAddresses.domainId, domain.id))

        const emailCount = emailCountResult[0]?.count || 0

        // Get active email address count
        const activeEmailCountResult = await db
          .select({ count: count() })
          .from(emailAddresses)
          .where(
            and(
              eq(emailAddresses.domainId, domain.id),
              eq(emailAddresses.isActive, true)
            )
          )

        const activeEmailCount = activeEmailCountResult[0]?.count || 0

        // Get catch-all endpoint info if configured
        let catchAllEndpoint: { id: string; name: string; type: string; isActive: boolean } | undefined = undefined
        if (domain.catchAllEndpointId) {
          const endpointResult = await db
            .select({
              id: endpoints.id,
              name: endpoints.name,
              type: endpoints.type,
              isActive: endpoints.isActive,
            })
            .from(endpoints)
            .where(eq(endpoints.id, domain.catchAllEndpointId))
            .limit(1)

          catchAllEndpoint = endpointResult[0]
            ? {
                id: endpointResult[0].id,
                name: endpointResult[0].name,
                type: endpointResult[0].type,
                isActive: endpointResult[0].isActive || false,
              }
            : undefined
        }

        return {
          ...domain,
          canReceiveEmails: domain.canReceiveEmails || false,
          hasMxRecords: domain.hasMxRecords || false,
          isCatchAllEnabled: domain.isCatchAllEnabled || false,
          receiveDmarcEmails: domain.receiveDmarcEmails || false,
          createdAt: domain.createdAt || new Date(),
          updatedAt: domain.updatedAt || new Date(),
          stats: {
            totalEmailAddresses: emailCount,
            activeEmailAddresses: activeEmailCount,
            hasCatchAll: !!domain.catchAllEndpointId,
          },
          catchAllEndpoint,
        }
      })
    )

    const response = {
      data: enhancedDomains,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + domains.length < totalCount,
      },
    }

    console.log("✅ Successfully retrieved domains")
    return response
  },
  {
    query: ListDomainsQuery,
    response: ListDomainsResponse,
    detail: {
      tags: ["Domains"],
      summary: "List all domains",
      description:
        "Get paginated list of domains for authenticated user with optional filtering",
    },
  }
)
