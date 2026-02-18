import { realtime } from "@/lib/realtime"
import type { InboundWebhookPayload } from "@/packages/inbound-typescript-sdk/src/lib/webhooks"

/**
 * Inbound webhook handler for the homepage inbox demo
 * 
 * This endpoint receives emails sent to *@inbox.inbound.new addresses
 * and broadcasts them to the corresponding realtime channel so the
 * homepage can display incoming emails in real-time.
 */
export async function POST(request: Request) {
  try {
    const payload: InboundWebhookPayload = await request.json()

    // Extract the local part of the recipient email (e.g., "word" from "word@inbox.inbound.new")
    const recipient = payload.email.recipient || ""
    const localPart = recipient.split("@")[0]

    if (!localPart) {
      console.warn("[inbox-homepage] No recipient local part found in webhook")
      return new Response("OK", { status: 200 })
    }

    // Extract email data from the webhook payload
    const from = payload.email.from?.addresses?.[0]?.address || payload.email.from?.text || "unknown@example.com"
    const fromName = payload.email.from?.addresses?.[0]?.name || from.split("@")[0]
    const subject = payload.email.subject || "(no subject)"
    const preview = payload.email.cleanedContent?.text?.slice(0, 150) 
      || payload.email.parsedData?.textBody?.slice(0, 150) 
      || ""

    // The channel is scoped to this specific inbox address
    // Using the local part as the channel identifier
    const channel = `inbox-${localPart}`

    console.log(`[inbox-homepage] Emitting email to channel: ${channel}`)

    // Emit the event to the realtime channel
    // Using channel().event.emit() pattern for scoped channels
    const channelInstance = realtime.channel(channel) as typeof realtime
    await channelInstance.emit("inbox.emailReceived", {
      from: fromName ? `${fromName} <${from}>` : from,
      subject,
      preview,
      timestamp: new Date().toISOString(),
      emailId: payload.email.id,
    })

    console.log(`[inbox-homepage] Successfully emitted email to channel: ${channel}`)

    return new Response("OK", { status: 200 })
  } catch (error) {
    console.error("[inbox-homepage] Error processing webhook:", error)
    return new Response("Internal Server Error", { status: 500 })
  }
}

// Handle GET for health checks
export async function GET() {
  return new Response("Inbox homepage webhook is active", { status: 200 })
}
