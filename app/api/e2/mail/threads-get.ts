import { Elysia, t } from "elysia"
import { validateAndRateLimit } from "../lib/auth"
import { db } from "@/lib/db"
import { emailThreads, structuredEmails, sentEmails } from "@/lib/db/schema"
import { eq, and, asc } from "drizzle-orm"

// Thread message schema
const ThreadMessageSchema = t.Object({
  id: t.String(),
  message_id: t.Optional(t.Nullable(t.String())),
  type: t.Union([t.Literal("inbound"), t.Literal("outbound")]),
  thread_position: t.Number(),

  // Message content
  subject: t.Optional(t.Nullable(t.String())),
  text_body: t.Optional(t.Nullable(t.String())),
  html_body: t.Optional(t.Nullable(t.String())),

  // Sender/recipient info
  from: t.String(),
  from_name: t.Optional(t.Nullable(t.String())),
  from_address: t.Optional(t.Nullable(t.String())),
  to: t.Array(t.String()),
  cc: t.Array(t.String()),
  bcc: t.Array(t.String()),

  // Timestamps
  date: t.Optional(t.Nullable(t.String())),
  received_at: t.Optional(t.Nullable(t.String())),
  sent_at: t.Optional(t.Nullable(t.String())),

  // Message metadata
  is_read: t.Boolean(),
  read_at: t.Optional(t.Nullable(t.String())),
  has_attachments: t.Boolean(),
  attachments: t.Array(t.Any({ "x-stainless-any": true })),

  // Threading metadata
  in_reply_to: t.Optional(t.Nullable(t.String())),
  references: t.Array(t.String()),

  // Headers and tags
  headers: t.Any({ "x-stainless-any": true }),
  tags: t.Array(t.Any({ "x-stainless-any": true })),

  // Status (for sent emails)
  status: t.Optional(t.String()),
  failure_reason: t.Optional(t.Nullable(t.String())),
})

// Thread details schema
const ThreadDetailsSchema = t.Object({
  id: t.String(),
  root_message_id: t.String(),
  normalized_subject: t.Optional(t.Nullable(t.String())),
  participant_emails: t.Array(t.String()),
  message_count: t.Number(),
  last_message_at: t.String(),
  created_at: t.String(),
  updated_at: t.String(),
})

// Response schemas
const GetThreadResponse = t.Object({
  thread: ThreadDetailsSchema,
  messages: t.Array(ThreadMessageSchema),
  total_count: t.Number(),
})

const GetThreadErrorResponse = t.Object({
  error: t.String(),
})

// Helper to parse JSON safely
function parseJsonSafely<T>(json: string | null, fallback: T): T {
  if (!json) return fallback
  try {
    return JSON.parse(json) as T
  } catch (e) {
    return fallback
  }
}

// Helper to extract email addresses from parsed email data
function extractEmailAddresses(emailData: string | null): string[] {
  if (!emailData) return []

  try {
    const parsed = JSON.parse(emailData)
    if (parsed?.addresses && Array.isArray(parsed.addresses)) {
      return parsed.addresses
        .map((addr: any) => addr.address)
        .filter((email: string) => email && typeof email === "string")
    }
  } catch (e) {
    // Ignore parsing errors
  }

  return []
}

export const getThread = new Elysia().get(
  "/mail/threads/:id",
  async ({ request, params, set }) => {
    console.log("🧵 GET /api/e2/mail/threads/:id - Starting request")

    // Auth & rate limit validation
    const userId = await validateAndRateLimit(request, set)
    console.log("✅ Authentication successful for userId:", userId)

    const threadId = params.id
    console.log("🧵 Requested thread ID:", threadId)

    // Validate thread ID
    if (!threadId || typeof threadId !== "string") {
      console.log("⚠️ Invalid thread ID provided:", threadId)
      set.status = 400
      return { error: "Valid thread ID is required" }
    }

    // Get thread info
    console.log("🔍 Fetching thread details")
    const thread = await db
      .select()
      .from(emailThreads)
      .where(
        and(eq(emailThreads.id, threadId), eq(emailThreads.userId, userId))
      )
      .limit(1)

    if (thread.length === 0) {
      console.log("📭 Thread not found")
      set.status = 404
      return { error: "Thread not found" }
    }

    const threadDetails = thread[0]
    console.log(`📊 Thread found: ${threadDetails.messageCount} messages`)

    // Get all inbound messages in the thread
    console.log("📥 Fetching inbound messages")
    const inboundMessages = await db
      .select()
      .from(structuredEmails)
      .where(
        and(
          eq(structuredEmails.threadId, threadId),
          eq(structuredEmails.userId, userId)
        )
      )
      .orderBy(asc(structuredEmails.threadPosition))

    // Get all outbound messages in the thread
    console.log("📤 Fetching outbound messages")
    const outboundMessages = await db
      .select()
      .from(sentEmails)
      .where(
        and(eq(sentEmails.threadId, threadId), eq(sentEmails.userId, userId))
      )
      .orderBy(asc(sentEmails.threadPosition))

    console.log(
      `📊 Found ${inboundMessages.length} inbound and ${outboundMessages.length} outbound messages`
    )

    // Convert to unified message format
    const messages: any[] = []

    // Process inbound messages
    for (const email of inboundMessages) {
      let fromData = null
      let attachments: any[] = []
      let references: string[] = []
      let headers: Record<string, any> = {}

      try {
        fromData = email.fromData ? JSON.parse(email.fromData) : null
        attachments = email.attachments ? JSON.parse(email.attachments) : []
        references = email.references ? JSON.parse(email.references) : []
        headers = email.headers ? JSON.parse(email.headers) : {}
      } catch (e) {
        console.error("Failed to parse inbound email data:", e)
      }

      messages.push({
        id: email.id,
        message_id: email.messageId,
        type: "inbound" as const,
        thread_position: email.threadPosition || 0,

        // Content
        subject: email.subject,
        text_body: email.textBody,
        html_body: email.htmlBody,

        // Sender/recipient info
        from: fromData?.text || "Unknown Sender",
        from_name: fromData?.addresses?.[0]?.name || null,
        from_address: fromData?.addresses?.[0]?.address || null,
        to: extractEmailAddresses(email.toData),
        cc: extractEmailAddresses(email.ccData),
        bcc: extractEmailAddresses(email.bccData),

        // Timestamps
        date: email.date?.toISOString() || null,
        received_at: email.createdAt?.toISOString() || null,
        sent_at: null,

        // Message metadata
        is_read: email.isRead || false,
        read_at: email.readAt?.toISOString() || null,
        has_attachments: attachments.length > 0,
        attachments: attachments,

        // Threading metadata
        in_reply_to: email.inReplyTo,
        references: references,

        // Headers and tags
        headers: headers,
        tags: [],
      })
    }

    // Process outbound messages
    for (const email of outboundMessages) {
      let toAddresses: string[] = []
      let ccAddresses: string[] = []
      let bccAddresses: string[] = []
      let headers: Record<string, any> = {}
      let attachments: any[] = []
      let tags: Array<{ name: string; value: string }> = []

      try {
        toAddresses = email.to ? JSON.parse(email.to) : []
        ccAddresses = email.cc ? JSON.parse(email.cc) : []
        bccAddresses = email.bcc ? JSON.parse(email.bcc) : []
        headers = email.headers ? JSON.parse(email.headers) : {}
        attachments = email.attachments ? JSON.parse(email.attachments) : []
        tags = email.tags ? JSON.parse(email.tags) : []
      } catch (e) {
        console.error("Failed to parse outbound email data:", e)
      }

      const references: string[] = headers["References"]
        ? typeof headers["References"] === "string"
          ? headers["References"].split(/\s+/).filter(Boolean)
          : []
        : []

      messages.push({
        id: email.id,
        message_id: email.messageId,
        type: "outbound" as const,
        thread_position: email.threadPosition || 0,

        // Content
        subject: email.subject,
        text_body: email.textBody,
        html_body: email.htmlBody,

        // Sender/recipient info
        from: email.from,
        from_name: null,
        from_address: email.fromAddress,
        to: toAddresses,
        cc: ccAddresses,
        bcc: bccAddresses,

        // Timestamps
        date: email.sentAt?.toISOString() || null,
        received_at: null,
        sent_at: email.sentAt?.toISOString() || null,

        // Message metadata
        is_read: true,
        read_at: email.sentAt?.toISOString() || null,
        has_attachments: attachments.length > 0,
        attachments: attachments,

        // Threading metadata
        in_reply_to: headers["In-Reply-To"] || null,
        references: references,

        // Headers and tags
        headers: headers,
        tags: tags,

        // Status
        status: email.status,
        failure_reason: email.failureReason,
      })
    }

    // Sort messages by thread position
    messages.sort((a, b) => a.thread_position - b.thread_position)

    // Parse participant emails
    let participantEmails: string[] = []
    try {
      participantEmails = threadDetails.participantEmails
        ? JSON.parse(threadDetails.participantEmails)
        : []
    } catch (e) {
      console.error("Failed to parse participant emails:", e)
    }

    // Build response
    const response = {
      thread: {
        id: threadDetails.id,
        root_message_id: threadDetails.rootMessageId,
        normalized_subject: threadDetails.normalizedSubject,
        participant_emails: participantEmails,
        message_count: threadDetails.messageCount || 0,
        last_message_at:
          threadDetails.lastMessageAt?.toISOString() || new Date().toISOString(),
        created_at:
          threadDetails.createdAt?.toISOString() || new Date().toISOString(),
        updated_at:
          threadDetails.updatedAt?.toISOString() || new Date().toISOString(),
      },
      messages,
      total_count: messages.length,
    }

    console.log(`✅ Successfully retrieved thread with ${messages.length} messages`)
    return response
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    response: {
      200: GetThreadResponse,
      400: GetThreadErrorResponse,
      401: GetThreadErrorResponse,
      404: GetThreadErrorResponse,
      500: GetThreadErrorResponse,
    },
    detail: {
      tags: ["Mail"],
      summary: "Get thread by ID",
      description:
        "Get all emails in a thread with full details, including both inbound and outbound messages sorted by thread position.",
    },
  }
)

