/**
 * Test Reputation Alert System
 * 
 * Tests the Slack admin notifications and email alerts.
 * 
 * Usage:
 *   bun run scripts/test-reputation-alerts.ts              # Test both Slack + Email
 *   bun run scripts/test-reputation-alerts.ts --slack-only # Test Slack only
 *   bun run scripts/test-reputation-alerts.ts --email-only # Test Email only
 * 
 * Prerequisites:
 *   - SLACK_ADMIN_WEBHOOK_URL in .env
 *   - INBOUND_API_KEY in .env (for email sending)
 */

import { sendReputationAlertNotification, sendTestReputationAlertEmail } from '@/lib/email-management/email-notifications'

// Configuration
const TEST_EMAIL = 'ryan@mandarin3d.com'
const SLACK_ADMIN_WEBHOOK_URL = process.env.SLACK_ADMIN_WEBHOOK_URL

// Parse args
const args = process.argv.slice(2)
const slackOnly = args.includes('--slack-only')
const emailOnly = args.includes('--email-only')

async function testSlackNotification(severity: 'warning' | 'critical', sendingPaused: boolean = false) {
  if (!SLACK_ADMIN_WEBHOOK_URL) {
    console.error('❌ SLACK_ADMIN_WEBHOOK_URL not configured in .env')
    return false
  }

  const emoji = severity === 'critical' ? '🚨' : '⚠️'
  const alertType = severity === 'critical' ? 'complaint' : 'bounce'
  const currentRate = severity === 'critical' ? '0.35%' : '5.20%'
  const threshold = severity === 'critical' ? '0.30%' : '5.00%'
  
  const actionText = sendingPaused 
    ? '\n\n🛑 *ACTION TAKEN: Sending has been automatically paused for this tenant*' 
    : ''

  const slackMessage = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} [TEST] SES ${severity.toUpperCase()} Alert: ${alertType === 'bounce' ? 'Bounce Rate' : 'Complaint Rate'}`,
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Tenant:*\ntest-tenant-12345`
          },
          {
            type: 'mrkdwn',
            text: `*User:*\n${TEST_EMAIL}`
          },
          {
            type: 'mrkdwn',
            text: `*Current Rate:*\n${currentRate}`
          },
          {
            type: 'mrkdwn',
            text: `*Threshold:*\n${threshold}`
          },
          {
            type: 'mrkdwn',
            text: `*Config Set:*\n\`tenant-test-user-12345\``
          },
          {
            type: 'mrkdwn',
            text: `*Triggered:*\n${new Date().toLocaleString()}`
          }
        ]
      },
      ...(actionText ? [{
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: actionText
        }
      }] : []),
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `🧪 This is a test notification from \`scripts/test-reputation-alerts.ts\``
          }
        ]
      }
    ]
  }

  try {
    const response = await fetch(SLACK_ADMIN_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    })

    if (!response.ok) {
      console.error(`❌ Slack notification failed: ${response.status} ${response.statusText}`)
      return false
    }
    
    console.log(`✅ Slack ${severity} notification sent successfully`)
    return true
  } catch (error) {
    console.error('❌ Failed to send Slack notification:', error)
    return false
  }
}

async function testEmailNotification(severity: 'warning' | 'critical', alertType: 'bounce' | 'complaint', sendingPaused: boolean = false) {
  console.log(`📧 Sending ${severity} ${alertType} alert email to ${TEST_EMAIL}...`)
  
  const currentRate = alertType === 'bounce' 
    ? (severity === 'critical' ? 0.072 : 0.052)
    : (severity === 'critical' ? 0.0035 : 0.0012)
  
  const threshold = alertType === 'bounce'
    ? (severity === 'critical' ? 0.07 : 0.05)
    : (severity === 'critical' ? 0.003 : 0.001)

  const result = await sendReputationAlertNotification({
    userEmail: TEST_EMAIL,
    userName: 'Ryan (Test)',
    alertType: alertType,
    severity: severity,
    currentRate: currentRate,
    threshold: threshold,
    configurationSet: 'tenant-test-user-12345',
    tenantName: 'Test Tenant',
    triggeredAt: new Date(),
    sendingPaused: sendingPaused
  })

  if (result.success) {
    console.log(`✅ ${severity} ${alertType} email sent successfully`)
    console.log(`   Message ID: ${result.messageId}`)
    return true
  } else {
    console.error(`❌ Failed to send ${severity} ${alertType} email: ${result.error}`)
    return false
  }
}

async function main() {
  console.log('🧪 Testing Reputation Alert System')
  console.log('=' .repeat(50))
  console.log(`📧 Test email: ${TEST_EMAIL}`)
  console.log(`📱 Slack webhook: ${SLACK_ADMIN_WEBHOOK_URL ? '✅ Configured' : '❌ Not configured'}`)
  console.log('=' .repeat(50))
  console.log('')

  let slackSuccess = true
  let emailSuccess = true

  // Test Slack notifications
  if (!emailOnly) {
    console.log('\n📱 SLACK NOTIFICATIONS')
    console.log('-'.repeat(50))
    
    // Warning notification
    console.log('\n1️⃣ Sending WARNING notification to Slack...')
    slackSuccess = await testSlackNotification('warning') && slackSuccess
    
    await new Promise(r => setTimeout(r, 1000)) // Small delay
    
    // Critical notification (without auto-pause)
    console.log('\n2️⃣ Sending CRITICAL notification to Slack...')
    slackSuccess = await testSlackNotification('critical', false) && slackSuccess
    
    await new Promise(r => setTimeout(r, 1000))
    
    // Critical notification WITH auto-pause
    console.log('\n3️⃣ Sending CRITICAL + AUTO-PAUSE notification to Slack...')
    slackSuccess = await testSlackNotification('critical', true) && slackSuccess
  }

  // Test Email notifications
  if (!slackOnly) {
    console.log('\n\n📧 EMAIL NOTIFICATIONS')
    console.log('-'.repeat(50))
    
    // Bounce warning
    console.log('\n1️⃣ Sending BOUNCE WARNING email...')
    emailSuccess = await testEmailNotification('warning', 'bounce') && emailSuccess
    
    await new Promise(r => setTimeout(r, 2000))
    
    // Complaint critical
    console.log('\n2️⃣ Sending COMPLAINT CRITICAL email...')
    emailSuccess = await testEmailNotification('critical', 'complaint') && emailSuccess
    
    await new Promise(r => setTimeout(r, 2000))
    
    // Bounce critical with sending paused
    console.log('\n3️⃣ Sending BOUNCE CRITICAL + SENDING PAUSED email...')
    emailSuccess = await testEmailNotification('critical', 'bounce', true) && emailSuccess
  }

  // Summary
  console.log('\n\n' + '='.repeat(50))
  console.log('📊 TEST SUMMARY')
  console.log('='.repeat(50))
  
  if (!emailOnly) {
    console.log(`📱 Slack: ${slackSuccess ? '✅ All passed' : '❌ Some failed'}`)
  }
  if (!slackOnly) {
    console.log(`📧 Email: ${emailSuccess ? '✅ All passed' : '❌ Some failed'}`)
  }
  
  console.log('\n🏁 Test complete!')
  
  if (!slackSuccess || !emailSuccess) {
    process.exit(1)
  }
}

main().catch(console.error)

