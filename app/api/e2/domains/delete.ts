import { Elysia, t } from "elysia"
import { validateAndRateLimit } from "../lib/auth"
import { db } from "@/lib/db"
import { emailDomains, emailAddresses, domainDnsRecords, blockedEmails } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"
import { AWSSESReceiptRuleManager } from "@/lib/aws-ses/aws-ses-rules"
import { isRootDomain } from "@/lib/domains-and-dns/domain-utils"
import { getDependentSubdomains } from "@/lib/db/domains"
import { deleteDomainFromSES } from "@/lib/domains-and-dns/domain-verification"
import { Autumn as autumn } from "autumn-js"

// Response Types (OpenAPI-compatible)
const DeletedResourcesSchema = t.Object({
  domain: t.String(),
  emailAddresses: t.Number(),
  dnsRecords: t.Number(),
  blockedEmails: t.Number(),
  sesIdentity: t.Boolean(),
  sesReceiptRules: t.Boolean(),
})

const DeleteDomainResponse = t.Object({
  success: t.Boolean(),
  message: t.String(),
  deletedResources: DeletedResourcesSchema,
})

// Error response for dependent subdomains
const DependentSubdomainSchema = t.Object({
  id: t.String(),
  domain: t.String(),
  status: t.String(),
})

const DeleteDomainErrorResponse = t.Object({
  error: t.String(),
  code: t.Optional(t.String()),
  dependentSubdomains: t.Optional(t.Array(DependentSubdomainSchema)),
})

export const deleteDomain = new Elysia().delete(
  "/domains/:id",
  async ({ request, params, set }) => {
    console.log("🗑️ DELETE /api/e2/domains/:id - Starting deletion for domain:", params.id)

    // Auth & rate limit validation - throws on error
    const userId = await validateAndRateLimit(request, set)
    console.log("✅ Authentication successful for userId:", userId)

    // Get domain with user verification
    console.log("🔍 Fetching domain details")
    const domainResult = await db
      .select()
      .from(emailDomains)
      .where(and(eq(emailDomains.id, params.id), eq(emailDomains.userId, userId)))
      .limit(1)

    if (!domainResult[0]) {
      console.log("❌ Domain not found for user:", userId, "domain:", params.id)
      set.status = 404
      return { error: "Domain not found" }
    }

    const domain = domainResult[0]
    console.log("✅ Found domain:", domain.domain, "status:", domain.status)

    // Check if this is a root domain with dependent subdomains
    if (isRootDomain(domain.domain)) {
      const dependentSubdomains = await getDependentSubdomains(domain.domain, userId)

      if (dependentSubdomains.length > 0) {
        console.log(
          `❌ Cannot delete root domain ${domain.domain} - ${dependentSubdomains.length} subdomain(s) depend on it`
        )
        set.status = 409
        return {
          error: `Cannot delete root domain. This domain has ${dependentSubdomains.length} subdomain(s) that depend on it: ${dependentSubdomains.map((d) => d.domain).join(", ")}`,
          code: "DOMAIN_HAS_DEPENDENT_SUBDOMAINS",
          dependentSubdomains: dependentSubdomains.map((d) => ({
            id: d.id,
            domain: d.domain,
            status: d.status,
          })),
        }
      }
    }

    // Track deletion stats
    const deletionStats = {
      domain: domain.domain,
      emailAddresses: 0,
      dnsRecords: 0,
      blockedEmails: 0,
      sesIdentity: false,
      sesReceiptRules: false,
    }

    // 1. Delete AWS SES receipt rules (both catch-all and individual)
    if (domain.domain) {
      try {
        console.log("🔧 Removing AWS SES receipt rules")
        const sesManager = new AWSSESReceiptRuleManager()

        // Remove catch-all rule if exists
        if (domain.isCatchAllEnabled || domain.catchAllReceiptRuleName) {
          console.log("🔧 Removing catch-all receipt rule")
          const catchAllRemoved = await sesManager.removeCatchAllDomain(domain.domain)
          if (catchAllRemoved) {
            deletionStats.sesReceiptRules = true
            console.log("✅ Catch-all receipt rule removed")
          }
        }

        // Remove individual email receipt rule
        console.log("🔧 Removing individual email receipt rule")
        const individualRemoved = await sesManager.removeEmailReceiving(domain.domain)
        if (individualRemoved) {
          deletionStats.sesReceiptRules = true
          console.log("✅ Individual email receipt rule removed")
        }
      } catch (sesRuleError) {
        console.error("⚠️ Failed to remove SES receipt rules:", sesRuleError)
        // Continue with deletion even if SES rule removal fails
      }
    }

    // 2. Delete AWS SES identity
    if (domain.domain) {
      try {
        console.log("🔧 Deleting AWS SES identity")
        const sesResult = await deleteDomainFromSES(domain.domain)
        deletionStats.sesIdentity = sesResult.success
        if (sesResult.success) {
          console.log("✅ SES identity deleted")
        } else {
          console.warn("⚠️ Failed to delete SES identity:", sesResult.error)
        }
      } catch (sesError) {
        console.error("⚠️ Failed to delete SES identity:", sesError)
        // Continue with deletion even if SES identity deletion fails
      }
    }

    // 3. Delete blocked emails for this domain
    try {
      console.log("🔧 Deleting blocked emails")
      const blockedResult = await db
        .delete(blockedEmails)
        .where(eq(blockedEmails.domainId, params.id))
        .returning({ id: blockedEmails.id })

      deletionStats.blockedEmails = blockedResult.length
      console.log(`✅ Deleted ${blockedResult.length} blocked emails`)
    } catch (blockedError) {
      console.error("⚠️ Failed to delete blocked emails:", blockedError)
      // Continue with deletion
    }

    // 4. Delete email addresses
    try {
      console.log("🔧 Deleting email addresses")
      const emailResult = await db
        .delete(emailAddresses)
        .where(eq(emailAddresses.domainId, params.id))
        .returning({ id: emailAddresses.id })

      deletionStats.emailAddresses = emailResult.length
      console.log(`✅ Deleted ${emailResult.length} email addresses`)
    } catch (emailError) {
      console.error("❌ Failed to delete email addresses:", emailError)
      set.status = 500
      return { error: "Failed to delete email addresses" }
    }

    // 5. Delete DNS records
    try {
      console.log("🔧 Deleting DNS records")
      const dnsResult = await db
        .delete(domainDnsRecords)
        .where(eq(domainDnsRecords.domainId, params.id))
        .returning({ id: domainDnsRecords.id })

      deletionStats.dnsRecords = dnsResult.length
      console.log(`✅ Deleted ${dnsResult.length} DNS records`)
    } catch (dnsError) {
      console.error("❌ Failed to delete DNS records:", dnsError)
      set.status = 500
      return { error: "Failed to delete DNS records" }
    }

    // 6. Delete the domain itself
    try {
      console.log("🔧 Deleting domain record")
      await db.delete(emailDomains).where(eq(emailDomains.id, params.id))

      console.log("✅ Domain record deleted")
    } catch (domainError) {
      console.error("❌ Failed to delete domain:", domainError)
      set.status = 500
      return { error: "Failed to delete domain" }
    }

    // 7. Track domain deletion with Autumn to free up domain spot
    try {
      console.log("📊 Tracking domain deletion with Autumn for user:", userId)
      const { error: trackError } = await autumn.track({
        customer_id: userId,
        feature_id: "domains",
        value: -1,
      })

      if (trackError) {
        console.error("⚠️ Failed to track domain deletion:", trackError)
        console.warn(`⚠️ Domain deleted but usage tracking failed for user: ${userId}`)
      } else {
        console.log(`✅ Successfully tracked domain deletion for user: ${userId}`)
      }
    } catch (trackingError) {
      console.error("⚠️ Failed to use Autumn tracking:", trackingError)
      // Don't fail the deletion if tracking fails, just log it
    }

    console.log("✅ Successfully deleted domain and all associated resources")

    return {
      success: true,
      message: `Successfully deleted domain ${domain.domain} and all associated resources`,
      deletedResources: deletionStats,
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    response: {
      200: DeleteDomainResponse,
      401: DeleteDomainErrorResponse,
      404: DeleteDomainErrorResponse,
      409: DeleteDomainErrorResponse,
      500: DeleteDomainErrorResponse,
    },
    detail: {
      tags: ["Domains"],
      summary: "Delete domain",
      description:
        "Delete a domain and all associated resources including email addresses, DNS records, and SES configurations.",
    },
  }
)
