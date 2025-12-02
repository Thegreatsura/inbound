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

    // Update SES rules if needed
    let sesRuleUpdated = false
    let awsWarning: string | undefined

    if (emailAddress.isReceiptRuleConfigured) {
      try {
        console.log("🔧 Updating SES receipt rules")
        const sesManager = new AWSSESReceiptRuleManager()

        // Get AWS configuration
        const awsRegion = process.env.AWS_REGION || "us-east-2"
        const lambdaFunctionName = process.env.LAMBDA_FUNCTION_NAME || "email-processor"
        const s3BucketName = process.env.S3_BUCKET_NAME
        const awsAccountId = process.env.AWS_ACCOUNT_ID

        if (!s3BucketName || !awsAccountId) {
          awsWarning = "AWS configuration incomplete. SES rules may need manual cleanup."
          console.warn(`⚠️ ${awsWarning}`)
        } else {
          const lambdaArn = AWSSESReceiptRuleManager.getLambdaFunctionArn(
            lambdaFunctionName,
            awsAccountId,
            awsRegion
          )

          if (remainingEmailAddresses.length > 0) {
            // Update SES rule with remaining email addresses
            console.log("🔄 Updating SES rule with remaining email addresses")
            const receiptResult = await sesManager.configureEmailReceiving({
              domain: emailAddress.domainName,
              emailAddresses: remainingEmailAddresses,
              lambdaFunctionArn: lambdaArn,
              s3BucketName,
            })

            if (receiptResult.status === "created" || receiptResult.status === "updated") {
              sesRuleUpdated = true
              console.log("✅ SES rule updated successfully")
            } else {
              awsWarning = `SES rule update failed: ${receiptResult.error}`
              console.warn(`⚠️ ${awsWarning}`)
            }
          } else {
            // Delete SES rule if no email addresses remain
            console.log("🗑️ Deleting SES rule (no remaining email addresses)")
            try {
              const deleteSuccess = await sesManager.removeEmailReceiving(emailAddress.domainName)
              if (deleteSuccess) {
                sesRuleUpdated = true
                console.log("✅ SES rule deleted successfully")
              } else {
                awsWarning = "SES rule deletion failed: Unable to remove receipt rule"
                console.warn(`⚠️ ${awsWarning}`)
              }
            } catch (deleteError) {
              awsWarning = `SES rule deletion failed: ${deleteError instanceof Error ? deleteError.message : "Unknown error"}`
              console.warn(`⚠️ ${awsWarning}`)
            }
          }
        }
      } catch (error) {
        awsWarning = `SES rule update error: ${error instanceof Error ? error.message : "Unknown error"}`
        console.error("❌ SES rule update failed:", error)
      }
    }

    const response = {
      message: "Email address deleted successfully",
      cleanup: {
        sesRuleUpdated,
        emailAddress: emailAddress.address,
        domain: emailAddress.domainName,
        ...(awsWarning && { warning: awsWarning }),
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

