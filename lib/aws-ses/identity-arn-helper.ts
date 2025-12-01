/**
 * AWS SES Identity ARN Helper
 * 
 * Provides functions to get the correct identity ARN and configuration set
 * for sending emails to associate emails with tenants for proper tracking 
 * of sends, bounces, complaints.
 */

import { db } from '@/lib/db'
import { emailDomains, sesTenants } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

const awsRegion = process.env.AWS_REGION || 'us-east-2'
const awsAccountId = process.env.AWS_ACCOUNT_ID

/**
 * Result from getting tenant sending info
 * 
 * Per AWS docs (https://docs.aws.amazon.com/ses/latest/dg/tenants.html):
 * When sending email through a tenant, you must specify:
 * - TenantName: The AWS SES tenant name (required for tenant-level metrics)
 * - ConfigurationSetName: Must be associated with the tenant
 * - SourceArn: For cross-account or identity tracking
 */
export interface TenantSendingInfo {
  identityArn: string | null
  configurationSetName: string | null
  tenantName: string | null // AWS SES TenantName - REQUIRED for tenant metrics!
}

/**
 * Get the identity ARN for sending emails from a specific domain
 * This ARN is needed to associate the email with the tenant for tracking
 * 
 * @param userId - The user ID sending the email
 * @param fromDomain - The domain part of the sender's email address
 * @returns The identity ARN if found, null otherwise
 */
export async function getIdentityArnForSending(
  userId: string,
  fromDomain: string
): Promise<string | null> {
  const result = await getTenantSendingInfo(userId, fromDomain)
  return result.identityArn
}

/**
 * Get the tenant sending info (identity ARN and configuration set name)
 * This is the primary function that should be used for email sending
 * 
 * @param userId - The user ID sending the email
 * @param fromDomain - The domain part of the sender's email address
 * @returns Object with identityArn and configurationSetName
 */
export async function getTenantSendingInfo(
  userId: string,
  fromDomain: string
): Promise<TenantSendingInfo> {
  try {
    // Check if AWS_ACCOUNT_ID is configured
    if (!awsAccountId) {
      console.warn('⚠️ AWS_ACCOUNT_ID not configured - cannot build identity ARN for tenant tracking')
      return { identityArn: null, configurationSetName: null, tenantName: null }
    }

    // Look up the domain to verify it exists and get the tenant association
    const domainRecord = await db
      .select({
        domain: emailDomains.domain,
        tenantId: emailDomains.tenantId,
        userId: emailDomains.userId,
      })
      .from(emailDomains)
      .where(
        and(
          eq(emailDomains.domain, fromDomain),
          eq(emailDomains.userId, userId),
          eq(emailDomains.status, 'verified')
        )
      )
      .limit(1)

    if (domainRecord.length === 0) {
      console.log(`⚠️ Domain ${fromDomain} not found or not verified for user ${userId}`)
      return { identityArn: null, configurationSetName: null, tenantName: null }
    }

    const domain = domainRecord[0]
    let configurationSetName: string | null = null
    let tenantName: string | null = null

    // If the domain has a tenant association, get the configuration set name AND tenant name
    if (domain.tenantId) {
      const tenantRecord = await db
        .select({ 
          id: sesTenants.id,
          configurationSetName: sesTenants.configurationSetName,
          tenantName: sesTenants.tenantName // AWS SES tenant name
        })
        .from(sesTenants)
        .where(eq(sesTenants.id, domain.tenantId))
        .limit(1)

      if (tenantRecord.length === 0) {
        console.warn(`⚠️ Tenant ${domain.tenantId} not found for domain ${fromDomain}`)
      } else {
        configurationSetName = tenantRecord[0].configurationSetName
        tenantName = tenantRecord[0].tenantName
        
        if (tenantName) {
          console.log(`🏢 Found AWS SES tenant: ${tenantName}`)
        }
        if (configurationSetName) {
          console.log(`📋 Found configuration set for tenant: ${configurationSetName}`)
        } else {
          console.warn(`⚠️ Tenant ${domain.tenantId} has no configuration set - tenant-level tracking will not work`)
        }
      }
    }

    // Build the identity ARN
    // Format: arn:aws:ses:REGION:ACCOUNT_ID:identity/DOMAIN
    const identityArn = `arn:aws:ses:${awsRegion}:${awsAccountId}:identity/${fromDomain}`
    
    console.log(`✅ Built identity ARN for tenant tracking: ${identityArn}`)
    
    return { identityArn, configurationSetName, tenantName }

  } catch (error) {
    console.error(`❌ Error getting tenant sending info for ${fromDomain}:`, error)
    return { identityArn: null, configurationSetName: null, tenantName: null }
  }
}

/**
 * Get the identity ARN for the agent email (inbnd.dev)
 * This is used when sending from agent@inbnd.dev
 */
export function getAgentIdentityArn(): string | null {
  if (!awsAccountId) {
    console.warn('⚠️ AWS_ACCOUNT_ID not configured - cannot build agent identity ARN')
    return null
  }

  return `arn:aws:ses:${awsRegion}:${awsAccountId}:identity/inbnd.dev`
}

/**
 * Get the identity ARN for any verified domain
 * Useful when the domain might be a subdomain of a verified parent domain
 * 
 * @param userId - The user ID
 * @param fromDomain - The sending domain
 * @param parentDomain - Optional parent domain if fromDomain is a subdomain
 */
export async function getIdentityArnForDomainOrParent(
  userId: string,
  fromDomain: string,
  parentDomain?: string
): Promise<string | null> {
  const result = await getTenantSendingInfoForDomainOrParent(userId, fromDomain, parentDomain)
  return result.identityArn
}

/**
 * Get the complete tenant sending info (ARN + configuration set) for any verified domain
 * Useful when the domain might be a subdomain of a verified parent domain
 * 
 * @param userId - The user ID
 * @param fromDomain - The sending domain
 * @param parentDomain - Optional parent domain if fromDomain is a subdomain
 */
export async function getTenantSendingInfoForDomainOrParent(
  userId: string,
  fromDomain: string,
  parentDomain?: string
): Promise<TenantSendingInfo> {
  // First try the exact domain
  let result = await getTenantSendingInfo(userId, fromDomain)
  
  if (result.identityArn) {
    return result
  }

  // If not found and we have a parent domain, try that
  if (parentDomain && parentDomain !== fromDomain) {
    console.log(`🔍 Trying parent domain ${parentDomain} for tenant sending info`)
    result = await getTenantSendingInfo(userId, parentDomain)
    
    if (result.identityArn) {
      // Use the parent domain's info but note it's for a subdomain
      console.log(`✅ Using parent domain ${parentDomain} sending info for subdomain ${fromDomain}`)
      return result
    }
  }

  return { identityArn: null, configurationSetName: null, tenantName: null }
}

