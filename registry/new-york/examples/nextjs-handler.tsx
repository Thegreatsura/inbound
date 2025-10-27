/**
 * @name nextjs-handler
 * @type registry:example
 * @title Next.js Inbound Email Handler
 * @description A complete example showing how to handle inbound emails in Next.js using the Inbound API
 * @registryDependencies ["button", "card"]
 */

import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Log the incoming email data
    console.log("Received email:", {
      from: body.from,
      to: body.to,
      subject: body.subject,
      timestamp: new Date().toISOString(),
    })

    // Extract email details
    const { from, to, subject, html, text, headers } = body

    // Process the email based on your business logic
    // Example: Route based on recipient
    if (to.includes("support@")) {
      // Handle support emails
      await handleSupportEmail({ from, subject, text })
    } else if (to.includes("sales@")) {
      // Handle sales emails
      await handleSalesEmail({ from, subject, text })
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: "Email processed successfully",
        receivedAt: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error processing email:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process email",
      },
      { status: 500 }
    )
  }
}

async function handleSupportEmail(email: {
  from: string
  subject: string
  text: string
}) {
  // Your support email logic here
  console.log("Processing support email from:", email.from)
}

async function handleSalesEmail(email: {
  from: string
  subject: string
  text: string
}) {
  // Your sales email logic here
  console.log("Processing sales email from:", email.from)
}
