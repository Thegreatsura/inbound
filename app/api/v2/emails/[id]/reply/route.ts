import { NextRequest, NextResponse } from "next/server";
import { validateRequest } from "../../../helper/main";
import {
  processAttachments,
  attachmentsToStorageFormat,
  type AttachmentInput,
} from "../../../helper/attachment-processor";
import { SESClient, SendRawEmailCommand } from "@aws-sdk/client-ses";
import { db } from "@/lib/db";
import {
  sentEmails,
  emailDomains,
  structuredEmails,
  SENT_EMAIL_STATUS,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { Autumn as autumn } from "autumn-js";
import { nanoid } from "nanoid";
import {
  canUserSendFromEmail,
  extractEmailAddress,
  extractDomain,
  extractEmailName,
} from "@/lib/email-management/agent-email-helper";
import { EmailThreader } from "@/lib/email-management/email-threader";

/**
 * POST /api/v2/emails/[id]/reply-new
 * Simplified reply to an inbound email or thread with proper threading
 * Supports both email IDs and thread IDs - when given a thread ID, replies to the latest message
 * Supports both session-based auth and API key auth
 * Has tests? ❌
 * Has logging? ✅
 * Has types? ✅
 */

// POST /api/v2/emails/[id]/reply-new types
export interface PostEmailReplyNewRequest {
  from: string; // Can be "user@domain.com" or "User <user@domain.com>"
  to?: string | string[]; // Optional - will use original sender if not provided
  subject?: string; // Optional - will add "Re: " to original subject if not provided
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: AttachmentInput[];
  replyAll?: boolean; // Default false - if true, includes original CC recipients
  tags?: Array<{
    // Resend-compatible tags
    name: string;
    value: string;
  }>;
}

export interface PostEmailReplyNewResponse {
  id: string;
  messageId: string; // Inbound message ID (used for threading)
  awsMessageId: string; // AWS SES Message ID
  repliedToEmailId: string; // The actual email ID that was replied to
  repliedToThreadId?: string; // The thread ID (if replying to a thread)
  isThreadReply: boolean; // Whether this was a reply to a thread ID vs direct email ID
}

// Helper functions
function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

// Format sender name and email address for display
function formatSenderAddress(email: string, name?: string): string {
  if (!name) return email;

  // Escape quotes in name and wrap in quotes if it contains special characters
  const escapedName = name.replace(/"/g, '\\"');
  const needsQuotes = /[,<>()[\]:;@\\"]/.test(name);

  if (needsQuotes) {
    return `"${escapedName}" <${email}>`;
  } else {
    return `${escapedName} <${email}>`;
  }
}

// Format date for email headers
function formatEmailDate(date: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const day = days[date.getUTCDay()];
  const dayNum = date.getUTCDate();
  const month = months[date.getUTCMonth()];
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  const seconds = date.getUTCSeconds().toString().padStart(2, "0");

  return `${day}, ${dayNum} ${month} ${year} ${hours}:${minutes}:${seconds} +0000`;
}

// Extract email addresses from parsed email data
function extractEmailsFromParsedData(parsedData: string | null): string[] {
  if (!parsedData) return [];

  try {
    const parsed = JSON.parse(parsedData);
    if (parsed?.addresses && Array.isArray(parsed.addresses)) {
      return parsed.addresses
        .map((addr: any) => addr.address)
        .filter((email: string) => email && typeof email === "string");
    }
  } catch (e) {
    console.error("Failed to parse email data:", e);
  }

  return [];
}

// Initialize SES client
const awsRegion = process.env.AWS_REGION || "us-east-2";
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

let sesClient: SESClient | null = null;

if (awsAccessKeyId && awsSecretAccessKey) {
  sesClient = new SESClient({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    },
  });
} else {
  console.warn(
    "⚠️ AWS credentials not configured. Email sending will not work."
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log("📧 POST /api/v2/emails/[id]/reply-new - Starting request");

  try {
    // Check for API version header for routing to historical versions
    const apiVersion = request.headers.get("API-Version") || request.headers.get("X-API-Version");
    
    if (apiVersion) {
      console.log(`🔀 API version header detected: ${apiVersion}`);
      
      // Route to specific historical version
      if (apiVersion === "reply-10-01-25") {
        console.log("🔀 Routing to historical version: reply-10-01-25");
        try {
          // Dynamically import the historical version handler
          const historicalHandler = await import("../reply-10-01-25/route");
          return await historicalHandler.POST(request, { params });
        } catch (importError) {
          console.error(`❌ Failed to load historical version ${apiVersion}:`, importError);
          return NextResponse.json(
            { error: `API version '${apiVersion}' not found or unavailable` },
            { status: 404 }
          );
        }
      } else {
        // Unknown version
        console.warn(`⚠️ Unknown API version requested: ${apiVersion}`);
        return NextResponse.json(
          { 
            error: `Unknown API version: ${apiVersion}`,
            availableVersions: ["reply-10-01-25"]
          },
          { status: 400 }
        );
      }
    }

    console.log("🔐 Validating request authentication");
    const { userId, error } = await validateRequest(request);
    if (!userId) {
      console.log("❌ Authentication failed:", error);
      return NextResponse.json({ error: error }, { status: 401 });
    }
    console.log("✅ Authentication successful for userId:", userId);

    const { id } = await params;
    console.log("📨 Replying to ID:", id);

    // Validate ID
    if (!id || typeof id !== "string") {
      console.log("⚠️ Invalid ID provided:", id);
      return NextResponse.json(
        { error: "Valid email ID or thread ID is required" },
        { status: 400 }
      );
    }

    // Resolve whether this is an email ID or thread ID
    console.log("🔍 Resolving ID type...");
    const resolvedId = await EmailThreader.resolveEmailId(id, userId);
    
    if (!resolvedId) {
      console.log("📭 ID not found in emails or threads");
      return NextResponse.json(
        { error: "Email or thread not found" }, 
        { status: 404 }
      );
    }

    const emailId = resolvedId.emailId;
    const isThreadReply = resolvedId.isThreadId;
    
    console.log(`📧 Resolved to email ID: ${emailId} ${isThreadReply ? '(from thread ID)' : '(direct email ID)'}`);

    // Idempotency Key Check -> this is used so we don't send duplicate replies.
    const idempotencyKey = request.headers.get("Idempotency-Key");
    if (idempotencyKey) {
      console.log("🔑 Idempotency key provided:", idempotencyKey);

      // Check if we've already processed this request
      const existingEmail = await db
        .select()
        .from(sentEmails)
        .where(
          and(
            eq(sentEmails.userId, userId),
            eq(sentEmails.idempotencyKey, idempotencyKey)
          )
        )
        .limit(1);

      if (existingEmail.length > 0) {
        console.log(
          "♻️ Idempotent request - returning existing email:",
          existingEmail[0].id
        );
        return NextResponse.json({ id: existingEmail[0].id });
      }
    }

    // Retrieve the original email from the database
    console.log("🔍 Fetching original email");
    const originalEmail = await db
      .select()
      .from(structuredEmails)
      .where(
        and(
          eq(structuredEmails.id, emailId),
          eq(structuredEmails.userId, userId)
        )
      )
      .limit(1);

    if (originalEmail.length === 0) {
      console.log("📭 Original email not found");
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const original = originalEmail[0];
    const body: PostEmailReplyNewRequest = await request.json();

    // Parse original email data
    let originalFromData = null;
    if (original.fromData) {
      try {
        originalFromData = JSON.parse(original.fromData);
      } catch (e) {
        console.error("Failed to parse original fromData:", e);
      }
    }

    // Determine reply recipients
    const originalSenderAddress = originalFromData?.addresses?.[0]?.address;
    if (!originalSenderAddress && !body.to) {
      console.log("⚠️ Cannot determine recipient for reply");
      return NextResponse.json(
        { error: "Cannot determine recipient email address" },
        { status: 400 }
      );
    }

    // Build recipient list based on replyAll flag
    let toAddresses: string[] = [];

    if (body.to) {
      // User explicitly specified recipients
      toAddresses = toArray(body.to);
    } else if (body.replyAll) {
      // Reply All: Include original sender + original CC recipients (but not BCC)
      console.log("📧 Reply All requested - including original CC recipients");

      // Start with original sender
      const originalSender = originalFromData?.text || originalSenderAddress;
      if (originalSender) {
        toAddresses.push(originalSender);
      }

      // Add original CC recipients (but not the current user)
      const originalCcEmails = extractEmailsFromParsedData(original.ccData);
      const fromAddress = extractEmailAddress(body.from);

      for (const ccEmail of originalCcEmails) {
        // Don't include the current sender in the recipient list
        if (ccEmail.toLowerCase() !== fromAddress.toLowerCase()) {
          toAddresses.push(ccEmail);
        }
      }

      // Remove duplicates
      toAddresses = [...new Set(toAddresses)];

      console.log("📧 Reply All recipients:", toAddresses);
    } else {
      // Simple reply: Only to original sender
      toAddresses = [originalFromData?.text || originalSenderAddress];
    }

    const subject = body.subject || `Re: ${original.subject || "No Subject"}`;

    // Validate required fields
    if (!body.from) {
      console.log("⚠️ Missing required field: from");
      return NextResponse.json(
        { error: "From address is required" },
        { status: 400 }
      );
    }

    // Validate email content
    if (!body.html && !body.text) {
      console.log("⚠️ No email content provided");
      return NextResponse.json(
        { error: "Either html or text content must be provided" },
        { status: 400 }
      );
    }

    // Extract sender information and format with name if provided
    const fromAddress = extractEmailAddress(body.from);
    const fromDomain = extractDomain(body.from);
    const senderName = extractEmailName(body.from) || undefined;
    const formattedFromAddress = formatSenderAddress(fromAddress, senderName);

    console.log("📧 Reply details:", {
      from: body.from,
      to: toAddresses,
      subject,
      originalMessageId: original.messageId,
      replyAll: body.replyAll || false,
      isThreadReply: isThreadReply,
      resolvedEmailId: emailId,
    });

    // Check if this is the special agent@inbnd.dev email (not allowed for replies)
    const { isAgentEmail } = canUserSendFromEmail(body.from);

    if (isAgentEmail) {
      console.log("❌ Agent email cannot be used for replies");
      return NextResponse.json(
        {
          error:
            "agent@inbnd.dev cannot be used for replies. Please use a verified domain email address.",
        },
        { status: 400 }
      );
    } else {
      // Verify sender domain ownership for non-agent emails
      console.log("🔍 Verifying domain ownership for:", fromDomain);
      const userDomain = await db
        .select()
        .from(emailDomains)
        .where(
          and(
            eq(emailDomains.userId, userId),
            eq(emailDomains.domain, fromDomain),
            eq(emailDomains.status, "verified")
          )
        )
        .limit(1);

      if (userDomain.length === 0) {
        console.log("❌ User does not own the sender domain:", fromDomain);
        return NextResponse.json(
          {
            error: `You don't have permission to send from domain: ${fromDomain}`,
          },
          { status: 403 }
        );
      }

      console.log("✅ Domain ownership verified");
    }

    // Validate email addresses
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of toAddresses) {
      const address = extractEmailAddress(email);
      if (!emailRegex.test(address)) {
        console.log("⚠️ Invalid email format:", email);
        return NextResponse.json(
          { error: `Invalid email format: ${email}` },
          { status: 400 }
        );
      }
    }

    // Process attachments if provided
    console.log("📎 Processing reply attachments");
    let processedAttachments: any[] = [];
    if (body.attachments && body.attachments.length > 0) {
      try {
        processedAttachments = await processAttachments(body.attachments);
        console.log(
          "✅ Reply attachments processed successfully:",
          processedAttachments.length
        );
      } catch (attachmentError) {
        console.error("❌ Reply attachment processing error:", attachmentError);
        return NextResponse.json(
          {
            error:
              attachmentError instanceof Error
                ? attachmentError.message
                : "Failed to process attachments",
          },
          { status: 400 }
        );
      }
    }

    // Check Autumn for email sending limits
    const { data: emailCheck, error: emailCheckError } = await autumn.check({
      customer_id: userId,
      feature_id: "emails_sent",
    });

    if (emailCheckError) {
      console.error("❌ Autumn email check error:", emailCheckError);
      return NextResponse.json(
        { error: "Failed to check email sending limits" },
        { status: 500 }
      );
    }

    if (!emailCheck.allowed) {
      console.log("❌ Email sending limit reached for user:", userId);
      return NextResponse.json(
        {
          error:
            "Email sending limit reached. Please upgrade your plan to send more emails.",
        },
        { status: 429 }
      );
    }

    // Create email record
    const replyEmailId = nanoid();
    const messageId = `${replyEmailId}@${fromDomain}`;

    // Build threading headers using exact original Message-ID
    const formatMessageId = (id: string) => {
      if (!id) return "";
      id = id.trim();
      if (!id.startsWith("<")) id = `<${id}`;
      if (!id.endsWith(">")) id = `${id}>`;
      return id;
    };

    const threadingId = original.messageId
      ? formatMessageId(original.messageId)
      : null;

    console.log("📧 Threading headers:", {
      messageId: messageId,
      inReplyTo: threadingId,
      references: threadingId,
      originalMessageId: original.messageId,
    });

    console.log("💾 Creating email record:", replyEmailId);

    const sentEmailRecord = await db
      .insert(sentEmails)
      .values({
        id: replyEmailId,
        from: formattedFromAddress,
        fromAddress,
        fromDomain,
        to: JSON.stringify(toAddresses),
        cc: null, // Simplified - no separate CC in new endpoint
        bcc: null, // Simplified - no separate BCC in new endpoint
        replyTo: null, // Simplified - no separate Reply-To in new endpoint
        subject,
        textBody: body.text || "",
        htmlBody: body.html || null,
        headers: JSON.stringify({
          "In-Reply-To": threadingId,
          References: threadingId,
          ...(body.headers || {}),
        }),
        attachments:
          processedAttachments.length > 0
            ? JSON.stringify(attachmentsToStorageFormat(processedAttachments))
            : null,
        tags: body.tags ? JSON.stringify(body.tags) : null,
        status: SENT_EMAIL_STATUS.PENDING,
        messageId,
        userId,
        idempotencyKey,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    // 🧵 NEW: Process threading for sent email
    try {
      const threadingResult = await EmailThreader.processSentEmailForThreading(replyEmailId, emailId, userId);
      console.log(`🧵 Reply ${replyEmailId} added to thread ${threadingResult.threadId} at position ${threadingResult.threadPosition}`);
    } catch (threadingError) {
      // Don't fail the reply if threading fails - log error and continue
      console.error(`⚠️ Threading failed for reply ${replyEmailId}:`, threadingError);
    }

    // Check if SES is configured
    if (!sesClient) {
      console.log("❌ AWS SES not configured");

      await db
        .update(sentEmails)
        .set({
          status: SENT_EMAIL_STATUS.FAILED,
          failureReason: "AWS SES not configured",
          updatedAt: new Date(),
        })
        .where(eq(sentEmails.id, replyEmailId));

      return NextResponse.json(
        { error: "Email service not configured. Please contact support." },
        { status: 500 }
      );
    }

    try {
      console.log("📤 Sending reply email via AWS SES");

      // Build raw email message
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      let rawMessage = "";

      // Ensure Message-ID has proper format
      const formattedMessageId = formatMessageId(messageId);

      // Add headers
      rawMessage += `From: ${formattedFromAddress}\r\n`;
      rawMessage += `To: ${toAddresses.join(", ")}\r\n`;
      rawMessage += `Subject: ${subject}\r\n`;
      rawMessage += `Message-ID: ${formattedMessageId}\r\n`;

      // Add threading headers if we have them
      if (threadingId) {
        rawMessage += `In-Reply-To: ${threadingId}\r\n`;
        rawMessage += `References: ${threadingId}\r\n`;
      }

      // Add custom headers
      if (body.headers) {
        for (const [key, value] of Object.entries(body.headers)) {
          // Skip headers we already added
          if (
            ![
              "from",
              "to",
              "subject",
              "message-id",
              "in-reply-to",
              "references",
            ].includes(key.toLowerCase())
          ) {
            rawMessage += `${key}: ${value}\r\n`;
          }
        }
      }

      rawMessage += `Date: ${formatEmailDate(new Date())}\r\n`;
      rawMessage += `MIME-Version: 1.0\r\n`;

      // Handle content and attachments
      if (processedAttachments.length > 0) {
        // Mixed content with attachments
        rawMessage += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n`;

        // Content part
        rawMessage += `--${boundary}\r\n`;

        if (body.html && body.text) {
          // Nested multipart/alternative for text and HTML
          const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).substring(2)}`;
          rawMessage += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;

          // Text part
          rawMessage += `--${altBoundary}\r\n`;
          rawMessage += `Content-Type: text/plain; charset=UTF-8\r\n`;
          rawMessage += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
          rawMessage += `${body.text}\r\n`;

          // HTML part
          rawMessage += `--${altBoundary}\r\n`;
          rawMessage += `Content-Type: text/html; charset=UTF-8\r\n`;
          rawMessage += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
          rawMessage += `${body.html}\r\n`;

          rawMessage += `--${altBoundary}--\r\n`;
        } else if (body.html) {
          rawMessage += `Content-Type: text/html; charset=UTF-8\r\n`;
          rawMessage += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
          rawMessage += `${body.html}\r\n`;
        } else {
          rawMessage += `Content-Type: text/plain; charset=UTF-8\r\n`;
          rawMessage += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
          rawMessage += `${body.text}\r\n`;
        }

        // Add attachments
        for (const attachment of processedAttachments) {
          rawMessage += `--${boundary}\r\n`;
          rawMessage += `Content-Type: ${attachment.contentType}\r\n`;
          rawMessage += `Content-Transfer-Encoding: base64\r\n`;
          rawMessage += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n\r\n`;
          rawMessage += `${attachment.content}\r\n`;
        }

        rawMessage += `--${boundary}--\r\n`;
      } else {
        // No attachments - simple content
        if (body.html && body.text) {
          // Multipart alternative
          rawMessage += `Content-Type: multipart/alternative; boundary="${boundary}"\r\n\r\n`;

          // Text part
          rawMessage += `--${boundary}\r\n`;
          rawMessage += `Content-Type: text/plain; charset=UTF-8\r\n`;
          rawMessage += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
          rawMessage += `${body.text}\r\n`;

          // HTML part
          rawMessage += `--${boundary}\r\n`;
          rawMessage += `Content-Type: text/html; charset=UTF-8\r\n`;
          rawMessage += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
          rawMessage += `${body.html}\r\n`;

          rawMessage += `--${boundary}--\r\n`;
        } else if (body.html) {
          // HTML only
          rawMessage += `Content-Type: text/html; charset=UTF-8\r\n`;
          rawMessage += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
          rawMessage += `${body.html}\r\n`;
        } else {
          // Text only
          rawMessage += `Content-Type: text/plain; charset=UTF-8\r\n`;
          rawMessage += `Content-Transfer-Encoding: quoted-printable\r\n\r\n`;
          rawMessage += `${body.text}\r\n`;
        }
      }

      // Send via SES
      const sesCommand = new SendRawEmailCommand({
        RawMessage: {
          Data: Buffer.from(rawMessage),
        },
        Source: fromAddress,
        Destinations: toAddresses.map(extractEmailAddress),
      });

      const sesResponse = await sesClient.send(sesCommand);
      const sesMessageId = sesResponse.MessageId;

      console.log("✅ Reply sent successfully via SES:", sesMessageId);

      // Update email record with success
      await db
        .update(sentEmails)
        .set({
          status: SENT_EMAIL_STATUS.SENT,
          providerResponse: JSON.stringify(sesResponse),
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sentEmails.id, replyEmailId));

      // Track email usage with Autumn (only if not unlimited)
      if (!emailCheck.unlimited) {
        console.log("📊 Tracking email usage with Autumn");
        const { error: trackError } = await autumn.track({
          customer_id: userId,
          feature_id: "emails_sent",
          value: 1,
        });

        if (trackError) {
          console.error("❌ Failed to track email usage:", trackError);
          // Don't fail the request if tracking fails
        }
      }

      console.log("✅ Reply processing complete");
      const response: PostEmailReplyNewResponse = {
        id: replyEmailId,
        messageId: messageId,
        awsMessageId: sesMessageId || "",
        repliedToEmailId: emailId,
        repliedToThreadId: resolvedId.threadId,
        isThreadReply: isThreadReply
      };
      return NextResponse.json(response, { status: 200 });
    } catch (sesError) {
      console.error("❌ SES send error:", sesError);

      // Update email status to failed
      await db
        .update(sentEmails)
        .set({
          status: SENT_EMAIL_STATUS.FAILED,
          failureReason:
            sesError instanceof Error ? sesError.message : "Unknown SES error",
          providerResponse: JSON.stringify(sesError),
          updatedAt: new Date(),
        })
        .where(eq(sentEmails.id, replyEmailId));

      return NextResponse.json(
        { error: "Failed to send reply. Please try again later." },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error(
      "💥 Unexpected error in POST /api/v2/emails/[id]/reply-new:",
      error
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
