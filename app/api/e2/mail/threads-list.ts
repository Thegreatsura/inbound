import { Elysia, t } from "elysia"
import { validateAndRateLimit } from "../lib/auth"
import { db } from "@/lib/db"
import {
  emailThreads,
  structuredEmails,
  sentEmails,
  emailDomains,
  emailAddresses,
} from "@/lib/db/schema"
import { eq, and, desc, sql, or, like } from "drizzle-orm"

// Query parameters schema
const ListThreadsQuerySchema = t.Object({
  domain: t.Optional(t.String({ description: "Filter by domain ID or name" })),
  address: t.Optional(t.String({ description: "Filter by email address ID or address" })),
  limit: t.Optional(t.String()),
  cursor: t.Optional(t.String({ description: "Cursor for pagination (thread ID)" })),
  search: t.Optional(t.String({ description: "Search in subject or participants" })),
  unread: t.Optional(t.String({ description: "Filter by unread threads (true/false)" })),
})

// Thread item schema
const ThreadItemSchema = t.Object({
  id: t.String(),
  root_message_id: t.String(),
  normalized_subject: t.Optional(t.Nullable(t.String())),
  participant_emails: t.Array(t.String()),
  message_count: t.Number(),
  last_message_at: t.String(),
  created_at: t.String(),
  latest_message: t.Optional(
    t.Nullable(
      t.Object({
        id: t.String(),
        type: t.Union([t.Literal("inbound"), t.Literal("outbound")]),
        subject: t.Optional(t.Nullable(t.String())),
        from_text: t.String(),
        text_preview: t.Optional(t.Nullable(t.String())),
        is_read: t.Boolean(),
        has_attachments: t.Boolean(),
        date: t.Optional(t.Nullable(t.String())),
      })
    )
  ),
  has_unread: t.Boolean(),
  is_archived: t.Boolean(),
})

// Response schemas
const ListThreadsResponse = t.Object({
  threads: t.Array(ThreadItemSchema),
  pagination: t.Object({
    limit: t.Number(),
    has_more: t.Boolean(),
    next_cursor: t.Optional(t.Nullable(t.String())),
  }),
  filters: t.Object({
    search: t.Optional(t.String()),
    unread_only: t.Optional(t.Boolean()),
    domain: t.Optional(t.String()),
    address: t.Optional(t.String()),
  }),
})

const ListThreadsErrorResponse = t.Object({
  error: t.String(),
})

// Helper to get latest message for a thread
async function getLatestMessageForThread(threadId: string, userId: string) {
  // Get latest inbound message
  const latestInbound = await db
    .select({
      id: structuredEmails.id,
      subject: structuredEmails.subject,
      fromData: structuredEmails.fromData,
      textBody: structuredEmails.textBody,
      isRead: structuredEmails.isRead,
      attachments: structuredEmails.attachments,
      date: structuredEmails.date,
      threadPosition: structuredEmails.threadPosition,
    })
    .from(structuredEmails)
    .where(
      and(
        eq(structuredEmails.threadId, threadId),
        eq(structuredEmails.userId, userId)
      )
    )
    .orderBy(desc(structuredEmails.threadPosition))
    .limit(1)

  // Get latest outbound message
  const latestOutbound = await db
    .select({
      id: sentEmails.id,
      subject: sentEmails.subject,
      from: sentEmails.from,
      textBody: sentEmails.textBody,
      attachments: sentEmails.attachments,
      sentAt: sentEmails.sentAt,
      threadPosition: sentEmails.threadPosition,
    })
    .from(sentEmails)
    .where(
      and(eq(sentEmails.threadId, threadId), eq(sentEmails.userId, userId))
    )
    .orderBy(desc(sentEmails.threadPosition))
    .limit(1)

  const inbound = latestInbound[0]
  const outbound = latestOutbound[0]

  if (!inbound && !outbound) return null

  const inboundPosition = inbound?.threadPosition || 0
  const outboundPosition = outbound?.threadPosition || 0

  if (outboundPosition > inboundPosition && outbound) {
    let attachments: any[] = []
    try {
      attachments = outbound.attachments ? JSON.parse(outbound.attachments) : []
    } catch (e) {}

    return {
      id: outbound.id,
      type: "outbound" as const,
      subject: outbound.subject,
      from_text: outbound.from,
      text_preview: outbound.textBody
        ? outbound.textBody.substring(0, 200)
        : null,
      is_read: true,
      has_attachments: attachments.length > 0,
      date: outbound.sentAt?.toISOString() || null,
    }
  } else if (inbound) {
    let fromText = "Unknown Sender"
    try {
      if (inbound.fromData) {
        const fromParsed = JSON.parse(inbound.fromData)
        fromText =
          fromParsed.text ||
          fromParsed.addresses?.[0]?.address ||
          "Unknown Sender"
      }
    } catch (e) {}

    let attachments: any[] = []
    try {
      attachments = inbound.attachments ? JSON.parse(inbound.attachments) : []
    } catch (e) {}

    return {
      id: inbound.id,
      type: "inbound" as const,
      subject: inbound.subject,
      from_text: fromText,
      text_preview: inbound.textBody
        ? inbound.textBody.substring(0, 200)
        : null,
      is_read: inbound.isRead || false,
      has_attachments: attachments.length > 0,
      date: inbound.date?.toISOString() || null,
    }
  }

  return null
}

// Check if thread has unread messages
async function threadHasUnread(
  threadId: string,
  userId: string
): Promise<boolean> {
  const unreadCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(structuredEmails)
    .where(
      and(
        eq(structuredEmails.threadId, threadId),
        eq(structuredEmails.userId, userId),
        eq(structuredEmails.isRead, false)
      )
    )

  return (unreadCount[0]?.count || 0) > 0
}

export const listThreads = new Elysia().get(
  "/mail/threads",
  async ({ request, query, set }) => {
    console.log("🧵 GET /api/e2/mail/threads - Starting request")

    // Auth & rate limit validation
    const userId = await validateAndRateLimit(request, set)
    console.log("✅ Authentication successful for userId:", userId)

    // Parse query parameters
    const limit = Math.min(parseInt(query.limit || "25"), 100)
    const cursor = query.cursor
    const search = query.search?.trim()
    const unreadOnly = query.unread === "true"
    const domainFilter = query.domain
    const addressFilter = query.address

    console.log("📋 Query params:", {
      limit,
      cursor,
      search,
      unreadOnly,
      domainFilter,
      addressFilter,
    })

    // Build the base query conditions
    const conditions: any[] = [eq(emailThreads.userId, userId)]

    // Add search condition
    if (search) {
      conditions.push(
        or(
          like(emailThreads.normalizedSubject, `%${search.toLowerCase()}%`),
          like(emailThreads.participantEmails, `%${search.toLowerCase()}%`)
        )
      )
    }

    // Domain filter - check if any participant email contains @domain
    if (domainFilter) {
      // Resolve domain name
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
        conditions.push(
          like(emailThreads.participantEmails, `%@${domain[0].domain}%`)
        )
      }
    }

    // Address filter - check if specific address is in participants
    if (addressFilter) {
      // Resolve address
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
        conditions.push(
          like(emailThreads.participantEmails, `%${address[0].address}%`)
        )
      }
    }

    // Cursor-based pagination
    if (cursor) {
      // Get the cursor thread's lastMessageAt
      const cursorThread = await db
        .select({ lastMessageAt: emailThreads.lastMessageAt })
        .from(emailThreads)
        .where(eq(emailThreads.id, cursor))
        .limit(1)

      if (cursorThread.length > 0 && cursorThread[0].lastMessageAt) {
        conditions.push(
          sql`${emailThreads.lastMessageAt} < ${cursorThread[0].lastMessageAt}`
        )
      }
    }

    const whereCondition =
      conditions.length > 1 ? and(...conditions) : conditions[0]

    // Get threads
    const threads = await db
      .select({
        id: emailThreads.id,
        rootMessageId: emailThreads.rootMessageId,
        normalizedSubject: emailThreads.normalizedSubject,
        participantEmails: emailThreads.participantEmails,
        messageCount: emailThreads.messageCount,
        lastMessageAt: emailThreads.lastMessageAt,
        createdAt: emailThreads.createdAt,
      })
      .from(emailThreads)
      .where(whereCondition)
      .orderBy(desc(emailThreads.lastMessageAt))
      .limit(limit + 1) // Get one extra to check if there are more

    console.log(`📊 Found ${threads.length} threads`)

    // Check if there are more results
    const hasMore = threads.length > limit
    const threadsToReturn = hasMore ? threads.slice(0, limit) : threads

    // Build response with latest message previews
    const threadItems: any[] = []

    for (const thread of threadsToReturn) {
      const latestMessage = await getLatestMessageForThread(thread.id, userId)
      const hasUnread = await threadHasUnread(thread.id, userId)

      // Apply unread filter
      if (unreadOnly && !hasUnread) {
        continue
      }

      // Parse participant emails
      let participantEmails: string[] = []
      try {
        participantEmails = thread.participantEmails
          ? JSON.parse(thread.participantEmails)
          : []
      } catch (e) {
        console.error("Failed to parse participant emails:", e)
      }

      threadItems.push({
        id: thread.id,
        root_message_id: thread.rootMessageId,
        normalized_subject: thread.normalizedSubject,
        participant_emails: participantEmails,
        message_count: thread.messageCount || 0,
        last_message_at:
          thread.lastMessageAt?.toISOString() || new Date().toISOString(),
        created_at:
          thread.createdAt?.toISOString() || new Date().toISOString(),
        latest_message: latestMessage,
        has_unread: hasUnread,
        is_archived: false, // TODO: Implement archiving
      })
    }

    // Determine next cursor
    const nextCursor =
      hasMore && threadsToReturn.length > 0
        ? threadsToReturn[threadsToReturn.length - 1].id
        : null

    console.log(`✅ Successfully retrieved ${threadItems.length} threads`)

    return {
      threads: threadItems,
      pagination: {
        limit,
        has_more: hasMore,
        next_cursor: nextCursor,
      },
      filters: {
        search: search || undefined,
        unread_only: unreadOnly || undefined,
        domain: domainFilter || undefined,
        address: addressFilter || undefined,
      },
    }
  },
  {
    query: ListThreadsQuerySchema,
    response: {
      200: ListThreadsResponse,
      400: ListThreadsErrorResponse,
      401: ListThreadsErrorResponse,
      500: ListThreadsErrorResponse,
    },
    detail: {
      tags: ["Mail"],
      summary: "List email threads",
      description:
        "Get thread summaries for a domain or address with cursor-based pagination. Includes latest message preview and unread status.",
    },
  }
)

