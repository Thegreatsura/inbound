/**
 * EmailThreader - Core email threading system
 * Handles conversation threading based on RFC 2822 standards with fallback mechanisms
 * Processes emails to determine thread relationships and maintains thread metadata
 */

import { db } from '@/lib/db'
import { structuredEmails, sentEmails, emailThreads } from '@/lib/db/schema'
import { eq, and, or, isNotNull, sql, desc } from 'drizzle-orm'
import { nanoid } from 'nanoid'

export interface ThreadingResult {
  threadId: string
  threadPosition: number
  isNewThread: boolean
}

export interface EmailData {
  id: string
  messageId: string | null
  inReplyTo: string | null
  references: string | null
  subject: string | null
  date: Date | null
  fromData: string | null
  toData: string | null
  ccData: string | null
  userId: string
}

export class EmailThreader {
  
  /**
   * Main entry point: Process email for threading
   * Called from email-router after email ingestion
   */
  static async processEmailForThreading(emailId: string, userId: string): Promise<ThreadingResult> {
    console.log(`🧵 EmailThreader - Processing email ${emailId} for threading`)
    
    // Get email data
    const email = await this.getEmailData(emailId, userId)
    if (!email) {
      throw new Error(`Email ${emailId} not found`)
    }
    
    console.log(`📧 Processing email: messageId=${email.messageId}, subject="${email.subject}"`)
    
    // Step 1: Try to find existing thread by Message-ID references
    let threadId = await this.findExistingThreadByHeaders(email, userId)
    
    // Step 2: Try subject-based threading as fallback (only for emails without threading headers)
    if (!threadId && !email.inReplyTo && !email.references) {
      threadId = await this.findExistingThreadBySubject(email, userId)
    }
    
    // Step 3: Create new thread if none found
    let isNewThread = false
    if (!threadId) {
      threadId = await this.createNewThread(email, userId)
      isNewThread = true
    }
    
    // Step 4: Add email to thread and get position
    const threadPosition = await this.addEmailToThread(threadId, emailId, email, userId)
    
    console.log(`✅ Email ${emailId} assigned to thread ${threadId} at position ${threadPosition}`)
    
    return {
      threadId,
      threadPosition,
      isNewThread
    }
  }
  
  /**
   * Get structured email data for threading
   */
  private static async getEmailData(emailId: string, userId: string): Promise<EmailData | null> {
    const result = await db
      .select({
        id: structuredEmails.id,
        messageId: structuredEmails.messageId,
        inReplyTo: structuredEmails.inReplyTo,
        references: structuredEmails.references,
        subject: structuredEmails.subject,
        date: structuredEmails.date,
        fromData: structuredEmails.fromData,
        toData: structuredEmails.toData,
        ccData: structuredEmails.ccData,
        userId: structuredEmails.userId,
      })
      .from(structuredEmails)
      .where(
        and(
          eq(structuredEmails.id, emailId),
          eq(structuredEmails.userId, userId)
        )
      )
      .limit(1)
    
    return result[0] || null
  }
  
  /**
   * Find existing thread by analyzing Message-ID headers (In-Reply-To, References)
   */
  private static async findExistingThreadByHeaders(email: EmailData, userId: string): Promise<string | null> {
    const messageIds = new Set<string>()
    
    // Collect all potential thread message IDs
    if (email.messageId) {
      messageIds.add(this.cleanMessageId(email.messageId))
    }
    
    if (email.inReplyTo) {
      messageIds.add(this.cleanMessageId(email.inReplyTo))
    }
    
    if (email.references) {
      try {
        // Handle both JSON array format and space-separated format
        let refs: string[] = []
        if (email.references.startsWith('[')) {
          refs = JSON.parse(email.references)
        } else {
          refs = email.references.split(/\s+/)
        }
        
        refs.forEach(ref => {
          const cleaned = this.cleanMessageId(ref)
          if (cleaned) messageIds.add(cleaned)
        })
      } catch (e) {
        console.error('Failed to parse references:', e)
      }
    }
    
    if (messageIds.size === 0) return null
    
    console.log(`🔍 Looking for existing thread with message IDs:`, Array.from(messageIds))
    
    // Look for existing emails with these message IDs that already have thread assignments
    const existingEmails = await db
      .select({ threadId: structuredEmails.threadId })
      .from(structuredEmails)
      .where(
        and(
          eq(structuredEmails.userId, userId),
          or(...Array.from(messageIds).map(id => 
            eq(structuredEmails.messageId, id)
          )),
          isNotNull(structuredEmails.threadId)
        )
      )
      .limit(1)
    
    // Also check sent emails
    if (!existingEmails[0]) {
      const existingSentEmails = await db
        .select({ threadId: sentEmails.threadId })
        .from(sentEmails)
        .where(
          and(
            eq(sentEmails.userId, userId),
            or(...Array.from(messageIds).map(id => 
              eq(sentEmails.messageId, id)
            )),
            isNotNull(sentEmails.threadId)
          )
        )
        .limit(1)
      
      if (existingSentEmails[0]) {
        console.log(`🔗 Found existing thread in sent emails: ${existingSentEmails[0].threadId}`)
        return existingSentEmails[0].threadId
      }
    }
    
    if (existingEmails[0]) {
      console.log(`🔗 Found existing thread: ${existingEmails[0].threadId}`)
      return existingEmails[0].threadId
    }
    
    return null
  }
  
  /**
   * Find existing thread by normalized subject (fallback method)
   */
  private static async findExistingThreadBySubject(email: EmailData, userId: string): Promise<string | null> {
    if (!email.subject) return null
    
    const normalizedSubject = this.normalizeSubject(email.subject)
    if (!normalizedSubject || normalizedSubject.length < 5) return null // Too short to be meaningful
    
    console.log(`🔍 Looking for existing thread with subject: "${normalizedSubject}"`)
    
    // Look for threads with the same normalized subject from the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    
    const existingThread = await db
      .select({ id: emailThreads.id })
      .from(emailThreads)
      .where(
        and(
          eq(emailThreads.userId, userId),
          eq(emailThreads.normalizedSubject, normalizedSubject),
          sql`${emailThreads.lastMessageAt} > ${thirtyDaysAgo}`
        )
      )
      .limit(1)
    
    if (existingThread[0]) {
      console.log(`📧 Found existing thread by subject: ${existingThread[0].id}`)
      return existingThread[0].id
    }
    
    return null
  }
  
  /**
   * Create a new thread for this email
   */
  private static async createNewThread(email: EmailData, userId: string): Promise<string> {
    const threadId = nanoid()
    const normalizedSubject = this.normalizeSubject(email.subject || '')
    const participants = this.extractParticipants(email)
    
    console.log(`🆕 Creating new thread ${threadId} for email ${email.id}`)
    
    await db.insert(emailThreads).values({
      id: threadId,
      rootMessageId: email.messageId || email.id,
      normalizedSubject,
      participantEmails: JSON.stringify(participants),
      messageCount: 1,
      lastMessageAt: email.date || new Date(),
      userId,
    })
    
    return threadId
  }
  
  /**
   * Add email to existing thread and return thread position
   */
  private static async addEmailToThread(threadId: string, emailId: string, email: EmailData, userId: string): Promise<number> {
    // Get current thread info and increment message count
    const threadResult = await db
      .select({
        messageCount: emailThreads.messageCount,
        participantEmails: emailThreads.participantEmails
      })
      .from(emailThreads)
      .where(eq(emailThreads.id, threadId))
      .limit(1)
    
    if (!threadResult[0]) {
      throw new Error(`Thread ${threadId} not found`)
    }
    
    const currentCount = threadResult[0].messageCount || 0
    const threadPosition = currentCount + 1
    
    // Update the email record with thread info
    await db
      .update(structuredEmails)
      .set({
        threadId,
        threadPosition,
        updatedAt: new Date()
      })
      .where(eq(structuredEmails.id, emailId))
    
    // Update thread metadata
    const currentParticipants = this.parseParticipants(threadResult[0].participantEmails)
    const newParticipants = this.extractParticipants(email)
    const allParticipants = [...new Set([...currentParticipants, ...newParticipants])]
    
    await db
      .update(emailThreads)
      .set({
        messageCount: threadPosition,
        lastMessageAt: email.date || new Date(),
        participantEmails: JSON.stringify(allParticipants),
        updatedAt: new Date()
      })
      .where(eq(emailThreads.id, threadId))
    
    return threadPosition
  }
  
  /**
   * Process sent email for threading (used by reply endpoints)
   */
  static async processSentEmailForThreading(sentEmailId: string, originalEmailId: string, userId: string): Promise<ThreadingResult> {
    console.log(`📤 Processing sent email ${sentEmailId} for threading (reply to ${originalEmailId})`)
    
    // Get the original email's thread
    const originalEmail = await db
      .select({ threadId: structuredEmails.threadId })
      .from(structuredEmails)
      .where(
        and(
          eq(structuredEmails.id, originalEmailId),
          eq(structuredEmails.userId, userId)
        )
      )
      .limit(1)
    
    if (!originalEmail[0]?.threadId) {
      throw new Error(`Original email ${originalEmailId} has no thread assignment`)
    }
    
    const threadId = originalEmail[0].threadId
    
    // Get current thread message count
    const threadResult = await db
      .select({ messageCount: emailThreads.messageCount })
      .from(emailThreads)
      .where(eq(emailThreads.id, threadId))
      .limit(1)
    
    const currentCount = threadResult[0]?.messageCount || 0
    const threadPosition = currentCount + 1
    
    // Update the sent email record with thread info
    await db
      .update(sentEmails)
      .set({
        threadId,
        threadPosition,
        updatedAt: new Date()
      })
      .where(eq(sentEmails.id, sentEmailId))
    
    // Update thread metadata
    await db
      .update(emailThreads)
      .set({
        messageCount: threadPosition,
        lastMessageAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(emailThreads.id, threadId))
    
    console.log(`✅ Sent email ${sentEmailId} added to thread ${threadId} at position ${threadPosition}`)
    
    return {
      threadId,
      threadPosition,
      isNewThread: false
    }
  }
  
  /**
   * Helper: Clean and normalize message ID
   */
  private static cleanMessageId(messageId: string): string {
    if (!messageId) return ''
    return messageId.replace(/[<>]/g, '').trim()
  }
  
  /**
   * Helper: Normalize subject for threading
   */
  private static normalizeSubject(subject: string): string {
    if (!subject) return ''
    
    // Remove common reply/forward prefixes (case insensitive)
    let normalized = subject.trim()
    
    // Remove RE:, Re:, R:, FWD:, Fwd:, etc.
    const prefixPattern = /^(re|r|fwd|fw|aw|wg|vs|sv):\s*/i
    while (prefixPattern.test(normalized)) {
      normalized = normalized.replace(prefixPattern, '').trim()
    }
    
    return normalized.toLowerCase()
  }
  
  /**
   * Helper: Extract participant email addresses from email data
   */
  private static extractParticipants(email: EmailData): string[] {
    const participants = new Set<string>()
    
    try {
      // Extract from fromData
      if (email.fromData) {
        const fromParsed = JSON.parse(email.fromData)
        if (fromParsed?.addresses) {
          fromParsed.addresses.forEach((addr: any) => {
            if (addr.address) participants.add(addr.address.toLowerCase())
          })
        }
      }
      
      // Extract from toData
      if (email.toData) {
        const toParsed = JSON.parse(email.toData)
        if (toParsed?.addresses) {
          toParsed.addresses.forEach((addr: any) => {
            if (addr.address) participants.add(addr.address.toLowerCase())
          })
        }
      }
      
      // Extract from ccData
      if (email.ccData) {
        const ccParsed = JSON.parse(email.ccData)
        if (ccParsed?.addresses) {
          ccParsed.addresses.forEach((addr: any) => {
            if (addr.address) participants.add(addr.address.toLowerCase())
          })
        }
      }
    } catch (e) {
      console.error('Failed to extract participants:', e)
    }
    
    return Array.from(participants)
  }
  
  /**
   * Helper: Parse participants from JSON string
   */
  private static parseParticipants(participantsJson: string | null): string[] {
    if (!participantsJson) return []
    
    try {
      const parsed = JSON.parse(participantsJson)
      return Array.isArray(parsed) ? parsed : []
    } catch (e) {
      return []
    }
  }
  
  /**
   * Get next thread position for a thread
   */
  static async getNextThreadPosition(threadId: string): Promise<number> {
    const result = await db
      .select({ messageCount: emailThreads.messageCount })
      .from(emailThreads)
      .where(eq(emailThreads.id, threadId))
      .limit(1)
    
    return (result[0]?.messageCount || 0) + 1
  }
  
  /**
   * Get the latest email in a thread (for replying to thread ID)
   */
  static async getLatestEmailInThread(threadId: string, userId: string): Promise<{
    emailId: string
    type: 'inbound' | 'outbound'
    threadPosition: number
  } | null> {
    console.log(`🔍 Finding latest email in thread ${threadId}`)
    
    // Get latest inbound email
    const latestInbound = await db
      .select({
        id: structuredEmails.id,
        threadPosition: structuredEmails.threadPosition
      })
      .from(structuredEmails)
      .where(
        and(
          eq(structuredEmails.threadId, threadId),
          eq(structuredEmails.userId, userId)
        )
      )
      .orderBy(desc(structuredEmails.threadPosition))
      .limit(1)
    
    // Get latest outbound email
    const latestOutbound = await db
      .select({
        id: sentEmails.id,
        threadPosition: sentEmails.threadPosition
      })
      .from(sentEmails)
      .where(
        and(
          eq(sentEmails.threadId, threadId),
          eq(sentEmails.userId, userId)
        )
      )
      .orderBy(desc(sentEmails.threadPosition))
      .limit(1)
    
    // Determine which is the latest message
    const inbound = latestInbound[0]
    const outbound = latestOutbound[0]
    
    if (!inbound && !outbound) {
      console.log(`❌ No emails found in thread ${threadId}`)
      return null
    }
    
    // Compare thread positions to find the latest
    const inboundPosition = inbound?.threadPosition || 0
    const outboundPosition = outbound?.threadPosition || 0
    
    if (outboundPosition > inboundPosition && outbound) {
      console.log(`📤 Latest email in thread is outbound: ${outbound.id} at position ${outbound.threadPosition}`)
      return {
        emailId: outbound.id,
        type: 'outbound',
        threadPosition: outbound.threadPosition || 0
      }
    } else if (inbound) {
      console.log(`📥 Latest email in thread is inbound: ${inbound.id} at position ${inbound.threadPosition}`)
      return {
        emailId: inbound.id,
        type: 'inbound',
        threadPosition: inbound.threadPosition || 0
      }
    }
    
    return null
  }
  
  /**
   * Check if an ID is a thread ID or email ID
   */
  static async resolveEmailId(id: string, userId: string): Promise<{
    emailId: string
    isThreadId: boolean
    threadId?: string
  } | null> {
    console.log(`🔍 Resolving ID: ${id}`)
    
    // First, check if it's a thread ID
    const thread = await db
      .select({ id: emailThreads.id })
      .from(emailThreads)
      .where(
        and(
          eq(emailThreads.id, id),
          eq(emailThreads.userId, userId)
        )
      )
      .limit(1)
    
    if (thread[0]) {
      console.log(`🧵 ID ${id} is a thread ID`)
      // Get the latest email in this thread
      const latestEmail = await this.getLatestEmailInThread(id, userId)
      
      if (!latestEmail) {
        return null
      }
      
      return {
        emailId: latestEmail.emailId,
        isThreadId: true,
        threadId: id
      }
    }
    
    // Check if it's an email ID in structuredEmails
    const structuredEmail = await db
      .select({ 
        id: structuredEmails.id,
        threadId: structuredEmails.threadId 
      })
      .from(structuredEmails)
      .where(
        and(
          eq(structuredEmails.id, id),
          eq(structuredEmails.userId, userId)
        )
      )
      .limit(1)
    
    if (structuredEmail[0]) {
      console.log(`📧 ID ${id} is an email ID`)
      return {
        emailId: id,
        isThreadId: false,
        threadId: structuredEmail[0].threadId || undefined
      }
    }
    
    console.log(`❌ ID ${id} not found in threads or emails`)
    return null
  }
}
