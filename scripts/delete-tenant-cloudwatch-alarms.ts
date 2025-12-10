/**
 * Delete Per-Tenant CloudWatch Alarms
 *
 * This script deletes all per-tenant SES CloudWatch alarms to reduce costs.
 * These alarms were costing ~$165/month (1,652 alarms × $0.10 each).
 *
 * We're replacing them with SNS event-based monitoring in the webhook handler.
 *
 * Run with: bun run scripts/delete-tenant-cloudwatch-alarms.ts
 * Dry run:  bun run scripts/delete-tenant-cloudwatch-alarms.ts --dry-run
 */

import {
  CloudWatchClient,
  DescribeAlarmsCommand,
  DeleteAlarmsCommand
} from '@aws-sdk/client-cloudwatch'

const DRY_RUN = process.argv.includes('--dry-run')
const BATCH_SIZE = 100 // AWS allows max 100 alarms per delete call
const DELAY_MS = 500 // Delay between batches to avoid rate limiting

// AWS Client Setup
const awsRegion = process.env.AWS_REGION || 'us-east-2'
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

if (!awsAccessKeyId || !awsSecretAccessKey) {
  console.error('❌ AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.')
  process.exit(1)
}

const cloudWatchClient = new CloudWatchClient({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  }
})

// Patterns to match per-tenant alarms (these are the expensive ones)
const ALARM_PATTERNS = [
  'SES-BounceRate-5%-tenant-',
  'SES-BounceRate-7%-tenant-',
  'SES-ComplaintRate-0.1%-tenant-',
  'SES-ComplaintRate-0.3%-tenant-',
]

async function getAllTenantAlarms(): Promise<string[]> {
  console.log('🔍 Fetching all CloudWatch alarms...')

  const allAlarmNames: string[] = []
  let nextToken: string | undefined

  do {
    const command = new DescribeAlarmsCommand({
      NextToken: nextToken,
      MaxRecords: 100
    })

    const response = await cloudWatchClient.send(command)

    if (response.MetricAlarms) {
      for (const alarm of response.MetricAlarms) {
        if (alarm.AlarmName) {
          // Check if this alarm matches any of our per-tenant patterns
          const isPerTenantAlarm = ALARM_PATTERNS.some(pattern =>
            alarm.AlarmName!.startsWith(pattern)
          )

          if (isPerTenantAlarm) {
            allAlarmNames.push(alarm.AlarmName)
          }
        }
      }
    }

    nextToken = response.NextToken
  } while (nextToken)

  return allAlarmNames
}

async function deleteAlarmBatch(alarmNames: string[]): Promise<{ success: number; failed: number }> {
  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would delete ${alarmNames.length} alarms`)
    return { success: alarmNames.length, failed: 0 }
  }

  try {
    const command = new DeleteAlarmsCommand({
      AlarmNames: alarmNames
    })

    await cloudWatchClient.send(command)
    return { success: alarmNames.length, failed: 0 }
  } catch (error) {
    console.error(`   ❌ Failed to delete batch:`, error)
    return { success: 0, failed: alarmNames.length }
  }
}

async function deleteAllTenantAlarms() {
  console.log('🚀 Starting CloudWatch alarm cleanup...')
  console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE'}`)
  console.log(`🌍 Region: ${awsRegion}\n`)

  // Get all per-tenant alarms
  const alarmNames = await getAllTenantAlarms()

  console.log(`\n📊 Found ${alarmNames.length} per-tenant alarms to delete`)

  if (alarmNames.length === 0) {
    console.log('✅ No per-tenant alarms found. Nothing to delete.')
    return
  }

  // Show breakdown by type
  const breakdown: Record<string, number> = {}
  for (const name of alarmNames) {
    for (const pattern of ALARM_PATTERNS) {
      if (name.startsWith(pattern)) {
        breakdown[pattern] = (breakdown[pattern] || 0) + 1
        break
      }
    }
  }

  console.log('\n📈 Breakdown by type:')
  for (const [pattern, count] of Object.entries(breakdown)) {
    console.log(`   ${pattern}*: ${count}`)
  }

  const estimatedMonthlySavings = alarmNames.length * 0.10
  console.log(`\n💰 Estimated monthly savings: $${estimatedMonthlySavings.toFixed(2)}`)

  // Delete in batches
  console.log(`\n🗑️  Deleting alarms in batches of ${BATCH_SIZE}...`)

  let totalSuccess = 0
  let totalFailed = 0
  const totalBatches = Math.ceil(alarmNames.length / BATCH_SIZE)

  for (let i = 0; i < alarmNames.length; i += BATCH_SIZE) {
    const batch = alarmNames.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1

    console.log(`\n   Batch ${batchNum}/${totalBatches} (${batch.length} alarms)...`)

    const result = await deleteAlarmBatch(batch)
    totalSuccess += result.success
    totalFailed += result.failed

    if (result.success > 0) {
      console.log(`   ✅ Deleted ${result.success} alarms`)
    }
    if (result.failed > 0) {
      console.log(`   ❌ Failed to delete ${result.failed} alarms`)
    }

    // Delay between batches
    if (i + BATCH_SIZE < alarmNames.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }
  }

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 DELETION SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  if (DRY_RUN) {
    console.log(`📋 Dry run complete: ${alarmNames.length} alarms would be deleted`)
    console.log(`💰 Potential monthly savings: $${estimatedMonthlySavings.toFixed(2)}`)
    console.log('\n💡 To delete for real, remove the --dry-run flag:')
    console.log('   bun run scripts/delete-tenant-cloudwatch-alarms.ts')
  } else {
    console.log(`✅ Successfully deleted: ${totalSuccess}`)
    console.log(`❌ Failed: ${totalFailed}`)
    console.log(`💰 Monthly savings: $${(totalSuccess * 0.10).toFixed(2)}`)
  }

  console.log('\n🏁 Cleanup complete!')
}

// Run the cleanup
deleteAllTenantAlarms()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })
