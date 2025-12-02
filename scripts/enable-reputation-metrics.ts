/**
 * Enable Reputation Metrics for All Configuration Sets
 * 
 * This script enables reputation metrics tracking for all existing tenant
 * configuration sets. Once enabled, CloudWatch will receive bounce and
 * complaint rate metrics that can be queried via GetMetricData.
 * 
 * Run with: bun run scripts/enable-reputation-metrics.ts
 * 
 * What this does:
 * - Queries all tenants with configuration sets from the database
 * - Enables ReputationMetricsEnabled for each configuration set
 * - This allows CloudWatch to receive Reputation.BounceRate and Reputation.ComplaintRate metrics
 * 
 * Note: New tenants already have this enabled (see lib/aws-ses/aws-ses-tenants.ts)
 */

import { 
  SESv2Client, 
  GetConfigurationSetCommand,
  PutConfigurationSetReputationOptionsCommand
} from '@aws-sdk/client-sesv2'
import { db } from '@/lib/db'
import { sesTenants } from '@/lib/db/schema'
import { isNotNull } from 'drizzle-orm'

const awsRegion = process.env.AWS_REGION || 'us-east-2'
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

if (!awsAccessKeyId || !awsSecretAccessKey) {
  console.error('❌ AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.')
  process.exit(1)
}

const sesClient = new SESv2Client({ 
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  }
})

interface ConfigSetStatus {
  configSetName: string
  tenantName: string
  awsTenantId: string
  reputationEnabled: boolean | null
  error?: string
}

async function checkConfigSetStatus(configSetName: string): Promise<{ exists: boolean; reputationEnabled: boolean }> {
  try {
    const response = await sesClient.send(new GetConfigurationSetCommand({
      ConfigurationSetName: configSetName
    }))
    
    return {
      exists: true,
      reputationEnabled: response.ReputationOptions?.ReputationMetricsEnabled || false
    }
  } catch (error: any) {
    if (error?.name === 'NotFoundException') {
      return { exists: false, reputationEnabled: false }
    }
    throw error
  }
}

async function enableReputationMetrics(configSetName: string): Promise<void> {
  await sesClient.send(new PutConfigurationSetReputationOptionsCommand({
    ConfigurationSetName: configSetName,
    ReputationMetricsEnabled: true
  }))
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('  Enable Reputation Metrics for Configuration Sets')
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log()
  console.log('This script enables reputation metrics tracking for all tenant')
  console.log('configuration sets, allowing CloudWatch to receive bounce and')
  console.log('complaint rate metrics.')
  console.log()

  // Get all tenants with configuration sets
  const tenantsWithConfigSets = await db
    .select()
    .from(sesTenants)
    .where(isNotNull(sesTenants.configurationSetName))

  console.log(`📋 Found ${tenantsWithConfigSets.length} tenant(s) with configuration sets\n`)

  if (tenantsWithConfigSets.length === 0) {
    console.log('✅ No tenants with configuration sets found!')
    return
  }

  const results: ConfigSetStatus[] = []
  let enabledCount = 0
  let alreadyEnabledCount = 0
  let notFoundCount = 0
  let errorCount = 0

  // First pass: Check current status
  console.log('🔍 Checking current status of all configuration sets...\n')
  
  for (const tenant of tenantsWithConfigSets) {
    const configSetName = tenant.configurationSetName!
    
    try {
      const status = await checkConfigSetStatus(configSetName)
      
      if (!status.exists) {
        results.push({
          configSetName,
          tenantName: tenant.tenantName,
          awsTenantId: tenant.awsTenantId,
          reputationEnabled: null,
          error: 'Configuration set not found in AWS'
        })
        notFoundCount++
        console.log(`⚠️  ${tenant.tenantName}: Config set not found in AWS`)
      } else if (status.reputationEnabled) {
        results.push({
          configSetName,
          tenantName: tenant.tenantName,
          awsTenantId: tenant.awsTenantId,
          reputationEnabled: true
        })
        alreadyEnabledCount++
        console.log(`✓  ${tenant.tenantName}: Already enabled`)
      } else {
        results.push({
          configSetName,
          tenantName: tenant.tenantName,
          awsTenantId: tenant.awsTenantId,
          reputationEnabled: false
        })
        console.log(`○  ${tenant.tenantName}: Needs to be enabled`)
      }
    } catch (error: any) {
      results.push({
        configSetName,
        tenantName: tenant.tenantName,
        awsTenantId: tenant.awsTenantId,
        reputationEnabled: null,
        error: error.message
      })
      errorCount++
      console.log(`❌ ${tenant.tenantName}: Error - ${error.message}`)
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  // Get config sets that need updating
  const configSetsToUpdate = results.filter(r => r.reputationEnabled === false)

  console.log('\n───────────────────────────────────────────────────────────────────')
  console.log(`📊 Status Summary:`)
  console.log(`   Already enabled: ${alreadyEnabledCount}`)
  console.log(`   Need enabling:   ${configSetsToUpdate.length}`)
  console.log(`   Not found:       ${notFoundCount}`)
  console.log(`   Errors:          ${errorCount}`)
  console.log('───────────────────────────────────────────────────────────────────\n')

  if (configSetsToUpdate.length === 0) {
    console.log('✅ All configuration sets already have reputation metrics enabled!')
    return
  }

  // Second pass: Enable reputation metrics
  console.log(`🔧 Enabling reputation metrics for ${configSetsToUpdate.length} configuration set(s)...\n`)

  for (const configSet of configSetsToUpdate) {
    try {
      await enableReputationMetrics(configSet.configSetName)
      enabledCount++
      console.log(`✅ ${configSet.tenantName}: Enabled reputation metrics`)
    } catch (error: any) {
      errorCount++
      console.log(`❌ ${configSet.tenantName}: Failed - ${error.message}`)
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  // Final summary
  console.log('\n═══════════════════════════════════════════════════════════════════')
  console.log('📊 FINAL SUMMARY')
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log(`Total configuration sets:     ${tenantsWithConfigSets.length}`)
  console.log(`Previously enabled:           ${alreadyEnabledCount}`)
  console.log(`Newly enabled:                ${enabledCount}`)
  console.log(`Not found in AWS:             ${notFoundCount}`)
  console.log(`Errors:                       ${errorCount}`)
  console.log('═══════════════════════════════════════════════════════════════════')

  if (enabledCount > 0) {
    console.log('\n📈 Next Steps:')
    console.log('   • Metrics will start appearing in CloudWatch within 15-30 minutes')
    console.log('   • Also run: bun run scripts/add-cloudwatch-to-config-sets.ts')
    console.log('     to add CloudWatch event destinations for detailed per-tenant metrics')
    console.log('   • Check SES Console → Account Dashboard → Reputation metrics')
  }

  console.log('\n🏁 Done!')
}

// Run
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })

