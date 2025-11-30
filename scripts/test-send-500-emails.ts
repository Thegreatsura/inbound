/**
 * Test Script: Send 500 Emails via Inbound API
 * 
 * This script sends 500 test emails to verify tenant-level tracking.
 * 
 * Usage: bun run scripts/test-send-500-emails.ts
 * 
 * Required env var: INBOUND_API_KEY
 */

const API_KEY = process.env.INBOUND_API_KEY
const API_BASE_URL = process.env.INBOUND_API_URL || 'http://localhost:3000'

const TO_EMAIL = 'inboundemaildotnew@gmail.com'
const FROM_EMAIL = 'test@development.inbound.new'
const FROM_NAME = 'Tenant Test'
const TOTAL_EMAILS = 500
const BATCH_SIZE = 10 // Send in batches to avoid overwhelming
const DELAY_BETWEEN_BATCHES_MS = 1000 // 1 second between batches

interface SendResult {
  index: number
  success: boolean
  id?: string
  error?: string
}

async function sendEmail(index: number): Promise<SendResult> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v2/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: TO_EMAIL,
        subject: `Tenant Test Email #${index + 1} - ${new Date().toISOString()}`,
        html: `
          <h1>Test Email #${index + 1}</h1>
          <p>This is a test email to verify tenant-level tracking.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Email Index:</strong> ${index + 1} of ${TOTAL_EMAILS}</p>
          <p><strong>From Domain:</strong> development.inbound.new</p>
          <hr>
          <p style="color: #888; font-size: 12px;">
            This email was sent as part of a tenant tracking verification test.
          </p>
        `,
        text: `Test Email #${index + 1}\n\nThis is a test email to verify tenant-level tracking.\n\nTimestamp: ${new Date().toISOString()}\nEmail Index: ${index + 1} of ${TOTAL_EMAILS}\nFrom Domain: development.inbound.new`
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
      return { index, success: false, error: errorData.error || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { index, success: true, id: data.id }
  } catch (error) {
    return { index, success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

async function sendBatch(startIndex: number, batchSize: number): Promise<SendResult[]> {
  const promises: Promise<SendResult>[] = []
  
  for (let i = 0; i < batchSize && (startIndex + i) < TOTAL_EMAILS; i++) {
    promises.push(sendEmail(startIndex + i))
  }
  
  return Promise.all(promises)
}

async function main() {
  console.log('🚀 Starting Tenant Test Email Script')
  console.log('━'.repeat(50))
  console.log(`📧 To: ${TO_EMAIL}`)
  console.log(`📤 From: ${FROM_EMAIL}`)
  console.log(`📊 Total Emails: ${TOTAL_EMAILS}`)
  console.log(`📦 Batch Size: ${BATCH_SIZE}`)
  console.log(`🌐 API URL: ${API_BASE_URL}`)
  console.log('━'.repeat(50))

  if (!API_KEY) {
    console.error('❌ INBOUND_API_KEY environment variable is not set!')
    console.log('\nSet it with: export INBOUND_API_KEY="your-api-key"')
    process.exit(1)
  }

  console.log('✅ API Key found\n')

  let successCount = 0
  let failCount = 0
  const startTime = Date.now()
  const errors: SendResult[] = []

  for (let batchStart = 0; batchStart < TOTAL_EMAILS; batchStart += BATCH_SIZE) {
    const batchNum = Math.floor(batchStart / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(TOTAL_EMAILS / BATCH_SIZE)
    
    process.stdout.write(`\r📨 Sending batch ${batchNum}/${totalBatches} (emails ${batchStart + 1}-${Math.min(batchStart + BATCH_SIZE, TOTAL_EMAILS)})...`)
    
    const results = await sendBatch(batchStart, BATCH_SIZE)
    
    for (const result of results) {
      if (result.success) {
        successCount++
      } else {
        failCount++
        errors.push(result)
      }
    }

    // Progress update
    const progress = ((batchStart + BATCH_SIZE) / TOTAL_EMAILS * 100).toFixed(1)
    process.stdout.write(`\r📨 Batch ${batchNum}/${totalBatches} complete | ✅ ${successCount} | ❌ ${failCount} | ${progress}%   `)

    // Wait between batches to avoid rate limiting
    if (batchStart + BATCH_SIZE < TOTAL_EMAILS) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS))
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log('\n\n' + '━'.repeat(50))
  console.log('📊 RESULTS')
  console.log('━'.repeat(50))
  console.log(`✅ Successful: ${successCount}`)
  console.log(`❌ Failed: ${failCount}`)
  console.log(`⏱️  Duration: ${duration} seconds`)
  console.log(`📈 Rate: ${(TOTAL_EMAILS / parseFloat(duration)).toFixed(2)} emails/second`)

  if (errors.length > 0) {
    console.log('\n❌ Errors:')
    // Show first 10 errors
    errors.slice(0, 10).forEach(e => {
      console.log(`   Email #${e.index + 1}: ${e.error}`)
    })
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors`)
    }
  }

  console.log('\n━'.repeat(50))
  console.log('📋 NEXT STEPS')
  console.log('━'.repeat(50))
  console.log('1. Wait 15-30 minutes for AWS SES metrics to update')
  console.log('2. Check AWS SES Console → Configuration Sets → Event destinations')
  console.log('3. Check AWS SES Console → Tenants → Your tenant metrics')
  console.log('4. Check CloudWatch → Metrics → SES')
  console.log('\n🏁 Done!')
}

main().catch(error => {
  console.error('Fatal error:', error)
  process.exit(1)
})

