/**
 * Refresh SNS Subscriptions for Auto-Confirmation
 * 
 * This script deletes and recreates all HTTPS SNS subscriptions for tenant
 * monitoring topics to trigger the auto-confirmation flow.
 * 
 * Run with: bun run scripts/refresh-sns-subscriptions.ts
 * Dry run:  bun run scripts/refresh-sns-subscriptions.ts --dry-run
 * 
 * What it does:
 * 1. Lists all SNS topics matching ses-tenant-* pattern
 * 2. For each topic, lists all subscriptions
 * 3. Unsubscribes HTTPS endpoints that are pending or confirmed
 * 4. Re-subscribes the webhook endpoint (triggers auto-confirmation)
 * 
 * Prerequisites:
 * - AWS credentials configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
 * - Endpoint at /api/inbound/health/tenant must be deployed with auto-confirm
 */

import { 
  SNSClient, 
  ListTopicsCommand,
  ListSubscriptionsByTopicCommand,
  UnsubscribeCommand,
  SubscribeCommand
} from '@aws-sdk/client-sns'

// Configuration
const DRY_RUN = process.argv.includes('--dry-run')
const DELAY_MS = 500 // Delay between operations to avoid rate limiting
const WEBHOOK_URL = process.env.SES_WEBHOOK_URL || 'https://inbound.new/api/inbound/health/tenant'
const AWS_REGION = process.env.AWS_REGION || 'us-east-2'

// Initialize SNS client
const snsClient = new SNSClient({ region: AWS_REGION })

interface SubscriptionInfo {
  topicArn: string
  subscriptionArn: string
  endpoint: string
  protocol: string
  status: 'pending' | 'confirmed' | 'unknown'
}

async function listAllTopics(): Promise<string[]> {
  const topics: string[] = []
  let nextToken: string | undefined

  do {
    const command = new ListTopicsCommand({ NextToken: nextToken })
    const response = await snsClient.send(command)
    
    if (response.Topics) {
      for (const topic of response.Topics) {
        if (topic.TopicArn) {
          topics.push(topic.TopicArn)
        }
      }
    }
    
    nextToken = response.NextToken
  } while (nextToken)

  return topics
}

async function getTopicSubscriptions(topicArn: string): Promise<SubscriptionInfo[]> {
  const subscriptions: SubscriptionInfo[] = []
  let nextToken: string | undefined

  do {
    const command = new ListSubscriptionsByTopicCommand({ 
      TopicArn: topicArn,
      NextToken: nextToken 
    })
    const response = await snsClient.send(command)
    
    if (response.Subscriptions) {
      for (const sub of response.Subscriptions) {
        if (sub.SubscriptionArn && sub.Endpoint && sub.Protocol) {
          // PendingConfirmation means the subscription hasn't been confirmed yet
          const isPending = sub.SubscriptionArn === 'PendingConfirmation'
          
          subscriptions.push({
            topicArn,
            subscriptionArn: sub.SubscriptionArn,
            endpoint: sub.Endpoint,
            protocol: sub.Protocol,
            status: isPending ? 'pending' : 'confirmed'
          })
        }
      }
    }
    
    nextToken = response.NextToken
  } while (nextToken)

  return subscriptions
}

async function unsubscribe(subscriptionArn: string): Promise<boolean> {
  try {
    // Can't unsubscribe pending subscriptions - they just need to be re-created
    if (subscriptionArn === 'PendingConfirmation') {
      return true // Nothing to unsubscribe, but we can proceed
    }

    const command = new UnsubscribeCommand({ SubscriptionArn: subscriptionArn })
    await snsClient.send(command)
    return true
  } catch (error) {
    console.error(`   ❌ Failed to unsubscribe: ${error}`)
    return false
  }
}

async function subscribe(topicArn: string, endpoint: string): Promise<boolean> {
  try {
    const command = new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'https',
      Endpoint: endpoint,
      ReturnSubscriptionArn: true
    })
    await snsClient.send(command)
    return true
  } catch (error) {
    console.error(`   ❌ Failed to subscribe: ${error}`)
    return false
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function refreshSnsSubscriptions() {
  console.log('🔄 SNS Subscription Refresh Script')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📋 Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE'}`)
  console.log(`🌍 AWS Region: ${AWS_REGION}`)
  console.log(`📧 Webhook URL: ${WEBHOOK_URL}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Step 1: List all topics
  console.log('📋 Listing all SNS topics...')
  const allTopics = await listAllTopics()
  console.log(`   Found ${allTopics.length} total topics`)

  // Filter to only tenant-related topics (events and alerts)
  const tenantTopics = allTopics.filter(arn => 
    arn.includes('ses-tenant-') && (arn.includes('-events') || arn.includes('-alerts'))
  )
  console.log(`   Found ${tenantTopics.length} tenant monitoring topics\n`)

  if (tenantTopics.length === 0) {
    console.log('⚠️ No tenant monitoring topics found!')
    console.log('   Topics should match pattern: ses-tenant-*-events or ses-tenant-*-alerts')
    return
  }

  // Stats
  let topicsProcessed = 0
  let subscriptionsRefreshed = 0
  let pendingFound = 0
  let errors = 0

  // Step 2: Process each topic
  for (const topicArn of tenantTopics) {
    const topicName = topicArn.split(':').pop() || topicArn
    console.log(`\n📢 Processing: ${topicName}`)
    
    // Get subscriptions for this topic
    const subscriptions = await getTopicSubscriptions(topicArn)
    const httpsSubscriptions = subscriptions.filter(s => s.protocol === 'https')
    
    console.log(`   Found ${httpsSubscriptions.length} HTTPS subscription(s)`)
    
    if (httpsSubscriptions.length === 0) {
      // No subscriptions exist - create one
      console.log(`   🆕 No existing subscriptions, creating new one...`)
      
      if (DRY_RUN) {
        console.log(`   [DRY RUN] Would subscribe: ${WEBHOOK_URL}`)
      } else {
        const success = await subscribe(topicArn, WEBHOOK_URL)
        if (success) {
          console.log(`   ✅ Subscribed successfully (will auto-confirm)`)
          subscriptionsRefreshed++
        } else {
          errors++
        }
      }
    } else {
      // Process existing subscriptions
      for (const sub of httpsSubscriptions) {
        const statusEmoji = sub.status === 'pending' ? '⏳' : '✅'
        console.log(`   ${statusEmoji} ${sub.status}: ${sub.endpoint}`)
        
        if (sub.status === 'pending') {
          pendingFound++
        }

        if (DRY_RUN) {
          if (sub.status === 'confirmed') {
            console.log(`   [DRY RUN] Would unsubscribe and re-subscribe`)
          } else {
            console.log(`   [DRY RUN] Would create new subscription (pending can't be unsubscribed)`)
          }
        } else {
          // Unsubscribe if confirmed
          if (sub.status === 'confirmed') {
            console.log(`   🗑️ Unsubscribing...`)
            const unsubSuccess = await unsubscribe(sub.subscriptionArn)
            if (!unsubSuccess) {
              errors++
              continue
            }
            await delay(DELAY_MS)
          }
          
          // Re-subscribe with webhook URL
          console.log(`   🔗 Re-subscribing ${WEBHOOK_URL}...`)
          const subSuccess = await subscribe(topicArn, WEBHOOK_URL)
          if (subSuccess) {
            console.log(`   ✅ Subscription created (will auto-confirm via webhook)`)
            subscriptionsRefreshed++
          } else {
            errors++
          }
        }
        
        await delay(DELAY_MS)
      }
    }
    
    topicsProcessed++
    await delay(DELAY_MS)
  }

  // Summary
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('📊 REFRESH SUMMARY')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Topics processed: ${topicsProcessed}`)
  console.log(`Pending subscriptions found: ${pendingFound}`)
  
  if (DRY_RUN) {
    console.log(`\n📋 Dry run complete - no changes were made`)
  } else {
    console.log(`Subscriptions refreshed: ${subscriptionsRefreshed}`)
    console.log(`Errors: ${errors}`)
  }
  
  console.log('\n🏁 Script complete!')
  
  if (DRY_RUN) {
    console.log('\n💡 To run for real, remove the --dry-run flag:')
    console.log('   bun run scripts/refresh-sns-subscriptions.ts')
  } else if (subscriptionsRefreshed > 0) {
    console.log('\n✅ Subscriptions have been recreated.')
    console.log('   Check your logs for auto-confirmation messages at /api/inbound/health/tenant')
  }
}

// Run the script
refreshSnsSubscriptions()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })

