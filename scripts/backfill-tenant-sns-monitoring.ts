/**
 * Backfill SNS Topics and CloudWatch Alarms for Existing Tenants
 * 
 * This script sets up SNS topics and CloudWatch alarms for tenants that were created
 * before the monitoring feature was added.
 * 
 * Run with: bun run scripts/backfill-tenant-sns-monitoring.ts
 * 
 * What it does for each tenant:
 * 1. Creates SNS topic: ses-{configSetName}-events
 * 2. Creates SNS topic: ses-{configSetName}-alerts
 * 3. Subscribes webhook to both topics
 * 4. Creates SES → SNS event destination
 * 5. Creates CloudWatch alarms for bounce/complaint rates
 * 
 * Prerequisites:
 * - AWS credentials configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * - AWS_ACCOUNT_ID environment variable set
 * - SES_WEBHOOK_URL environment variable set (or uses default)
 * - Database connection configured
 */

import { db } from '@/lib/db'
import { sesTenants } from '@/lib/db/schema'
import { isNotNull } from 'drizzle-orm'
import { sesTenantManager } from '@/lib/aws-ses/aws-ses-tenants'

// Configuration
const DRY_RUN = process.argv.includes('--dry-run')
const DELAY_MS = 1000 // Delay between tenants to avoid rate limiting

async function backfillTenantSnsMonitoring() {
  console.log('🚀 Starting tenant SNS/CloudWatch monitoring backfill...')
  console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE'}\n`)

  if (!sesTenantManager) {
    console.error('❌ AWS SES not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.')
    process.exit(1)
  }

  if (!process.env.AWS_ACCOUNT_ID) {
    console.error('❌ AWS_ACCOUNT_ID environment variable not set.')
    console.error('   Export it with: export AWS_ACCOUNT_ID=your-account-id')
    process.exit(1)
  }

  const webhookUrl = process.env.SES_WEBHOOK_URL || 'https://inbound.new/api/inbound/health/tenant'
  console.log(`📧 Webhook URL: ${webhookUrl}`)
  console.log(`🌍 AWS Region: ${process.env.AWS_REGION || 'us-east-2'}`)
  console.log(`🔐 AWS Account: ${process.env.AWS_ACCOUNT_ID}\n`)

  // Get all tenants WITH a configuration set (monitoring requires config set)
  const tenantsWithConfigSet = await db
    .select()
    .from(sesTenants)
    .where(isNotNull(sesTenants.configurationSetName))

  console.log(`📋 Found ${tenantsWithConfigSet.length} tenant(s) with configuration sets\n`)

  if (tenantsWithConfigSet.length === 0) {
    console.log('⚠️ No tenants found with configuration sets!')
    console.log('   Run the configuration set backfill first: bun run scripts/backfill-tenant-configuration-sets.ts')
    return
  }

  let successCount = 0
  let failCount = 0
  let skippedCount = 0
  const errors: { tenantId: string; configSetName: string; error: string }[] = []

  for (let i = 0; i < tenantsWithConfigSet.length; i++) {
    const tenant = tenantsWithConfigSet[i]
    const configSetName = tenant.configurationSetName!

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`🏢 [${i + 1}/${tenantsWithConfigSet.length}] Processing tenant: ${tenant.tenantName}`)
    console.log(`   Tenant ID: ${tenant.id}`)
    console.log(`   Config Set: ${configSetName}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    if (DRY_RUN) {
      console.log(`   [DRY RUN] Would setup monitoring for: ${configSetName}`)
      skippedCount++
      continue
    }

    try {
      const result = await sesTenantManager.setupTenantMonitoring(configSetName)
      
      if (result.success) {
        console.log(`✅ Success!`)
        if (result.snsTopicArn) console.log(`   Events Topic: ${result.snsTopicArn}`)
        if (result.alertTopicArn) console.log(`   Alerts Topic: ${result.alertTopicArn}`)
        successCount++
      } else {
        console.error(`❌ Failed: ${result.error}`)
        failCount++
        errors.push({ 
          tenantId: tenant.id, 
          configSetName, 
          error: result.error || 'Unknown error' 
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error(`❌ Exception: ${errorMessage}`)
      failCount++
      errors.push({ tenantId: tenant.id, configSetName, error: errorMessage })
    }

    // Delay to avoid rate limiting (AWS API limits)
    if (i < tenantsWithConfigSet.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 BACKFILL SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Total tenants: ${tenantsWithConfigSet.length}`)
  
  if (DRY_RUN) {
    console.log(`📋 Dry run: ${skippedCount} would be processed`)
  } else {
    console.log(`✅ Successful: ${successCount}`)
    console.log(`❌ Failed: ${failCount}`)
  }

  if (errors.length > 0) {
    console.log('\n❌ ERRORS:')
    for (const err of errors) {
      console.log(`   - ${err.configSetName}: ${err.error}`)
    }
  }

  console.log('\n🏁 Backfill complete!')
  
  if (DRY_RUN) {
    console.log('\n💡 To run for real, remove the --dry-run flag:')
    console.log('   bun run scripts/backfill-tenant-sns-monitoring.ts')
  }
}

// Run the backfill
backfillTenantSnsMonitoring()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })

