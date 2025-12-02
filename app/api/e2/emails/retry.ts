import { Elysia, t } from "elysia"
import { validateAndRateLimit } from "../lib/auth"
import { db } from "@/lib/db"
import {
  structuredEmails,
  sentEmails,
  endpoints,
  endpointDeliveries,
} from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { nanoid } from "nanoid"
import { routeEmail } from "@/lib/email-management/email-router"

// Request schema
const RetryEmailBodySchema = t.Object({
  endpoint_id: t.Optional(
    t.String({
      description:
        "Endpoint ID to retry delivery to. If not provided, retries to all configured endpoints.",
    })
  ),
  delivery_id: t.Optional(
    t.String({
      description: "Specific delivery ID to retry. If provided, retries that specific delivery.",
    })
  ),
})

// Response schemas
const RetryEmailSuccessResponse = t.Object({
  success: t.Boolean(),
  message: t.String(),
  delivery_id: t.Optional(t.String()),
})

const RetryEmailErrorResponse = t.Object({
  error: t.String(),
})

export const retryEmail = new Elysia().post(
  "/emails/:id/retry",
  async ({ request, params, body, set }) => {
    console.log(
      `🔄 POST /api/e2/emails/:id/retry - Starting retry process for:`,
      params.id
    )

    // Auth & rate limit validation
    const userId = await validateAndRateLimit(request, set)
    console.log("✅ Authentication successful for userId:", userId)

    const emailId = params.id

    // First, check if this is a received email (structuredEmails)
    const receivedEmail = await db
      .select({
        id: structuredEmails.id,
        emailId: structuredEmails.emailId,
        subject: structuredEmails.subject,
        fromData: structuredEmails.fromData,
        toData: structuredEmails.toData,
        textBody: structuredEmails.textBody,
        htmlBody: structuredEmails.htmlBody,
        rawContent: structuredEmails.rawContent,
        attachments: structuredEmails.attachments,
        headers: structuredEmails.headers,
      })
      .from(structuredEmails)
      .where(
        and(eq(structuredEmails.id, emailId), eq(structuredEmails.userId, userId))
      )
      .limit(1)

    if (receivedEmail.length > 0) {
      const email = receivedEmail[0]
      console.log(
        `📤 Retry email - Found received email: ${email.subject} (emailId: ${email.emailId})`
      )

      // If a specific delivery_id is provided, retry that specific delivery
      if (body.delivery_id) {
        console.log(`🔄 Retrying specific delivery: ${body.delivery_id}`)

        // Get the delivery record and verify it belongs to this email
        const delivery = await db
          .select()
          .from(endpointDeliveries)
          .where(
            and(
              eq(endpointDeliveries.id, body.delivery_id),
              eq(endpointDeliveries.emailId, email.emailId)
            )
          )
          .limit(1)

        if (delivery.length === 0) {
          console.log("❌ Delivery not found:", body.delivery_id)
          set.status = 404
          return { error: "Delivery not found for this email" }
        }

        const deliveryRecord = delivery[0]

        // Check if already succeeded
        if (deliveryRecord.status === "success") {
          console.log("⚠️ Delivery already succeeded:", body.delivery_id)
          set.status = 400
          return { error: "Delivery already succeeded. Use resend to deliver again." }
        }

        // Update the delivery record to increment attempts
        await db
          .update(endpointDeliveries)
          .set({
            attempts: (deliveryRecord.attempts || 0) + 1,
            status: "pending",
            lastAttemptAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(endpointDeliveries.id, body.delivery_id))

        try {
          // Use the existing email router to retry delivery
          await routeEmail(email.emailId)

          console.log(`✅ Retry delivery successful for delivery ${body.delivery_id}`)

          return {
            success: true,
            message: "Email re-delivery initiated successfully",
            delivery_id: body.delivery_id,
          }
        } catch (retryError) {
          console.error(`❌ Retry delivery failed:`, retryError)

          // Update delivery record to reflect failure
          await db
            .update(endpointDeliveries)
            .set({
              status: "failed",
              lastAttemptAt: new Date(),
              responseData: JSON.stringify({
                error:
                  retryError instanceof Error
                    ? retryError.message
                    : "Unknown retry error",
                retryAttempt: true,
                failedAt: new Date().toISOString(),
              }),
              updatedAt: new Date(),
            })
            .where(eq(endpointDeliveries.id, body.delivery_id))

          set.status = 500
          return {
            error:
              retryError instanceof Error
                ? retryError.message
                : "Delivery retry failed",
          }
        }
      }

      // If endpoint_id is provided, resend to that specific endpoint
      if (body.endpoint_id) {
        console.log(`📤 Resending to specific endpoint: ${body.endpoint_id}`)

        // Verify the endpoint exists and belongs to the user
        const endpoint = await db
          .select()
          .from(endpoints)
          .where(
            and(
              eq(endpoints.id, body.endpoint_id),
              eq(endpoints.userId, userId),
              eq(endpoints.isActive, true)
            )
          )
          .limit(1)

        if (endpoint.length === 0) {
          console.log("❌ Endpoint not found or inactive:", body.endpoint_id)
          set.status = 404
          return { error: "Endpoint not found or is inactive" }
        }

        const endpointRecord = endpoint[0]

        // Check for existing delivery to this endpoint
        const existingDelivery = await db
          .select()
          .from(endpointDeliveries)
          .where(
            and(
              eq(endpointDeliveries.emailId, email.emailId),
              eq(endpointDeliveries.endpointId, body.endpoint_id)
            )
          )
          .limit(1)

        const now = new Date()
        let deliveryId: string

        if (existingDelivery.length > 0) {
          // Update existing delivery record for resend
          deliveryId = existingDelivery[0].id
          const currentAttempts = existingDelivery[0].attempts || 0

          await db
            .update(endpointDeliveries)
            .set({
              status: "pending",
              attempts: currentAttempts + 1,
              lastAttemptAt: now,
              updatedAt: now,
              responseData: null,
            })
            .where(eq(endpointDeliveries.id, deliveryId))

          console.log(
            `📤 Updated existing delivery record ${deliveryId} (attempt ${currentAttempts + 1})`
          )
        } else {
          // Create a new delivery record
          deliveryId = nanoid()

          await db.insert(endpointDeliveries).values({
            id: deliveryId,
            emailId: email.emailId,
            endpointId: endpointRecord.id,
            deliveryType: endpointRecord.type,
            status: "pending",
            attempts: 1,
            lastAttemptAt: now,
            createdAt: now,
            updatedAt: now,
          })

          console.log(`📤 Created new delivery record ${deliveryId}`)
        }

        try {
          // Route the email
          await routeEmail(email.emailId)

          console.log(`✅ Resend successful for delivery ${deliveryId}`)

          return {
            success: true,
            message: "Email resend initiated successfully",
            delivery_id: deliveryId,
          }
        } catch (resendError) {
          console.error(`❌ Resend failed:`, resendError)

          await db
            .update(endpointDeliveries)
            .set({
              status: "failed",
              lastAttemptAt: new Date(),
              responseData: JSON.stringify({
                error:
                  resendError instanceof Error
                    ? resendError.message
                    : "Unknown resend error",
                failedAt: new Date().toISOString(),
              }),
              updatedAt: new Date(),
            })
            .where(eq(endpointDeliveries.id, deliveryId))

          set.status = 500
          return {
            error:
              resendError instanceof Error
                ? resendError.message
                : "Email resend failed",
          }
        }
      }

      // No specific endpoint or delivery - retry to all configured endpoints
      console.log(`🔄 Retrying to all configured endpoints for email ${email.emailId}`)

      try {
        await routeEmail(email.emailId)

        console.log(`✅ Email re-routing initiated successfully`)

        return {
          success: true,
          message: "Email re-delivery initiated to all configured endpoints",
        }
      } catch (routeError) {
        console.error(`❌ Email re-routing failed:`, routeError)
        set.status = 500
        return {
          error:
            routeError instanceof Error
              ? routeError.message
              : "Email re-delivery failed",
        }
      }
    }

    // Check if this is a sent email (sentEmails)
    const sentEmail = await db
      .select()
      .from(sentEmails)
      .where(and(eq(sentEmails.id, emailId), eq(sentEmails.userId, userId)))
      .limit(1)

    if (sentEmail.length > 0) {
      // For sent emails, we can't retry delivery - they were already sent via SES
      // The user should use the send endpoint to send a new email
      console.log("⚠️ Cannot retry sent emails - use send endpoint to send a new email")
      set.status = 400
      return {
        error:
          "Cannot retry sent emails. Use POST /emails to send a new email instead.",
      }
    }

    // Email not found
    console.log("❌ Email not found:", emailId)
    set.status = 404
    return { error: "Email not found" }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    body: RetryEmailBodySchema,
    response: {
      200: RetryEmailSuccessResponse,
      400: RetryEmailErrorResponse,
      401: RetryEmailErrorResponse,
      404: RetryEmailErrorResponse,
      500: RetryEmailErrorResponse,
    },
    detail: {
      tags: ["Emails"],
      summary: "Retry email delivery",
      description:
        "Retry delivery of a received email. Can retry to a specific endpoint, retry a specific failed delivery, or retry to all configured endpoints.",
    },
  }
)

