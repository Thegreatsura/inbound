/**
 * @name webhook-verification
 * @type registry:example
 * @title Webhook Signature Verification
 * @description Example showing how to verify webhook signatures from Inbound
 * @dependencies ["crypto"]
 */

import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

/**
 * Verifies the webhook signature to ensure the request is from Inbound
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac("sha256", secret)
  const digest = hmac.update(payload).digest("hex")
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  )
}

export async function POST(request: NextRequest) {
  try {
    // Get the webhook secret from environment
    const webhookSecret = process.env.INBOUND_WEBHOOK_SECRET
    if (!webhookSecret) {
      throw new Error("INBOUND_WEBHOOK_SECRET not configured")
    }

    // Get the signature from headers
    const signature = request.headers.get("x-inbound-signature")
    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      )
    }

    // Get the raw body
    const body = await request.text()

    // Verify the signature
    const isValid = verifyWebhookSignature(body, signature, webhookSecret)
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      )
    }

    // Parse and process the verified payload
    const data = JSON.parse(body)
    console.log("Verified webhook data:", data)

    // Process your email here
    // ...

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Webhook verification error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
