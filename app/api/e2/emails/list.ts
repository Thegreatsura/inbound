import { Elysia, t } from "elysia"
import { validateAndRateLimit } from "../lib/auth"
import { db } from "@/lib/db"
import {
  sentEmails,
  structuredEmails,
  scheduledEmails,
  emailDomains,
  emailAddresses,
} from "@/lib/db/schema"
import { eq, and, desc, sql, or, like } from "drizzle-orm"

// Query parameters schema
const ListEmailsQuerySchema = t.Object({
  type: t.Optional(
    t.Union([
      t.Literal("all"),
      t.Literal("sent"),
      t.Literal("received"),
      t.Literal("scheduled"),
    ])
  ),
  status: t.Optional(
    t.Union([
      t.Literal("delivered"),
      t.Literal("pending"),
      t.Literal("failed"),
      t.Literal("bounced"),
      t.Literal("scheduled"),
      t.Literal("cancelled"),
    ])
  ),
  limit: t.Optional(t.String()),
  offset: t.Optional(t.String()),
  domain: t.Optional(t.String()),
  address: t.Optional(t.String()),
})

// Email item schema
const EmailItemSchema = t.Object({
  id: t.String(),
  type: t.Union([
    t.Literal("sent"),
    t.Literal("received"),
    t.Literal("scheduled"),
  ]),
  from: t.String(),
  to: t.Array(t.String()),
  subject: t.String(),
  status: t.String(),
  created_at: t.String(),
  sent_at: t.Optional(t.Nullable(t.String())),
  scheduled_at: t.Optional(t.Nullable(t.String())),
  has_attachments: t.Boolean(),
  is_read: t.Optional(t.Boolean()),
})

// Response schemas
const ListEmailsResponse = t.Object({
  data: t.Array(EmailItemSchema),
  pagination: t.Object({
    limit: t.Number(),
    offset: t.Number(),
    total: t.Number(),
    has_more: t.Boolean(),
  }),
})

const ListEmailsErrorResponse = t.Object({
  error: t.String(),
})

// Helper to parse JSON fields safely
function parseJsonField<T>(field: string | null, fallback: T): T {
  if (!field) return fallback
  try {
    return JSON.parse(field)
  } catch {
    return fallback
  }
}

function parseFromData(field: string | null): string {
  if (!field) return "unknown"
  try {
    const parsed = JSON.parse(field)
    return parsed?.addresses?.[0]?.address || parsed?.text || "unknown"
  } catch {
    return "unknown"
  }
}

function parseAddressesFromData(field: string | null): string[] {
  if (!field) return []
  try {
    const parsed = JSON.parse(field)
    return parsed?.addresses?.map((a: any) => a.address).filter(Boolean) || []
  } catch {
    return []
  }
}

export const listEmails = new Elysia().get(
  "/emails",
  async ({ request, query, set }) => {
    console.log("📧 GET /api/e2/emails - Starting request")

    // Auth & rate limit validation
    const userId = await validateAndRateLimit(request, set)
    console.log("✅ Authentication successful for userId:", userId)

    // Parse query parameters
    const type = query.type || "all"
    const status = query.status
    const limit = Math.min(parseInt(query.limit || "50"), 100)
    const offset = parseInt(query.offset || "0")
    const domainFilter = query.domain
    const addressFilter = query.address

    console.log("📊 Query parameters:", {
      type,
      status,
      limit,
      offset,
      domainFilter,
      addressFilter,
    })

    // Validate parameters
    if (limit < 1 || limit > 100) {
      set.status = 400
      return { error: "Limit must be between 1 and 100" }
    }

    if (offset < 0) {
      set.status = 400
      return { error: "Offset must be non-negative" }
    }

    const emails: any[] = []
    let total = 0

    // Resolve domain/address filters to domain names
    let domainNames: string[] = []
    if (domainFilter) {
      // Check if it's a domain ID or name
      const domain = await db
        .select()
        .from(emailDomains)
        .where(
          and(
            eq(emailDomains.userId, userId),
            or(
              eq(emailDomains.id, domainFilter),
              eq(emailDomains.domain, domainFilter)
            )
          )
        )
        .limit(1)

      if (domain.length > 0) {
        domainNames = [domain[0].domain]
      }
    }

    let addressEmails: string[] = []
    if (addressFilter) {
      // Check if it's an address ID or the actual address
      const address = await db
        .select()
        .from(emailAddresses)
        .where(
          and(
            eq(emailAddresses.userId, userId),
            or(
              eq(emailAddresses.id, addressFilter),
              eq(emailAddresses.address, addressFilter)
            )
          )
        )
        .limit(1)

      if (address.length > 0) {
        addressEmails = [address[0].address]
      }
    }

    // Fetch received emails (if type is 'all' or 'received')
    if (type === "all" || type === "received") {
      console.log("🔍 Fetching received emails...")

      let receivedConditions: any[] = [eq(structuredEmails.userId, userId)]

      // Apply status filter
      if (status === "delivered") {
        receivedConditions.push(eq(structuredEmails.parseSuccess, true))
      } else if (status === "failed") {
        receivedConditions.push(eq(structuredEmails.parseSuccess, false))
      }

      // Apply domain filter
      if (domainNames.length > 0) {
        receivedConditions.push(
          like(structuredEmails.recipient, `%@${domainNames[0]}`)
        )
      }

      // Apply address filter
      if (addressEmails.length > 0) {
        receivedConditions.push(eq(structuredEmails.recipient, addressEmails[0]))
      }

      const receivedEmails = await db
        .select()
        .from(structuredEmails)
        .where(and(...receivedConditions))
        .orderBy(desc(structuredEmails.createdAt))
        .limit(type === "received" ? limit : 1000)
        .offset(type === "received" ? offset : 0)

      for (const email of receivedEmails) {
        const attachments = parseJsonField(email.attachments, [])
        emails.push({
          id: email.id,
          type: "received" as const,
          from: parseFromData(email.fromData),
          to: parseAddressesFromData(email.toData),
          subject: email.subject || "No Subject",
          status: email.parseSuccess ? "delivered" : "failed",
          created_at: email.createdAt?.toISOString() || new Date().toISOString(),
          sent_at: null,
          scheduled_at: null,
          has_attachments: attachments.length > 0,
          is_read: email.isRead || false,
        })
      }

      if (type === "received") {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(structuredEmails)
          .where(and(...receivedConditions))

        total = Number(count)
      }
    }

    // Fetch sent emails (if type is 'all' or 'sent')
    if (type === "all" || type === "sent") {
      console.log("🔍 Fetching sent emails...")

      let sentConditions: any[] = [eq(sentEmails.userId, userId)]

      // Apply status filter
      if (status === "delivered") {
        sentConditions.push(eq(sentEmails.status, "sent"))
      } else if (status === "pending") {
        sentConditions.push(eq(sentEmails.status, "pending"))
      } else if (status === "failed") {
        sentConditions.push(eq(sentEmails.status, "failed"))
      }

      // Apply domain filter
      if (domainNames.length > 0) {
        sentConditions.push(eq(sentEmails.fromDomain, domainNames[0]))
      }

      const sentEmailsList = await db
        .select()
        .from(sentEmails)
        .where(and(...sentConditions))
        .orderBy(desc(sentEmails.createdAt))
        .limit(type === "sent" ? limit : 1000)
        .offset(type === "sent" ? offset : 0)

      for (const email of sentEmailsList) {
        const attachments = parseJsonField(email.attachments, [])
        emails.push({
          id: email.id,
          type: "sent" as const,
          from: email.from,
          to: parseJsonField(email.to, []),
          subject: email.subject,
          status: email.status === "sent" ? "delivered" : email.status,
          created_at: email.createdAt?.toISOString() || new Date().toISOString(),
          sent_at: email.sentAt?.toISOString() || null,
          scheduled_at: null,
          has_attachments: attachments.length > 0,
        })
      }

      if (type === "sent") {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(sentEmails)
          .where(and(...sentConditions))

        total = Number(count)
      }
    }

    // Fetch scheduled emails (if type is 'all' or 'scheduled')
    if (type === "all" || type === "scheduled") {
      console.log("🔍 Fetching scheduled emails...")

      let scheduledConditions: any[] = [eq(scheduledEmails.userId, userId)]

      // Apply status filter
      if (status === "scheduled") {
        scheduledConditions.push(eq(scheduledEmails.status, "scheduled"))
      } else if (status === "cancelled") {
        scheduledConditions.push(eq(scheduledEmails.status, "cancelled"))
      } else if (status === "pending") {
        scheduledConditions.push(eq(scheduledEmails.status, "processing"))
      } else if (status === "failed") {
        scheduledConditions.push(eq(scheduledEmails.status, "failed"))
      }

      // Apply domain filter
      if (domainNames.length > 0) {
        scheduledConditions.push(eq(scheduledEmails.fromDomain, domainNames[0]))
      }

      const scheduledEmailsList = await db
        .select()
        .from(scheduledEmails)
        .where(and(...scheduledConditions))
        .orderBy(desc(scheduledEmails.createdAt))
        .limit(type === "scheduled" ? limit : 1000)
        .offset(type === "scheduled" ? offset : 0)

      for (const email of scheduledEmailsList) {
        const attachments = parseJsonField(email.attachments, [])
        emails.push({
          id: email.id,
          type: "scheduled" as const,
          from: email.fromAddress,
          to: parseJsonField(email.toAddresses, []),
          subject: email.subject,
          status: email.status,
          created_at: email.createdAt?.toISOString() || new Date().toISOString(),
          sent_at: email.sentAt?.toISOString() || null,
          scheduled_at: email.scheduledAt?.toISOString() || null,
          has_attachments: attachments.length > 0,
        })
      }

      if (type === "scheduled") {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(scheduledEmails)
          .where(and(...scheduledConditions))

        total = Number(count)
      }
    }

    // If type is 'all', sort combined results and apply pagination
    if (type === "all") {
      emails.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      total = emails.length
      const paginatedEmails = emails.slice(offset, offset + limit)

      console.log(
        `✅ Successfully retrieved ${paginatedEmails.length} emails (total: ${total})`
      )

      return {
        data: paginatedEmails,
        pagination: {
          limit,
          offset,
          total,
          has_more: offset + paginatedEmails.length < total,
        },
      }
    }

    console.log(`✅ Successfully retrieved ${emails.length} emails (total: ${total})`)

    return {
      data: emails,
      pagination: {
        limit,
        offset,
        total,
        has_more: offset + emails.length < total,
      },
    }
  },
  {
    query: ListEmailsQuerySchema,
    response: {
      200: ListEmailsResponse,
      400: ListEmailsErrorResponse,
      401: ListEmailsErrorResponse,
      500: ListEmailsErrorResponse,
    },
    detail: {
      tags: ["Emails"],
      summary: "List emails",
      description:
        "List all emails with optional filtering by type (sent/received/scheduled), status, domain, or address. Supports pagination.",
    },
  }
)

