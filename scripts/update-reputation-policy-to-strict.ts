/**
 * Migration Script: Update all tenant reputation policies to 'strict'
 * 
 * Run with: bun scripts/update-reputation-policy-to-strict.ts
 * 
 * This script will:
 * 1. Get all tenants from the database
 * 2. For each tenant, check the current reputation policy in AWS SES
 * 3. Update AWS SES reputation policy to 'strict' if not already set
 * 4. Update the database record to match
 * 5. Log all results and verification
 */

import {
  SESv2Client,
  GetReputationEntityCommand,
  UpdateReputationEntityPolicyCommand,
  GetTenantCommand,
} from '@aws-sdk/client-sesv2'
import { db } from '@/lib/db'
import { sesTenants } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

// AWS Configuration
const awsRegion = process.env.AWS_REGION || 'us-east-2'
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
const awsAccountId = process.env.AWS_ACCOUNT_ID

if (!awsAccessKeyId || !awsSecretAccessKey) {
  console.error('❌ AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.')
  process.exit(1)
}

if (!awsAccountId) {
  console.error('❌ AWS_ACCOUNT_ID not configured. Please set AWS_ACCOUNT_ID environment variable.')
  process.exit(1)
}

const sesClient = new SESv2Client({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  }
})

// Reputation policy ARNs (AWS managed policies)
const REPUTATION_POLICY_ARNS = {
  none: `arn:aws:ses:${awsRegion}:aws:reputation-policy/none`,
  standard: `arn:aws:ses:${awsRegion}:aws:reputation-policy/standard`,
  strict: `arn:aws:ses:${awsRegion}:aws:reputation-policy/strict`,
} as const

type ReputationPolicy = 'none' | 'standard' | 'strict'

interface TenantUpdateResult {
  tenantId: string
  tenantName: string
  awsTenantId: string
  dbPolicyBefore: string
  awsPolicyBefore: string | null
  awsPolicyAfter: string | null
  dbPolicyAfter: string
  status: 'updated' | 'already_strict' | 'aws_not_found' | 'error'
  error?: string
}

/**
 * Get the ARN for a tenant in AWS SES
 * Format: arn:aws:ses:{region}:{account-id}:tenant/{tenant-name}/{tenant-id}
 */
function getTenantArn(tenantName: string, awsTenantId: string): string {
  return `arn:aws:ses:${awsRegion}:${awsAccountId}:tenant/${tenantName}/${awsTenantId}`
}

/**
 * Extract policy name from ARN (e.g., "strict" from "arn:aws:ses:us-east-2:aws:reputation-policy/strict")
 */
function extractPolicyName(policyArn: string | undefined): string | null {
  if (!policyArn) return null
  const match = policyArn.match(/reputation-policy\/(none|standard|strict)$/)
  return match ? match[1] : policyArn
}

/**
 * Get the current reputation policy for a tenant from AWS SES
 */
async function getAwsReputationPolicy(tenantName: string, awsTenantId: string): Promise<{
  policy: string | null
  error?: string
}> {
  try {
    const tenantArn = getTenantArn(tenantName, awsTenantId)
    
    const response = await sesClient.send(new GetReputationEntityCommand({
      ReputationEntityType: 'RESOURCE',
      ReputationEntityReference: tenantArn,
    }))
    
    const policyArn = response.ReputationEntity?.ReputationManagementPolicy
    return { policy: extractPolicyName(policyArn) }
  } catch (error: any) {
    if (error?.name === 'NotFoundException') {
      return { policy: null, error: 'Tenant not found in AWS' }
    }
    return { policy: null, error: error.message }
  }
}

/**
 * Update the reputation policy for a tenant in AWS SES
 */
async function updateAwsReputationPolicy(
  tenantName: string,
  awsTenantId: string,
  policy: ReputationPolicy
): Promise<{ success: boolean; error?: string }> {
  try {
    const tenantArn = getTenantArn(tenantName, awsTenantId)
    const policyArn = REPUTATION_POLICY_ARNS[policy]
    
    await sesClient.send(new UpdateReputationEntityPolicyCommand({
      ReputationEntityType: 'RESOURCE',
      ReputationEntityReference: tenantArn,
      ReputationEntityPolicy: policyArn,
    }))
    
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Verify the tenant exists in AWS
 */
async function verifyTenantExists(tenantName: string): Promise<boolean> {
  try {
    await sesClient.send(new GetTenantCommand({ TenantName: tenantName }))
    return true
  } catch (error: any) {
    return false
  }
}

async function updateReputationPolicyToStrict() {
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('  Update All Tenant Reputation Policies to STRICT')
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log()
  console.log('This script will:')
  console.log('  1. Check all tenants in the database')
  console.log('  2. Verify each tenant exists in AWS SES')
  console.log('  3. Check and update AWS SES reputation policy to "strict"')
  console.log('  4. Update the database record to match')
  console.log()
  console.log(`AWS Region: ${awsRegion}`)
  console.log(`AWS Account: ${awsAccountId}`)
  console.log()

  try {
    // Step 1: Get all tenants from database
    const allTenants = await db
      .select()
      .from(sesTenants)

    console.log(`📋 Found ${allTenants.length} tenant(s) in database\n`)

    if (allTenants.length === 0) {
      console.log('✅ No tenants found - nothing to update')
      return
    }

    const results: TenantUpdateResult[] = []
    let updatedCount = 0
    let alreadyStrictCount = 0
    let notFoundCount = 0
    let errorCount = 0

    // Step 2: Process each tenant
    console.log('🔄 Processing tenants...\n')
    console.log('─'.repeat(70))

    for (const tenant of allTenants) {
      console.log(`\n📦 ${tenant.tenantName} (${tenant.id})`)
      console.log(`   AWS Tenant ID: ${tenant.awsTenantId}`)
      console.log(`   DB Policy: ${tenant.reputationPolicy}`)

      const result: TenantUpdateResult = {
        tenantId: tenant.id,
        tenantName: tenant.tenantName,
        awsTenantId: tenant.awsTenantId,
        dbPolicyBefore: tenant.reputationPolicy,
        awsPolicyBefore: null,
        awsPolicyAfter: null,
        dbPolicyAfter: tenant.reputationPolicy,
        status: 'error',
      }

      // Verify tenant exists in AWS
      const tenantExists = await verifyTenantExists(tenant.tenantName)
      if (!tenantExists) {
        console.log(`   ⚠️  Tenant not found in AWS - skipping`)
        result.status = 'aws_not_found'
        result.error = 'Tenant not found in AWS'
        results.push(result)
        notFoundCount++
        continue
      }

      // Get current AWS policy
      const { policy: awsPolicy, error: getError } = await getAwsReputationPolicy(tenant.tenantName, tenant.awsTenantId)
      result.awsPolicyBefore = awsPolicy
      
      if (getError && !awsPolicy) {
        console.log(`   ⚠️  Could not get AWS policy: ${getError}`)
        // Continue anyway - we'll try to set the policy
      } else {
        console.log(`   AWS Policy: ${awsPolicy || 'not set'}`)
      }

      // Check if already strict in both DB and AWS
      if (tenant.reputationPolicy === 'strict' && awsPolicy === 'strict') {
        console.log(`   ✅ Already set to 'strict' in both DB and AWS`)
        result.awsPolicyAfter = 'strict'
        result.dbPolicyAfter = 'strict'
        result.status = 'already_strict'
        results.push(result)
        alreadyStrictCount++
        continue
      }

      // Update AWS if needed
      if (awsPolicy !== 'strict') {
        console.log(`   🔄 Updating AWS policy to 'strict'...`)
        const { success, error: updateError } = await updateAwsReputationPolicy(
          tenant.tenantName,
          tenant.awsTenantId,
          'strict'
        )

        if (!success) {
          console.log(`   ❌ Failed to update AWS policy: ${updateError}`)
          result.error = updateError
          result.status = 'error'
          results.push(result)
          errorCount++
          continue
        }

        console.log(`   ✅ AWS policy updated to 'strict'`)
        result.awsPolicyAfter = 'strict'
      } else {
        result.awsPolicyAfter = 'strict'
      }

      // Update database if needed
      if (tenant.reputationPolicy !== 'strict') {
        console.log(`   🔄 Updating database to 'strict'...`)
        await db
          .update(sesTenants)
          .set({
            reputationPolicy: 'strict',
            updatedAt: new Date(),
          })
          .where(eq(sesTenants.id, tenant.id))
        
        console.log(`   ✅ Database updated to 'strict'`)
        result.dbPolicyAfter = 'strict'
      }

      result.status = 'updated'
      results.push(result)
      updatedCount++

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Step 3: Verification pass
    console.log('\n' + '─'.repeat(70))
    console.log('\n🔍 Verification pass...\n')

    let verifySuccessCount = 0
    let verifyFailCount = 0

    for (const tenant of allTenants) {
      // Re-check AWS policy
      const { policy: currentAwsPolicy } = await getAwsReputationPolicy(tenant.tenantName, tenant.awsTenantId)
      
      // Re-check database
      const [dbTenant] = await db
        .select()
        .from(sesTenants)
        .where(eq(sesTenants.id, tenant.id))
        .limit(1)

      const awsOk = currentAwsPolicy === 'strict' || currentAwsPolicy === null // null is ok if tenant doesn't exist in AWS
      const dbOk = dbTenant?.reputationPolicy === 'strict'

      if (awsOk && dbOk) {
        verifySuccessCount++
      } else {
        verifyFailCount++
        console.log(`   ⚠️  ${tenant.tenantName}: AWS=${currentAwsPolicy}, DB=${dbTenant?.reputationPolicy}`)
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Final summary
    console.log('\n' + '═'.repeat(70))
    console.log('📊 FINAL SUMMARY')
    console.log('═'.repeat(70))
    console.log(`Total tenants:           ${allTenants.length}`)
    console.log(`Updated to strict:       ${updatedCount}`)
    console.log(`Already strict:          ${alreadyStrictCount}`)
    console.log(`Not found in AWS:        ${notFoundCount}`)
    console.log(`Errors:                  ${errorCount}`)
    console.log('─'.repeat(70))
    console.log(`Verification passed:     ${verifySuccessCount}`)
    console.log(`Verification failed:     ${verifyFailCount}`)
    console.log('═'.repeat(70))

    // Log final policy distribution in database
    const policyCounts = await db
      .select({
        reputationPolicy: sesTenants.reputationPolicy,
        count: sql<number>`count(*)`,
      })
      .from(sesTenants)
      .groupBy(sesTenants.reputationPolicy)

    console.log('\n📈 Database policy distribution:')
    for (const row of policyCounts) {
      console.log(`   - ${row.reputationPolicy}: ${row.count} tenant(s)`)
    }

    if (errorCount > 0) {
      console.log('\n⚠️  Some tenants had errors. Review the output above for details.')
    }

    if (notFoundCount > 0) {
      console.log('\n⚠️  Some tenants were not found in AWS. They may need to be recreated.')
    }

    console.log('\n🏁 Done!')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
updateReputationPolicyToStrict()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
