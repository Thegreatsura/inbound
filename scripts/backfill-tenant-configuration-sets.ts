/**
 * Backfill Configuration Sets for Existing SES Tenants
 * 
 * This script creates configuration sets for existing tenants and associates them.
 * Run with: bun run scripts/backfill-tenant-configuration-sets.ts
 * 
 * Prerequisites:
 * - AWS credentials configured
 * - Database connection configured
 * - Run the migration to add configuration_set_name column first
 */

import { db } from '@/lib/db'
import { sesTenants } from '@/lib/db/schema'
import { isNull } from 'drizzle-orm'
import { SESTenantManager, sesTenantManager } from '@/lib/aws-ses/aws-ses-tenants'

async function backfillTenantConfigurationSets() {
  console.log('🚀 Starting tenant configuration set backfill...\n')

  if (!sesTenantManager) {
    console.error('❌ AWS SES not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.')
    process.exit(1)
  }

  // Get all tenants without a configuration set
  const tenantsWithoutConfigSet = await db
    .select()
    .from(sesTenants)
    .where(isNull(sesTenants.configurationSetName))

  console.log(`📋 Found ${tenantsWithoutConfigSet.length} tenant(s) without configuration sets\n`)

  if (tenantsWithoutConfigSet.length === 0) {
    console.log('✅ All tenants already have configuration sets!')
    return
  }

  let successCount = 0
  let failCount = 0
  const errors: { tenantId: string; error: string }[] = []

  for (const tenant of tenantsWithoutConfigSet) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`🏢 Processing tenant: ${tenant.tenantName} (${tenant.id})`)
    console.log(`   User ID: ${tenant.userId}`)
    console.log(`   AWS Tenant ID: ${tenant.awsTenantId}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    try {
      const result = await sesTenantManager.createConfigurationSetForTenant(tenant.id)
      
      if (result.success) {
        console.log(`✅ Success! Configuration set: ${result.configSetName}`)
        successCount++
      } else {
        console.error(`❌ Failed: ${result.error}`)
        failCount++
        errors.push({ tenantId: tenant.id, error: result.error || 'Unknown error' })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`❌ Exception: ${errorMessage}`)
      failCount++
      errors.push({ tenantId: tenant.id, error: errorMessage })
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 BACKFILL SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Total tenants processed: ${tenantsWithoutConfigSet.length}`)
  console.log(`✅ Successful: ${successCount}`)
  console.log(`❌ Failed: ${failCount}`)

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:')
    for (const err of errors) {
      console.log(`   - ${err.tenantId}: ${err.error}`)
    }
  }

  console.log('\n🏁 Backfill complete!')
}

// Run the backfill
backfillTenantConfigurationSets()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })

