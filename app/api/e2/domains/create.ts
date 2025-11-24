import { Elysia, t } from "elysia"
import { validateAndRateLimit } from "../lib/auth"
import { db } from "@/lib/db"
import { emailDomains } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { checkDomainCanReceiveEmails } from "@/lib/domains-and-dns/dns"
import { createDomainVerification, getVerifiedParentDomain } from "@/lib/db/domains"
import { initiateDomainVerification } from "@/lib/domains-and-dns/domain-verification"
import { Autumn as autumn } from "autumn-js"
import { isSubdomain } from "@/lib/domains-and-dns/domain-utils"

// AWS Region for MX record
const awsRegion = process.env.AWS_REGION || "us-east-2"

// Request/Response Types (OpenAPI-compatible)
const CreateDomainBody = t.Object({
  domain: t.String({ minLength: 1, maxLength: 253 }),
})

const DnsRecordSchema = t.Object({
  type: t.String(),
  name: t.String(),
  value: t.String(),
  description: t.Optional(t.String()),
  isRequired: t.Boolean(),
})

const CreateDomainResponse = t.Object({
  id: t.String(),
  domain: t.String(),
  status: t.Union([t.Literal("pending"), t.Literal("verified"), t.Literal("failed")]),
  canReceiveEmails: t.Boolean(),
  hasMxRecords: t.Boolean(),
  domainProvider: t.Nullable(t.String()),
  providerConfidence: t.Nullable(t.String()),
  mailFromDomain: t.Optional(t.String()),
  mailFromDomainStatus: t.Optional(t.String()),
  dnsRecords: t.Array(DnsRecordSchema),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  parentDomain: t.Optional(t.String()),
  message: t.Optional(t.String()),
})

const CreateDomainErrorResponse = t.Object({
  error: t.String(),
  code: t.Optional(t.String()),
})

export const createDomain = new Elysia().post(
  "/domains",
  async ({ request, body, set }) => {
    console.log("➕ POST /api/e2/domains - Starting domain creation")

    // Auth & rate limit validation - throws on error
    const userId = await validateAndRateLimit(request, set)
    console.log("✅ Authentication successful for userId:", userId)

    console.log("📝 Request data:", { domain: body.domain })

    // Validate required fields
    if (!body.domain) {
      console.log("❌ Missing required field: domain")
      set.status = 400
      return { error: "Domain is required" }
    }

    // Normalize domain (lowercase, trim)
    const domain = body.domain.toLowerCase().trim()

    // Validate domain format
    const domainRegex =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!domainRegex.test(domain) || domain.length > 253) {
      console.log("❌ Invalid domain format:", domain)
      set.status = 400
      return { error: "Invalid domain format" }
    }

    // Check if domain already exists on the platform (for any user)
    console.log("🔍 Checking if domain already exists on platform")
    const existingDomainAnyUser = await db
      .select({
        id: emailDomains.id,
        userId: emailDomains.userId,
        status: emailDomains.status,
        createdAt: emailDomains.createdAt,
      })
      .from(emailDomains)
      .where(eq(emailDomains.domain, domain))
      .limit(1)

    if (existingDomainAnyUser[0]) {
      const isOwnDomain = existingDomainAnyUser[0].userId === userId

      if (isOwnDomain) {
        console.log("❌ Domain already exists for current user:", domain)
        set.status = 409
        return {
          error: "You have already added this domain to your account",
        }
      } else {
        console.log("❌ Domain already registered by another user:", domain)
        set.status = 409
        return {
          error:
            "This domain is already registered on our platform. If you believe this is an error or you need to transfer ownership, please contact our support team.",
          code: "DOMAIN_ALREADY_REGISTERED",
        }
      }
    }

    // Check Autumn domain limits
    console.log("🔍 Checking domain limits with Autumn")
    const { data: domainCheck, error: domainCheckError } = await autumn.check({
      customer_id: userId,
      feature_id: "domains",
    })

    if (domainCheckError) {
      console.error("❌ Autumn domain check error:", domainCheckError)
      set.status = 500
      return { error: "Failed to check domain limits" }
    }

    if (!domainCheck?.allowed) {
      console.log("❌ Domain limit reached for user:", userId)
      set.status = 403
      return {
        error: "Domain limit reached. Please upgrade your plan to add more domains.",
      }
    }

    console.log("✅ Domain limits check passed:", {
      allowed: domainCheck.allowed,
      balance: domainCheck.balance,
      unlimited: domainCheck.unlimited,
    })

    // Check DNS for conflicts (MX/CNAME records)
    console.log("🔍 Checking DNS records for conflicts")
    const dnsResult = await checkDomainCanReceiveEmails(domain)

    if (!dnsResult.canReceiveEmails) {
      console.log("❌ Domain cannot receive emails:", dnsResult.error)
      set.status = 400
      return {
        error:
          dnsResult.error ||
          "Domain has conflicting DNS records (MX or CNAME). Please remove them before adding this domain.",
      }
    }

    console.log("✅ DNS check passed:", {
      canReceiveEmails: dnsResult.canReceiveEmails,
      hasMxRecords: dnsResult.hasMxRecords,
      provider: dnsResult.provider?.name,
    })

    // Create domain record in database
    console.log("💾 Creating domain record in database")
    const domainRecord = await createDomainVerification(domain, userId, {
      canReceiveEmails: dnsResult.canReceiveEmails,
      hasMxRecords: dnsResult.hasMxRecords,
      provider: dnsResult.provider,
    })

    // Check if this is a subdomain with verified parent
    let parentDomain: string | null = null
    if (isSubdomain(domain)) {
      const parent = await getVerifiedParentDomain(domain, userId)
      if (parent) {
        console.log(`✅ Subdomain detected with verified parent: ${parent.domain}`)
        parentDomain = parent.domain

        // Mark domain as verified immediately (inherits from parent)
        await db
          .update(emailDomains)
          .set({
            status: "verified",
            verificationToken: null, // Not needed
            updatedAt: new Date(),
          })
          .where(eq(emailDomains.id, domainRecord.id))

        // Return simplified response with only MX record
        const response = {
          id: domainRecord.id,
          domain: domainRecord.domain,
          status: "verified" as const,
          canReceiveEmails: domainRecord.canReceiveEmails || false,
          hasMxRecords: domainRecord.hasMxRecords || false,
          domainProvider: domainRecord.domainProvider,
          providerConfidence: domainRecord.providerConfidence,
          dnsRecords: [
            {
              type: "MX",
              name: domain,
              value: `10 inbound-smtp.${awsRegion}.amazonaws.com`,
              description: "Add this MX record to receive emails at this subdomain",
              isRequired: true,
            },
          ],
          createdAt: domainRecord.createdAt || new Date(),
          updatedAt: new Date(),
          parentDomain: parent.domain,
          message: `Subdomain inherits verification from ${parent.domain}. Only MX record needed for receiving.`,
        }

        console.log(
          `✅ Subdomain created with parent verification: ${domain} inherits from ${parent.domain}`
        )
        set.status = 201
        return response
      }
    }

    // Initiate SES verification (includes tenant association for new domains)
    console.log("🔐 Initiating SES domain verification with tenant integration")
    const verificationResult = await initiateDomainVerification(domain, userId)

    // Track domain usage with Autumn (only if not unlimited)
    if (!domainCheck.unlimited) {
      console.log("📊 Tracking domain usage with Autumn")
      const { error: trackError } = await autumn.track({
        customer_id: userId,
        feature_id: "domains",
        value: 1,
      })

      if (trackError) {
        console.error("⚠️ Failed to track domain usage:", trackError)
        // Don't fail the request, just log the warning
      }
    }

    // Format response
    const response = {
      id: domainRecord.id,
      domain: domainRecord.domain,
      status: verificationResult.status as "pending" | "verified" | "failed",
      canReceiveEmails: domainRecord.canReceiveEmails || false,
      hasMxRecords: domainRecord.hasMxRecords || false,
      domainProvider: domainRecord.domainProvider,
      providerConfidence: domainRecord.providerConfidence,
      mailFromDomain: verificationResult.mailFromDomain,
      mailFromDomainStatus: verificationResult.mailFromDomainStatus,
      dnsRecords: verificationResult.dnsRecords.map((record) => ({
        type: record.type,
        name: record.name,
        value: record.value,
        description: record.description,
        isRequired: true,
      })),
      createdAt: domainRecord.createdAt || new Date(),
      updatedAt: domainRecord.updatedAt || new Date(),
    }

    console.log("✅ Successfully created domain:", domainRecord.id)
    set.status = 201
    return response
  },
  {
    body: CreateDomainBody,
    response: t.Union([CreateDomainResponse, CreateDomainErrorResponse]),
    detail: {
      tags: ["Domains"],
      summary: "Create new domain",
      description:
        "Add a new domain for email receiving. Automatically initiates SES verification and returns required DNS records.",
    },
  }
)
