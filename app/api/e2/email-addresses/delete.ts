import { Elysia, t } from "elysia"
import { validateAndRateLimit } from "../lib/auth"
import { db } from "@/lib/db"
import { emailAddresses, emailDomains } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { AWSSESReceiptRuleManager } from "@/lib/aws-ses/aws-ses-rules"

// Response Types (OpenAPI-compatible)
const CleanupSchema = t.Object({
  sesRuleUpdated: t.Boolean(),
  emailAddress: t.String(),
  domain: t.String(),
  warning: t.Optional(t.String()),
})

const DeleteEmailAddressResponse = t.Object({
  message: t.String(),
  cleanup: CleanupSchema,
})

const ErrorResponse = t.Object({
  error: t.String(),
  code: t.Optional(t.String()),
})

export const deleteEmailAddress = new Elysia().delete(
  "/email-addresses/:id",
  async ({ request, params, set }) => {
    console.log("🗑️ DELETE /api/e2/email-addresses/:id - Starting request")

    // Auth & rate limit validation - throws on error
    const userId = await validateAndRateLimit(request, set)
    console.log("✅ Authentication successful for userId:", userId)

    // Get email address with domain information
    console.log("🔍 Looking up email address:", params.id)
    const emailAddressResult = await db
      .select({
        id: emailAddresses.id,
        address: emailAddresses.address,
        domainId: emailAddresses.domainId,
        isReceiptRuleConfigured: emailAddresses.isReceiptRuleConfigured,
        receiptRuleName: emailAddresses.receiptRuleName,
        userId: emailAddresses.userId,
        domainName: emailDomains.domain,
      })
      .from(emailAddresses)
      .innerJoin(emailDomains, eq(emailAddresses.domainId, emailDomains.id))
      .where(and(eq(emailAddresses.id, params.id), eq(emailAddresses.userId, userId)))
      .limit(1)

    if (!emailAddressResult[0]) {
      console.log("❌ Email address not found:", params.id)
      set.status = 404
      return { error: "Email address not found" }
    }

    const emailAddress = emailAddressResult[0]
    console.log("✅ Found email address:", emailAddress.address)

    // Get all other email addresses for this domain (to update SES rules)
    console.log("🔍 Getting other email addresses for domain:", emailAddress.domainName)
    const otherEmailAddresses = await db
      .select({
        address: emailAddresses.address,
      })
      .from(emailAddresses)
      .where(
        and(
          eq(emailAddresses.domainId, emailAddress.domainId),
          eq(emailAddresses.userId, userId),
          eq(emailAddresses.isActive, true)
        )
      )

    const remainingEmailAddresses = otherEmailAddresses
      .filter((e) => e.address !== emailAddress.address)
      .map((e) => e.address)

    console.log("📊 Remaining email addresses after deletion:", remainingEmailAddresses.length)

    // Delete the email address
    console.log("🗑️ Deleting email address record")
    await db.delete(emailAddresses).where(eq(emailAddresses.id, params.id))

    console.log("✅ Email address deleted from database")

    // Note: With batch catch-all rules, we don't need to update SES rules when deleting individual email addresses
    // The domain catch-all rule remains in place and handles all emails for the domain
    // We only remove the domain from the batch rule when the entire domain is deleted (handled in domains/delete.ts)
    const sesRuleUpdated = false
    const awsWarning: string | undefined = undefined
    console.log("ℹ️ Using batch catch-all rules - no SES rule update needed for individual email deletion")

    const response = {
      message: "Email address deleted successfully",
      cleanup: {
        sesRuleUpdated,
        emailAddress: emailAddress.address,
        domain: emailAddress.domainName,
        ...(awsWarning ? { warning: awsWarning } : {}),
      },
    }

    console.log("✅ DELETE /api/e2/email-addresses/:id - Successfully deleted email address")
    return response
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    response: {
      200: DeleteEmailAddressResponse,
      401: ErrorResponse,
      404: ErrorResponse,
      500: ErrorResponse,
    },
    detail: {
      tags: ["Email Addresses"],
      summary: "Delete email address",
      description:
        "Delete an email address and clean up associated SES receipt rules. Returns cleanup status.",
    },
  }
)

