/**
 * Add CloudWatch Event Destinations to Existing Configuration Sets
 * 
 * This script adds CloudWatch event destinations to existing tenant configuration sets
 * so that metrics (sends, bounces, complaints) are properly tracked.
 * 
 * Run with: bun run scripts/add-cloudwatch-to-config-sets.ts
 */

import { 
  SESv2Client, 
  CreateConfigurationSetEventDestinationCommand,
  GetConfigurationSetEventDestinationsCommand,
  EventType 
} from '@aws-sdk/client-sesv2'
import { db } from '@/lib/db'
import { sesTenants } from '@/lib/db/schema'
import { isNotNull } from 'drizzle-orm'

const awsRegion = process.env.AWS_REGION || 'us-east-2'
const sesClient = new SESv2Client({ region: awsRegion })

async function addCloudWatchToConfigSets() {
  console.log('🚀 Starting CloudWatch event destination setup...\n')

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

  let successCount = 0
  let skipCount = 0
  let failCount = 0

  for (const tenant of tenantsWithConfigSets) {
    const configSetName = tenant.configurationSetName!
    const eventDestName = `${configSetName}-cloudwatch`

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`🏢 Processing: ${tenant.tenantName}`)
    console.log(`   Config Set: ${configSetName}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    // Check if event destination already exists
    try {
      const existingDestinations = await sesClient.send(new GetConfigurationSetEventDestinationsCommand({
        ConfigurationSetName: configSetName
      }))

      const hasCloudWatch = existingDestinations.EventDestinations?.some(
        dest => dest.Name === eventDestName || dest.CloudWatchDestination
      )

      if (hasCloudWatch) {
        console.log(`⏭️  CloudWatch event destination already exists, skipping`)
        skipCount++
        continue
      }
    } catch (error: any) {
      if (error?.name === 'NotFoundException') {
        console.log(`⚠️ Configuration set not found in AWS: ${configSetName}`)
        failCount++
        continue
      }
      // Other errors - continue to try adding
    }

    // Add CloudWatch event destination
    try {
      const eventDestinationCommand = new CreateConfigurationSetEventDestinationCommand({
        ConfigurationSetName: configSetName,
        EventDestinationName: eventDestName,
        EventDestination: {
          Enabled: true,
          MatchingEventTypes: [
            EventType.SEND,
            EventType.DELIVERY,
            EventType.BOUNCE,
            EventType.COMPLAINT,
            EventType.REJECT,
            EventType.RENDERING_FAILURE
          ],
          CloudWatchDestination: {
            DimensionConfigurations: [
              {
                DimensionName: 'TenantId',
                DimensionValueSource: 'MESSAGE_TAG',
                DefaultDimensionValue: tenant.awsTenantId
              },
              {
                DimensionName: 'ConfigurationSet',
                DimensionValueSource: 'MESSAGE_TAG',
                DefaultDimensionValue: configSetName
              }
            ]
          }
        }
      })

      await sesClient.send(eventDestinationCommand)
      console.log(`✅ CloudWatch event destination added successfully!`)
      successCount++
    } catch (error: any) {
      if (error?.name === 'AlreadyExistsException') {
        console.log(`⏭️  Event destination already exists`)
        skipCount++
      } else {
        console.error(`❌ Failed to add event destination:`, error.message)
        failCount++
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Total processed: ${tenantsWithConfigSets.length}`)
  console.log(`✅ Added: ${successCount}`)
  console.log(`⏭️  Skipped (already exists): ${skipCount}`)
  console.log(`❌ Failed: ${failCount}`)
  console.log('\n🏁 Done!')
  
  if (successCount > 0) {
    console.log('\n📈 Metrics should start appearing in CloudWatch within 15-30 minutes.')
    console.log('   Check SES Console → Configuration Sets → [your-config-set] → Reputation metrics')
  }
}

// Run
addCloudWatchToConfigSets()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })

