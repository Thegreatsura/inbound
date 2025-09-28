/**
 * Backfill Email Threading Script
 * Processes existing emails to create thread relationships
 * Run this after deploying the threading schema changes
 */

import { db } from '@/lib/db'
import { structuredEmails, sentEmails, emailThreads } from '@/lib/db/schema'
import { EmailThreader } from '@/lib/email-management/email-threader'
import { eq, isNull, desc, asc, and, sql } from 'drizzle-orm'

interface BackfillStats {
  totalEmails: number
  processedEmails: number
  threadsCreated: number
  emailsThreaded: number
  errors: number
  startTime: Date
  endTime?: Date
}

/**
 * Main backfill function
 */
async function backfillEmailThreading(options: {
  batchSize?: number
  maxEmails?: number
  dryRun?: boolean
  userId?: string
} = {}) {
  const {
    batchSize = 100,
    maxEmails = 0, // 0 = no limit
    dryRun = false,
    userId
  } = options

  console.log('🧵 Starting email threading backfill...')
  console.log(`📊 Options: batchSize=${batchSize}, maxEmails=${maxEmails || 'unlimited'}, dryRun=${dryRun}, userId=${userId || 'all users'}`)

  const stats: BackfillStats = {
    totalEmails: 0,
    processedEmails: 0,
    threadsCreated: 0,
    emailsThreaded: 0,
    errors: 0,
    startTime: new Date()
  }

  try {
    // Get count of emails to process
    const countConditions = [isNull(structuredEmails.threadId)]
    if (userId) {
      countConditions.push(eq(structuredEmails.userId, userId))
    }

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(structuredEmails)
      .where(and(...countConditions))

    stats.totalEmails = count

    console.log(`📧 Found ${stats.totalEmails} emails to process`)

    if (stats.totalEmails === 0) {
      console.log('✅ No emails to process - all emails already have threads')
      return stats
    }

    // Process emails in batches, ordered by date (oldest first for better threading)
    let offset = 0
    let processedInBatch = 0

    do {
      console.log(`\n📦 Processing batch ${Math.floor(offset / batchSize) + 1} (emails ${offset + 1}-${Math.min(offset + batchSize, stats.totalEmails)})`)

      // Get batch of emails
      const emailConditions = [isNull(structuredEmails.threadId)]
      if (userId) {
        emailConditions.push(eq(structuredEmails.userId, userId))
      }

      const emails = await db
        .select({
          id: structuredEmails.id,
          userId: structuredEmails.userId,
          messageId: structuredEmails.messageId,
          subject: structuredEmails.subject,
          date: structuredEmails.date
        })
        .from(structuredEmails)
        .where(and(...emailConditions))
        .orderBy(asc(structuredEmails.date)) // Process oldest first for better threading
        .limit(batchSize)
        .offset(offset)

      processedInBatch = emails.length

      if (processedInBatch === 0) {
        break
      }

      // Process each email in the batch
      for (const email of emails) {
        try {
          console.log(`🔄 Processing email ${email.id} (${email.subject?.substring(0, 50) || 'No subject'}...)`)

          if (dryRun) {
            console.log(`📝 DRY RUN: Would process email ${email.id}`)
            stats.processedEmails++
            continue
          }

          // Process threading for this email
          const threadingResult = await EmailThreader.processEmailForThreading(email.id, email.userId)

          if (threadingResult.isNewThread) {
            stats.threadsCreated++
            console.log(`🆕 Created new thread ${threadingResult.threadId}`)
          } else {
            console.log(`🔗 Added to existing thread ${threadingResult.threadId} at position ${threadingResult.threadPosition}`)
          }

          stats.emailsThreaded++
          stats.processedEmails++

          // Small delay to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 10))

        } catch (error) {
          console.error(`❌ Error processing email ${email.id}:`, error)
          stats.errors++
          stats.processedEmails++
        }
      }

      offset += batchSize

      // Progress update
      const progress = Math.round((stats.processedEmails / stats.totalEmails) * 100)
      console.log(`📊 Progress: ${stats.processedEmails}/${stats.totalEmails} (${progress}%) - Threads: ${stats.threadsCreated} - Errors: ${stats.errors}`)

      // Check if we've hit the max limit
      if (maxEmails > 0 && stats.processedEmails >= maxEmails) {
        console.log(`🛑 Reached maximum email limit (${maxEmails})`)
        break
      }

    } while (processedInBatch === batchSize)

    // Also process sent emails (replies) that don't have threads
    console.log('\n📤 Processing sent emails (replies)...')
    await backfillSentEmails(stats, { batchSize, maxEmails, dryRun, userId })

    stats.endTime = new Date()
    const duration = Math.round((stats.endTime.getTime() - stats.startTime.getTime()) / 1000)

    console.log('\n✅ Backfill completed!')
    console.log('📊 Final Statistics:')
    console.log(`   Total emails: ${stats.totalEmails}`)
    console.log(`   Processed: ${stats.processedEmails}`)
    console.log(`   Threads created: ${stats.threadsCreated}`)
    console.log(`   Emails threaded: ${stats.emailsThreaded}`)
    console.log(`   Errors: ${stats.errors}`)
    console.log(`   Duration: ${duration} seconds`)
    console.log(`   Rate: ${Math.round(stats.processedEmails / duration)} emails/second`)

    return stats

  } catch (error) {
    console.error('💥 Fatal error during backfill:', error)
    stats.endTime = new Date()
    throw error
  }
}

/**
 * Backfill sent emails (replies) that don't have thread assignments
 */
async function backfillSentEmails(stats: BackfillStats, options: {
  batchSize: number
  maxEmails: number
  dryRun: boolean
  userId?: string
}) {
  const { batchSize, dryRun, userId } = options

  // Get sent emails without thread assignments
  const sentEmailConditions = [isNull(sentEmails.threadId)]
  if (userId) {
    sentEmailConditions.push(eq(sentEmails.userId, userId))
  }

  const sentEmailsToProcess = await db
    .select({
      id: sentEmails.id,
      userId: sentEmails.userId,
      messageId: sentEmails.messageId,
      subject: sentEmails.subject,
      headers: sentEmails.headers
    })
    .from(sentEmails)
    .where(and(...sentEmailConditions))
    .orderBy(asc(sentEmails.createdAt))

  console.log(`📤 Found ${sentEmailsToProcess.length} sent emails to process`)

  for (const sentEmail of sentEmailsToProcess) {
    try {
      console.log(`🔄 Processing sent email ${sentEmail.id}`)

      if (dryRun) {
        console.log(`📝 DRY RUN: Would process sent email ${sentEmail.id}`)
        continue
      }

      // Try to find the original email this was replying to
      let inReplyTo: string | null = null
      
      if (sentEmail.headers) {
        try {
          const headers = JSON.parse(sentEmail.headers)
          inReplyTo = headers['In-Reply-To']
        } catch (e) {
          console.error('Failed to parse headers:', e)
        }
      }

      if (inReplyTo) {
        // Clean the message ID
        const cleanMessageId = inReplyTo.replace(/[<>]/g, '').trim()
        
        // Find the original email
        const originalEmail = await db
          .select({ id: structuredEmails.id, threadId: structuredEmails.threadId })
          .from(structuredEmails)
          .where(
            eq(structuredEmails.messageId, cleanMessageId)
          )
          .limit(1)

        if (originalEmail[0]?.threadId) {
          // Add this sent email to the same thread
          const threadResult = await db
            .select({ messageCount: emailThreads.messageCount })
            .from(emailThreads)
            .where(eq(emailThreads.id, originalEmail[0].threadId))
            .limit(1)

          const threadPosition = (threadResult[0]?.messageCount || 0) + 1

          await db
            .update(sentEmails)
            .set({
              threadId: originalEmail[0].threadId,
              threadPosition,
              updatedAt: new Date()
            })
            .where(eq(sentEmails.id, sentEmail.id))

          // Update thread metadata
          await db
            .update(emailThreads)
            .set({
              messageCount: threadPosition,
              lastMessageAt: new Date(),
              updatedAt: new Date()
            })
            .where(eq(emailThreads.id, originalEmail[0].threadId))

          console.log(`🔗 Added sent email to thread ${originalEmail[0].threadId} at position ${threadPosition}`)
          stats.emailsThreaded++
        }
      }

    } catch (error) {
      console.error(`❌ Error processing sent email ${sentEmail.id}:`, error)
      stats.errors++
    }
  }
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2)
  
  const options: Parameters<typeof backfillEmailThreading>[0] = {
    batchSize: 100,
    maxEmails: 0,
    dryRun: false
  }

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    switch (arg) {
      case '--batch-size':
        options.batchSize = parseInt(args[++i]) || 100
        break
      case '--max-emails':
        options.maxEmails = parseInt(args[++i]) || 0
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--user-id':
        options.userId = args[++i]
        break
      case '--help':
        console.log(`
Email Threading Backfill Script

Usage: bun run scripts/email-threading/backfill-threads.ts [options]

Options:
  --batch-size <number>   Number of emails to process in each batch (default: 100)
  --max-emails <number>   Maximum number of emails to process (default: unlimited)
  --dry-run              Show what would be done without making changes
  --user-id <string>     Process emails for specific user only
  --help                 Show this help message

Examples:
  bun run scripts/email-threading/backfill-threads.ts
  bun run scripts/email-threading/backfill-threads.ts --dry-run
  bun run scripts/email-threading/backfill-threads.ts --batch-size 50 --max-emails 1000
  bun run scripts/email-threading/backfill-threads.ts --user-id user123
        `)
        process.exit(0)
        break
    }
  }

  try {
    await backfillEmailThreading(options)
    console.log('\n🎉 Backfill completed successfully!')
    process.exit(0)
  } catch (error) {
    console.error('\n💥 Backfill failed:', error)
    process.exit(1)
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main()
}

export { backfillEmailThreading }
