import { Elysia, t } from "elysia"
import { validateAndRateLimit } from "../lib/auth"
import { db } from "@/lib/db"
import {
  structuredEmails,
  emailDomains,
  emailAddresses,
} from "@/lib/db/schema"
import { eq, and, desc, sql, gte, or, like } from "drizzle-orm"

// Query parameters schema
const ListMailQuerySchema = t.Object({
  domain: t.Optional(t.String({ description: "Filter by domain ID or name" })),
  address: t.Optional(t.String({ description: "Filter by email address ID or address" })),
  status: t.Optional(
    t.Union([t.Literal("all"), t.Literal("unread"), t.Literal("archived")])
  ),
  limit: t.Optional(t.String()),
  offset: t.Optional(t.String()),
  time_range: t.Optional(
    t.Union([
      t.Literal("24h"),
      t.Literal("7d"),
      t.Literal("30d"),
      t.Literal("90d"),
    ])
  ),
  search: t.Optional(t.String({ description: "Search in subject, from, to" })),
})

// Email item schema
const MailItemSchema = t.Object({
  id: t.String(),
  email_id: t.String(),
  message_id: t.Optional(t.Nullable(t.String())),
  subject: t.Optional(t.Nullable(t.String())),
  from: t.String(),
  from_name: t.Optional(t.Nullable(t.String())),
  recipient: t.Optional(t.Nullable(t.String())),
  preview: t.Optional(t.Nullable(t.String())),
  received_at: t.String(),
  is_read: t.Boolean(),
  read_at: t.Optional(t.Nullable(t.String())),
  is_archived: t.Boolean(),
  archived_at: t.Optional(t.Nullable(t.String())),
  has_attachments: t.Boolean(),
  attachment_count: t.Number(),
  parse_success: t.Optional(t.Nullable(t.Boolean())),
  thread_id: t.Optional(t.Nullable(t.String())),
  thread_position: t.Optional(t.Nullable(t.Number())),
})

// Response schemas
const ListMailResponse = t.Object({
  emails: t.Array(MailItemSchema),
  pagination: t.Object({
    total: t.Number(),
    limit: t.Number(),
    offset: t.Number(),
    has_more: t.Boolean(),
  }),
  filters: t.Object({
    unique_domains: t.Array(t.String()),
  }),
})

const ListMailErrorResponse = t.Object({
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

function parseFromData(field: string | null): { address: string; name: string | null } {
  if (!field) return { address: "unknown", name: null }
  try {
    const parsed = JSON.parse(field)
    return {
      address: parsed?.addresses?.[0]?.address || parsed?.text || "unknown",
      name: parsed?.addresses?.[0]?.name || null,
    }
  } catch {
    return { address: "unknown", name: null }
  }
}

export const listMail = new Elysia().get(
  "/mail",
  async ({ request, query, set }) => {
    console.log("📧 GET /api/e2/mail - Starting request")

    // Auth & rate limit validation
    const userId = await validateAndRateLimit(request, set)
    console.log("✅ Authentication successful for userId:", userId)

    // Parse query parameters
    const status = query.status || "all"
    const limit = Math.min(parseInt(query.limit || "50"), 100)
    const offset = parseInt(query.offset || "0")
    const timeRange = query.time_range || "30d"
    const domainFilter = query.domain
    const addressFilter = query.address
    const searchQuery = query.search

    console.log("📊 Query parameters:", {
      status,
      limit,
      offset,
      timeRange,
      domainFilter,
      addressFilter,
      searchQuery,
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

    // Build where conditions
    let whereConditions: any[] = [eq(structuredEmails.userId, userId)]

    // Status filter
    if (status === "unread") {
      whereConditions.push(eq(structuredEmails.isRead, false))
    } else if (status === "archived") {
      whereConditions.push(eq(structuredEmails.isArchived, true))
    } else {
      // Default: exclude archived
      whereConditions.push(eq(structuredEmails.isArchived, false))
    }

    // Time range filter
    if (timeRange !== "90d") {
      let timeThreshold: Date
      const now = new Date()
      switch (timeRange) {
        case "24h":
          timeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          break
        case "7d":
          timeThreshold = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          break
        case "30d":
          timeThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          break
        default:
          timeThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      }
      whereConditions.push(gte(structuredEmails.createdAt, timeThreshold))
    }

    // Domain filter
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
        whereConditions.push(
          like(structuredEmails.recipient, `%@${domain[0].domain}`)
        )
      }
    }

    // Address filter
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
        whereConditions.push(eq(structuredEmails.recipient, address[0].address))
      }
    }

    // Search query
    if (searchQuery && searchQuery.trim()) {
      const searchPattern = `%${searchQuery.trim()}%`
      whereConditions.push(
        sql`(${structuredEmails.subject} ILIKE ${searchPattern} OR ${structuredEmails.fromData}::text ILIKE ${searchPattern} OR ${structuredEmails.toData}::text ILIKE ${searchPattern})`
      )
    }

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(structuredEmails)
      .where(and(...whereConditions))

    const total = Number(count)

    // Get emails with pagination
    const emails = await db
      .select({
        id: structuredEmails.id,
        emailId: structuredEmails.emailId,
        messageId: structuredEmails.messageId,
        subject: structuredEmails.subject,
        date: structuredEmails.date,
        fromData: structuredEmails.fromData,
        toData: structuredEmails.toData,
        recipient: structuredEmails.recipient,
        textBody: structuredEmails.textBody,
        attachments: structuredEmails.attachments,
        parseSuccess: structuredEmails.parseSuccess,
        isRead: structuredEmails.isRead,
        readAt: structuredEmails.readAt,
        isArchived: structuredEmails.isArchived,
        archivedAt: structuredEmails.archivedAt,
        createdAt: structuredEmails.createdAt,
        threadId: structuredEmails.threadId,
        threadPosition: structuredEmails.threadPosition,
      })
      .from(structuredEmails)
      .where(and(...whereConditions))
      .orderBy(desc(structuredEmails.createdAt))
      .limit(limit)
      .offset(offset)

    // Get unique domains for filtering
    const uniqueDomains = await db
      .selectDistinct({
        domain: sql<string>`SUBSTRING(${structuredEmails.recipient} FROM '@(.*)$')`,
      })
      .from(structuredEmails)
      .where(eq(structuredEmails.userId, userId))
      .limit(50)

    // Transform emails for response
    const transformedEmails = emails.map((email) => {
      const fromParsed = parseFromData(email.fromData)
      const attachments = parseJsonField(email.attachments, [])

      // Create preview from text body
      let preview: string | null = null
      if (email.textBody) {
        preview = email.textBody.substring(0, 200).replace(/\n/g, " ").trim()
        if (email.textBody.length > 200) {
          preview += "..."
        }
      }

      return {
        id: email.id,
        email_id: email.emailId,
        message_id: email.messageId,
        subject: email.subject,
        from: fromParsed.address,
        from_name: fromParsed.name,
        recipient: email.recipient,
        preview,
        received_at: email.createdAt?.toISOString() || new Date().toISOString(),
        is_read: email.isRead || false,
        read_at: email.readAt?.toISOString() || null,
        is_archived: email.isArchived || false,
        archived_at: email.archivedAt?.toISOString() || null,
        has_attachments: attachments.length > 0,
        attachment_count: attachments.length,
        parse_success: email.parseSuccess,
        thread_id: email.threadId,
        thread_position: email.threadPosition,
      }
    })

    console.log(
      `✅ Successfully retrieved ${transformedEmails.length} emails (total: ${total})`
    )

    return {
      emails: transformedEmails,
      pagination: {
        total,
        limit,
        offset,
        has_more: offset + transformedEmails.length < total,
      },
      filters: {
        unique_domains: uniqueDomains
          .map((d) => d.domain)
          .filter((d): d is string => d !== null),
      },
    }
  },
  {
    query: ListMailQuerySchema,
    response: {
      200: ListMailResponse,
      400: ListMailErrorResponse,
      401: ListMailErrorResponse,
      500: ListMailErrorResponse,
    },
    detail: {
      tags: ["Mail"],
      summary: "List inbox emails",
      description:
        "List received emails filtered by domain, address, status, or search query. Supports pagination and time range filtering.",
    },
  }
)

