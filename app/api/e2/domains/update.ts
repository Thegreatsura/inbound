import { Elysia, t } from "elysia"
import { validateAndRateLimit } from "../lib/auth"
import { db } from "@/lib/db"
import { emailDomains, endpoints } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { AWSSESReceiptRuleManager } from "@/lib/aws-ses/aws-ses-rules"
import { BatchRuleManager } from "@/lib/aws-ses/batch-rule-manager"

// Request/Response Types (OpenAPI-compatible)
const UpdateDomainBody = t.Object({
  isCatchAllEnabled: t.Boolean(),
  catchAllEndpointId: t.Optional(t.Nullable(t.String())),
})

const CatchAllEndpointSchema = t.Optional(
  t.Nullable(
    t.Object({
      id: t.String(),
      name: t.String(),
      type: t.String(),
      isActive: t.Boolean(),
    })
  )
)

const UpdateDomainResponse = t.Object({
  id: t.String(),
  domain: t.String(),
  status: t.String(),
  isCatchAllEnabled: t.Boolean(),
  catchAllEndpointId: t.Nullable(t.String()),
  catchAllEndpoint: CatchAllEndpointSchema,
  updatedAt: t.String({ format: "date-time" }),
})

// Error response schema
const UpdateDomainErrorResponse = t.Object({
  error: t.String(),
})

export const updateDomain = new Elysia().patch(
  "/domains/:id",
  async ({ request, params, body, set }) => {
    console.log("✏️ PATCH /api/e2/domains/:id - Starting update for domain:", params.id)

    // Auth & rate limit validation - throws on error
    const userId = await validateAndRateLimit(request, set)
    console.log("✅ Authentication successful for userId:", userId)

    console.log("📝 Update data received:", {
      isCatchAllEnabled: body.isCatchAllEnabled,
      catchAllEndpointId: body.catchAllEndpointId,
    })

    // Check if domain exists and belongs to user
    console.log("🔍 Checking if domain exists and belongs to user")
    const existingDomain = await db
      .select()
      .from(emailDomains)
      .where(and(eq(emailDomains.id, params.id), eq(emailDomains.userId, userId)))
      .limit(1)

    if (!existingDomain[0]) {
      console.log("❌ Domain not found for user:", userId, "domain:", params.id)
      set.status = 404
      return { error: "Domain not found" }
    }

    console.log("✅ Found existing domain:", existingDomain[0].domain)

    // Check if domain is verified
    if (existingDomain[0].status !== "verified") {
      console.log("❌ Domain not verified:", existingDomain[0].status)
      set.status = 400
      return { error: "Domain must be verified before configuring catch-all" }
    }

    // Validate endpoint if enabling catch-all
    if (body.isCatchAllEnabled && body.catchAllEndpointId) {
      console.log("🔍 Validating endpoint")
      const endpointResult = await db
        .select()
        .from(endpoints)
        .where(and(eq(endpoints.id, body.catchAllEndpointId), eq(endpoints.userId, userId)))
        .limit(1)

      if (!endpointResult[0]) {
        console.log("❌ Endpoint not found:", body.catchAllEndpointId)
        set.status = 400
        return { error: "Endpoint not found or does not belong to user" }
      }

      if (!endpointResult[0].isActive) {
        console.log("❌ Endpoint is inactive:", body.catchAllEndpointId)
        set.status = 400
        return { error: "Selected endpoint is not active" }
      }
    }

    // Defensive programming: Ensure domain is in SES batch rule when enabling
    const catchAllEnabled = body.isCatchAllEnabled ?? false
    const catchAllEndpointId = catchAllEnabled ? body.catchAllEndpointId : null
    let updatedReceiptRuleName = existingDomain[0].catchAllReceiptRuleName

    // ENABLE catch-all: Ensure domain is in a batch rule (if not already)
    if (catchAllEnabled && !existingDomain[0].catchAllReceiptRuleName?.startsWith("batch-rule-")) {
      console.log("🔧 Enabling catch-all - Domain not yet in batch catch-all, adding to batch rule")

      try {
        // Get AWS configuration
        const awsRegion = process.env.AWS_REGION || "us-east-2"
        const lambdaFunctionName = process.env.LAMBDA_FUNCTION_NAME || "email-processor"
        const s3BucketName = process.env.S3_BUCKET_NAME
        const awsAccountId = process.env.AWS_ACCOUNT_ID

        if (!s3BucketName || !awsAccountId) {
          console.error(
            "⚠️ AWS configuration incomplete. Missing S3_BUCKET_NAME or AWS_ACCOUNT_ID"
          )
          set.status = 500
          return { error: "AWS configuration incomplete. Cannot enable catch-all without proper AWS setup." }
        }

        const lambdaArn = AWSSESReceiptRuleManager.getLambdaFunctionArn(
          lambdaFunctionName,
          awsAccountId,
          awsRegion
        )

        const batchManager = new BatchRuleManager("inbound-catchall-domain-default")
        const sesManager = new AWSSESReceiptRuleManager(awsRegion)

        // Find or create rule with capacity
        const rule = await batchManager.findOrCreateRuleWithCapacity(1)
        console.log(
          `📋 Using batch rule: ${rule.ruleName} (${rule.currentCapacity}/${rule.availableSlots + rule.currentCapacity})`
        )

        // Add domain catch-all to batch rule
        await sesManager.configureBatchCatchAllRule({
          domains: [existingDomain[0].domain],
          lambdaFunctionArn: lambdaArn,
          s3BucketName,
          ruleSetName: "inbound-catchall-domain-default",
          ruleName: rule.ruleName,
        })

        // Increment rule capacity
        await batchManager.incrementRuleCapacity(rule.id, 1)

        updatedReceiptRuleName = rule.ruleName
        console.log(`✅ Added domain to batch rule: ${rule.ruleName}`)
      } catch (error) {
        console.error("Failed to add domain to batch rule:", error)
        set.status = 500
        return {
          error: `Failed to configure AWS SES for catch-all: ${error instanceof Error ? error.message : "Unknown error"}`,
        }
      }
    } else if (catchAllEnabled) {
      console.log(`✅ Domain already in batch rule: ${existingDomain[0].catchAllReceiptRuleName}`)
    }

    // DISABLE catch-all: Just update database flag (domain stays in SES batch rule)
    // Note: Domain remains in SES to receive individual email addresses
    // Filtering is handled by email-router.ts based on isCatchAllEnabled flag

    // Update domain in database
    console.log("💾 Updating domain in database")
    const [updatedDomain] = await db
      .update(emailDomains)
      .set({
        isCatchAllEnabled: catchAllEnabled,
        catchAllEndpointId: catchAllEndpointId,
        catchAllReceiptRuleName: updatedReceiptRuleName,
        updatedAt: new Date(),
      })
      .where(eq(emailDomains.id, params.id))
      .returning()

    // Get updated endpoint information
    let catchAllEndpoint: { id: string; name: string; type: string; isActive: boolean } | null =
      null
    if (updatedDomain.catchAllEndpointId) {
      const endpointResult = await db
        .select({
          id: endpoints.id,
          name: endpoints.name,
          type: endpoints.type,
          isActive: endpoints.isActive,
        })
        .from(endpoints)
        .where(eq(endpoints.id, updatedDomain.catchAllEndpointId))
        .limit(1)

      const endpoint = endpointResult[0]
      if (endpoint) {
        catchAllEndpoint = {
          id: endpoint.id,
          name: endpoint.name,
          type: endpoint.type,
          isActive: endpoint.isActive || false,
        }
      }
    }

    console.log("✅ Successfully updated domain catch-all settings")

    return {
      id: updatedDomain.id,
      domain: updatedDomain.domain,
      status: updatedDomain.status,
      isCatchAllEnabled: updatedDomain.isCatchAllEnabled || false,
      catchAllEndpointId: updatedDomain.catchAllEndpointId,
      catchAllEndpoint,
      updatedAt: (updatedDomain.updatedAt || new Date()).toISOString(),
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    body: UpdateDomainBody,
    response: {
      200: UpdateDomainResponse,
      400: UpdateDomainErrorResponse,
      401: UpdateDomainErrorResponse,
      404: UpdateDomainErrorResponse,
      500: UpdateDomainErrorResponse,
    },
    detail: {
      tags: ["Domains"],
      summary: "Update domain catch-all settings",
      description: "Update catch-all email settings for a domain. Catch-all receives emails sent to any address on your domain. Domain must be verified first.",
      "x-codeSamples": [
        {
          lang: "javascript",
          label: "Node.js",
          source: `import { Inbound } from 'inboundemail'

const inbound = new Inbound(process.env.INBOUND_API_KEY)

const { data: domain } = await inbound.domains.update('dom_abc123', {
  isCatchAllEnabled: true,
  catchAllEndpointId: 'endp_xyz789'
})`,
        },
      ],
    },
  }
)
