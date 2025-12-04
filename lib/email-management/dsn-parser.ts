/**
 * DSN (Delivery Status Notification) Parser
 * 
 * Parses RFC 3464 compliant Delivery Status Notifications to extract:
 * - Bounce type and status codes
 * - Failed recipient information
 * - Original message details
 * - Diagnostic information
 * 
 * DSN Structure (multipart/report; report-type=delivery-status):
 * - Part 1: Human-readable notification (text/plain)
 * - Part 2: Machine-readable delivery-status (message/delivery-status)
 * - Part 3: Original message (message/rfc822) - optional
 */

import { db } from '@/lib/db'
import { sentEmails, emailDomains, sesTenants, user } from '@/lib/db/schema'
import { eq, or, sql } from 'drizzle-orm'
import { parseEmail } from './email-parser'

// RFC 3463 Enhanced Status Codes
export const DSN_STATUS_CLASSES = {
  '2': 'Success',
  '4': 'Temporary Failure (will retry)',
  '5': 'Permanent Failure (bounced)',
} as const

export const DSN_STATUS_CATEGORIES = {
  '0': 'Other/Undefined',
  '1': 'Addressing',
  '2': 'Mailbox',
  '3': 'Mail System',
  '4': 'Network/Routing',
  '5': 'Mail Delivery Protocol',
  '6': 'Message Content',
  '7': 'Security/Policy',
} as const

// Common bounce types we care about
export const BOUNCE_TYPES = {
  INVALID_DOMAIN: '5.4.4',
  USER_UNKNOWN: '5.1.1',
  MAILBOX_FULL: '5.2.2',
  MAILBOX_DISABLED: '5.2.1',
  MESSAGE_TOO_LARGE: '5.3.4',
  TEMPORARY_FAILURE: '4.0.0',
  DELIVERY_TIMEOUT: '4.4.7',
  DNS_FAILURE: '4.4.4',
} as const

export interface DSNDeliveryStatus {
  // Per-message fields
  reportingMta?: string
  receivedFromMta?: string
  arrivalDate?: string
  
  // Per-recipient fields
  action: 'failed' | 'delayed' | 'delivered' | 'relayed' | 'expanded'
  finalRecipient?: string
  originalRecipient?: string
  remoteMta?: string
  diagnosticCode?: string
  status: string // Enhanced status code (X.Y.Z)
  lastAttemptDate?: string
  willRetryUntil?: string
}

export interface DSNOriginalMessage {
  messageId?: string
  from?: string
  to?: string
  subject?: string
  date?: string
  feedbackId?: string // AWS SES specific
}

export interface ParsedDSN {
  // Is this email a DSN?
  isDsn: boolean
  
  // Human-readable summary
  humanReadable?: string
  
  // Machine-readable delivery status
  deliveryStatus?: DSNDeliveryStatus
  
  // Original message info (from Part 3)
  originalMessage?: DSNOriginalMessage
  
  // DSN's own In-Reply-To and References headers
  // These point to the original email that bounced!
  inReplyTo?: string
  references?: string[]
  
  // Parsed status code breakdown
  statusClass?: keyof typeof DSN_STATUS_CLASSES
  statusCategory?: keyof typeof DSN_STATUS_CATEGORIES
  statusDetail?: string
  statusDescription?: string
  
  // Bounce classification
  bounceType?: 'hard' | 'soft' | 'transient'
  bounceReason?: string
  
  // Raw data for debugging
  rawDeliveryStatusPart?: string
  rawOriginalMessagePart?: string
}

export interface DSNSourceInfo {
  // The email that triggered this DSN
  triggeringEmailId?: string
  triggeringEmailMessageId?: string
  triggeringEmailSubject?: string
  triggeringEmailFrom?: string
  triggeringEmailTo?: string
  triggeringEmailSentAt?: Date | null
  
  // The user who sent it
  userId?: string
  userName?: string
  userEmail?: string
  
  // The domain used
  domainId?: string
  domainName?: string
  
  // The tenant
  tenantId?: string
  tenantName?: string
}

/**
 * Check if an email is a DSN based on Content-Type and sender
 */
export function isDsn(rawContent: string, headers?: Record<string, any>): boolean {
  // Check Content-Type header for multipart/report with delivery-status
  if (headers?.['content-type']) {
    const contentType = headers['content-type']
    if (typeof contentType === 'object' && contentType.value === 'multipart/report') {
      if (contentType.params?.['report-type'] === 'delivery-status') {
        return true
      }
    }
    if (typeof contentType === 'string' && contentType.includes('delivery-status')) {
      return true
    }
  }
  
  // Fallback: check raw content for DSN indicators
  const dsnIndicators = [
    'Content-Type: multipart/report',
    'report-type=delivery-status',
    'Content-Type: message/delivery-status',
    'MAILER-DAEMON',
    'Delivery Status Notification',
  ]
  
  return dsnIndicators.some(indicator => rawContent.includes(indicator))
}

/**
 * Extract the delivery-status part from a DSN email
 */
function extractDeliveryStatusPart(rawContent: string): string | null {
  // Find the boundary
  const boundaryMatch = rawContent.match(/boundary="?([^"\r\n]+)"?/i)
  if (!boundaryMatch) return null
  
  const boundary = boundaryMatch[1]
  const parts = rawContent.split(`--${boundary}`)
  
  // Find the message/delivery-status part
  for (const part of parts) {
    if (part.includes('Content-Type: message/delivery-status') || 
        part.includes('content-type: message/delivery-status')) {
      // Extract the content after the headers
      const contentStart = part.indexOf('\r\n\r\n') || part.indexOf('\n\n')
      if (contentStart !== -1) {
        return part.substring(contentStart + 4).trim()
      }
    }
  }
  
  return null
}

/**
 * Extract the original message part from a DSN email
 */
function extractOriginalMessagePart(rawContent: string): string | null {
  const boundaryMatch = rawContent.match(/boundary="?([^"\r\n]+)"?/i)
  if (!boundaryMatch) return null
  
  const boundary = boundaryMatch[1]
  const parts = rawContent.split(`--${boundary}`)
  
  // Find the message/rfc822 part (original message)
  for (const part of parts) {
    if (part.includes('Content-Type: message/rfc822') || 
        part.includes('content-type: message/rfc822')) {
      const contentStart = part.indexOf('\r\n\r\n') || part.indexOf('\n\n')
      if (contentStart !== -1) {
        return part.substring(contentStart + 4).trim()
      }
    }
  }
  
  return null
}

/**
 * Parse the delivery-status fields
 */
function parseDeliveryStatus(statusPart: string): DSNDeliveryStatus | null {
  if (!statusPart) return null
  
  const result: Partial<DSNDeliveryStatus> = {}
  
  // Split into per-message and per-recipient sections (separated by blank line)
  const sections = statusPart.split(/\r?\n\r?\n/).filter(s => s.trim())
  
  for (const section of sections) {
    const lines = section.split(/\r?\n/)
    
    for (const line of lines) {
      // Handle multi-line values (continuation lines start with whitespace)
      const match = line.match(/^([A-Za-z-]+):\s*(.*)$/i)
      if (!match) continue
      
      const [, fieldName, fieldValue] = match
      const normalizedField = fieldName.toLowerCase()
      
      switch (normalizedField) {
        case 'reporting-mta':
          result.reportingMta = fieldValue.replace(/^dns;\s*/i, '')
          break
        case 'received-from-mta':
          result.receivedFromMta = fieldValue.replace(/^dns;\s*/i, '')
          break
        case 'arrival-date':
          result.arrivalDate = fieldValue
          break
        case 'action':
          result.action = fieldValue.toLowerCase() as DSNDeliveryStatus['action']
          break
        case 'final-recipient':
          result.finalRecipient = fieldValue.replace(/^rfc822;\s*/i, '')
          break
        case 'original-recipient':
          result.originalRecipient = fieldValue.replace(/^rfc822;\s*/i, '')
          break
        case 'remote-mta':
          result.remoteMta = fieldValue.replace(/^dns;\s*/i, '')
          break
        case 'diagnostic-code':
          result.diagnosticCode = fieldValue.replace(/^smtp;\s*/i, '')
          break
        case 'status':
          result.status = fieldValue
          break
        case 'last-attempt-date':
          result.lastAttemptDate = fieldValue
          break
        case 'will-retry-until':
          result.willRetryUntil = fieldValue
          break
      }
    }
  }
  
  // Only return if we have the minimum required fields
  if (result.action && result.status) {
    return result as DSNDeliveryStatus
  }
  
  return null
}

/**
 * Parse the original message headers
 */
function parseOriginalMessage(messagePart: string): DSNOriginalMessage | null {
  if (!messagePart) return null
  
  const result: DSNOriginalMessage = {}
  
  // Extract headers (everything before the first blank line)
  const headerEndIndex = messagePart.search(/\r?\n\r?\n/)
  const headersSection = headerEndIndex !== -1 
    ? messagePart.substring(0, headerEndIndex) 
    : messagePart
  
  const lines = headersSection.split(/\r?\n/)
  let currentHeader = ''
  let currentValue = ''
  
  const saveHeader = () => {
    if (!currentHeader) return
    
    const normalizedHeader = currentHeader.toLowerCase()
    switch (normalizedHeader) {
      case 'message-id':
        result.messageId = currentValue.replace(/^<|>$/g, '')
        break
      case 'from':
        result.from = currentValue
        break
      case 'to':
        result.to = currentValue
        break
      case 'subject':
        result.subject = currentValue
        break
      case 'date':
        result.date = currentValue
        break
      case 'feedback-id':
        result.feedbackId = currentValue
        break
    }
  }
  
  for (const line of lines) {
    if (line.match(/^\s+/)) {
      // Continuation line
      currentValue += ' ' + line.trim()
    } else {
      // New header
      saveHeader()
      const match = line.match(/^([A-Za-z-]+):\s*(.*)$/i)
      if (match) {
        currentHeader = match[1]
        currentValue = match[2]
      }
    }
  }
  saveHeader() // Don't forget the last header
  
  return Object.keys(result).length > 0 ? result : null
}

/**
 * Get human-readable status description
 */
function getStatusDescription(status: string): string {
  const descriptions: Record<string, string> = {
    '5.1.1': 'User unknown / mailbox does not exist',
    '5.1.2': 'Bad destination mailbox address',
    '5.2.1': 'Mailbox disabled / not accepting messages',
    '5.2.2': 'Mailbox full / over quota',
    '5.2.3': 'Message too large for mailbox',
    '5.3.0': 'Mail system issue / other',
    '5.3.4': 'Message too large for system',
    '5.4.4': 'Unable to route / invalid domain',
    '5.4.6': 'Routing loop detected',
    '5.7.1': 'Delivery not authorized / message refused',
    '4.4.7': 'Delivery timeout / will retry',
    '4.4.4': 'Unable to route / DNS failure (temporary)',
    '4.2.2': 'Mailbox full (will retry)',
  }
  
  return descriptions[status] || `Status code: ${status}`
}

/**
 * Classify bounce type based on status code
 */
function classifyBounce(status: string): 'hard' | 'soft' | 'transient' {
  if (!status) return 'soft'
  
  const statusClass = status.charAt(0)
  
  if (statusClass === '5') {
    // Permanent failures
    const permanentSoft = ['5.2.2', '5.3.4'] // Full mailbox, message too large - could succeed later
    if (permanentSoft.includes(status)) {
      return 'soft'
    }
    return 'hard'
  }
  
  if (statusClass === '4') {
    return 'transient'
  }
  
  return 'soft'
}

/**
 * Extract In-Reply-To and References headers from the DSN's own headers
 * These are the key to finding the original email!
 */
function extractDsnReplyHeaders(rawContent: string): { inReplyTo?: string; references?: string[] } {
  const result: { inReplyTo?: string; references?: string[] } = {}
  
  // Extract the DSN's own headers (before the first boundary)
  const boundaryMatch = rawContent.match(/boundary="?([^"\r\n]+)"?/i)
  let headersSection = rawContent
  
  if (boundaryMatch) {
    const boundaryIndex = rawContent.indexOf(`--${boundaryMatch[1]}`)
    if (boundaryIndex !== -1) {
      headersSection = rawContent.substring(0, boundaryIndex)
    }
  }
  
  // Extract In-Reply-To header
  // Format: In-Reply-To: <message-id@domain.com>
  const inReplyToMatch = headersSection.match(/^In-Reply-To:\s*<?([^>\r\n]+)>?\s*$/im)
  if (inReplyToMatch) {
    result.inReplyTo = inReplyToMatch[1].trim().replace(/^<|>$/g, '')
  }
  
  // Extract References header (can be multiline)
  const referencesMatch = headersSection.match(/^References:\s*(.+?)(?=^[A-Za-z-]+:|$)/ims)
  if (referencesMatch) {
    // References can contain multiple message IDs separated by whitespace
    const refsText = referencesMatch[1].replace(/[\r\n\t]+/g, ' ').trim()
    const refs = refsText.split(/\s+/)
      .map(ref => ref.trim().replace(/^<|>$/g, ''))
      .filter(ref => ref.length > 0 && ref.includes('@'))
    
    if (refs.length > 0) {
      result.references = refs
    }
  }
  
  return result
}

/**
 * Main DSN parser function
 */
export async function parseDsn(rawContent: string): Promise<ParsedDSN> {
  // First check if this is a DSN
  if (!isDsn(rawContent)) {
    return { isDsn: false }
  }
  
  const result: ParsedDSN = { isDsn: true }
  
  // Extract In-Reply-To and References from DSN's own headers
  // This is the PRIMARY way to identify the original email!
  const replyHeaders = extractDsnReplyHeaders(rawContent)
  result.inReplyTo = replyHeaders.inReplyTo
  result.references = replyHeaders.references
  
  // Extract and parse delivery status part
  const deliveryStatusPart = extractDeliveryStatusPart(rawContent)
  result.rawDeliveryStatusPart = deliveryStatusPart || undefined
  
  if (deliveryStatusPart) {
    result.deliveryStatus = parseDeliveryStatus(deliveryStatusPart) || undefined
  }
  
  // Extract and parse original message (Part 3 - fallback info)
  const originalMessagePart = extractOriginalMessagePart(rawContent)
  result.rawOriginalMessagePart = originalMessagePart || undefined
  
  if (originalMessagePart) {
    result.originalMessage = parseOriginalMessage(originalMessagePart) || undefined
  }
  
  // Parse status code breakdown
  if (result.deliveryStatus?.status) {
    const status = result.deliveryStatus.status
    const parts = status.split('.')
    
    if (parts.length >= 3) {
      result.statusClass = parts[0] as keyof typeof DSN_STATUS_CLASSES
      result.statusCategory = parts[1] as keyof typeof DSN_STATUS_CATEGORIES
      result.statusDetail = parts[2]
    }
    
    result.statusDescription = getStatusDescription(status)
    result.bounceType = classifyBounce(status)
    result.bounceReason = result.deliveryStatus.diagnosticCode || result.statusDescription
  }
  
  // Extract human-readable summary from text body
  const textMatch = rawContent.match(/Content-Description: Notification[\r\n]+[\r\n]+([\s\S]*?)(?=------=)/i)
  if (textMatch) {
    result.humanReadable = textMatch[1].trim()
  }
  
  return result
}

/**
 * Look up the source information for a DSN
 * This identifies the original email, user, domain, and tenant that triggered the bounce
 */
export async function getDsnSourceInfo(dsn: ParsedDSN): Promise<DSNSourceInfo | null> {
  // The DSN's In-Reply-To header points directly to the original email's Message-ID
  // This is the PRIMARY way to identify the source email!
  // Fallback to References header, then to the embedded original message's Message-ID
  
  let messageId = dsn.inReplyTo
  
  if (!messageId && dsn.references && dsn.references.length > 0) {
    // Use the first reference (usually the original message)
    messageId = dsn.references[0]
  }
  
  if (!messageId && dsn.originalMessage?.messageId) {
    // Fallback to parsing the embedded original message
    messageId = dsn.originalMessage.messageId
  }
  
  if (!messageId) {
    return null
  }
  
  // Format message ID variations for lookup
  // DSN Part 3 Message-ID format: <010f019ae693fb1b-50675262-d740-487c-97b8-e6de49d2e104-000000@us-east-2.amazonses.com>
  // sent_emails.message_id format: 010f019ae693fb1b-50675262-d740-487c-97b8-e6de49d2e104-000000
  // 
  // We need to strip:
  // 1. Angle brackets <>
  // 2. Domain suffix @us-east-2.amazonses.com (or any @domain)
  
  let cleanMessageId = messageId.replace(/^<|>$/g, '') // Remove < and >
  
  // Also strip the @domain suffix if present (SES adds @us-east-2.amazonses.com)
  const atIndex = cleanMessageId.indexOf('@')
  if (atIndex !== -1) {
    cleanMessageId = cleanMessageId.substring(0, atIndex)
  }
  
  const messageIdVariations = [
    cleanMessageId,                    // Just the ID: 010f019ae693fb1b-...
    `<${cleanMessageId}>`,             // With brackets: <010f019ae693fb1b-...>
    `${cleanMessageId}@us-east-2.amazonses.com`, // With SES domain
    `<${cleanMessageId}@us-east-2.amazonses.com>`, // Full SES format
  ]
  
  try {
    // Look up the sent email by message ID
    const sentEmail = await db
      .select({
        id: sentEmails.id,
        messageId: sentEmails.messageId,
        sesMessageId: sentEmails.sesMessageId,
        subject: sentEmails.subject,
        from: sentEmails.from,
        to: sentEmails.to,
        sentAt: sentEmails.sentAt,
        userId: sentEmails.userId,
        fromDomain: sentEmails.fromDomain,
      })
      .from(sentEmails)
      .where(
        or(
          ...messageIdVariations.map(mid => eq(sentEmails.sesMessageId, mid)),
          ...messageIdVariations.map(mid => eq(sentEmails.messageId, mid)),
        )
      )
      .limit(1)
    
    if (!sentEmail || sentEmail.length === 0) {
      return null
    }
    
    const email = sentEmail[0]
    const result: DSNSourceInfo = {
      triggeringEmailId: email.id,
      triggeringEmailMessageId: email.sesMessageId || email.messageId || undefined,
      triggeringEmailSubject: email.subject,
      triggeringEmailFrom: email.from,
      triggeringEmailTo: email.to,
      triggeringEmailSentAt: email.sentAt,
      userId: email.userId,
    }
    
    // Look up user info
    if (email.userId) {
      const userInfo = await db
        .select({
          name: user.name,
          email: user.email,
        })
        .from(user)
        .where(eq(user.id, email.userId))
        .limit(1)
      
      if (userInfo.length > 0) {
        result.userName = userInfo[0].name || undefined
        result.userEmail = userInfo[0].email
      }
    }
    
    // Look up domain info
    if (email.fromDomain) {
      const domainInfo = await db
        .select({
          id: emailDomains.id,
          domain: emailDomains.domain,
          tenantId: emailDomains.tenantId,
        })
        .from(emailDomains)
        .where(eq(emailDomains.domain, email.fromDomain))
        .limit(1)
      
      if (domainInfo.length > 0) {
        result.domainId = domainInfo[0].id
        result.domainName = domainInfo[0].domain
        
        // Look up tenant info
        if (domainInfo[0].tenantId) {
          const tenantInfo = await db
            .select({
              id: sesTenants.id,
              tenantName: sesTenants.tenantName,
            })
            .from(sesTenants)
            .where(eq(sesTenants.id, domainInfo[0].tenantId))
            .limit(1)
          
          if (tenantInfo.length > 0) {
            result.tenantId = tenantInfo[0].id
            result.tenantName = tenantInfo[0].tenantName
          }
        }
      }
    }
    
    return result
  } catch (error) {
    console.error('Error looking up DSN source info:', error)
    return null
  }
}

/**
 * Complete DSN analysis - parses DSN and looks up source info
 */
export interface DSNAnalysis {
  dsn: ParsedDSN
  source: DSNSourceInfo | null
}

export async function analyzeDsn(rawContent: string): Promise<DSNAnalysis> {
  const dsn = await parseDsn(rawContent)
  
  if (!dsn.isDsn) {
    return { dsn, source: null }
  }
  
  const source = await getDsnSourceInfo(dsn)
  
  return { dsn, source }
}

/**
 * Quick check if raw email content is a DSN (synchronous, no DB lookup)
 */
export function quickIsDsnCheck(rawContent: string): {
  isDsn: boolean
  finalRecipient?: string
  status?: string
  diagnosticCode?: string
} {
  if (!isDsn(rawContent)) {
    return { isDsn: false }
  }
  
  // Quick regex extraction without full parsing
  const recipientMatch = rawContent.match(/Final-Recipient:\s*rfc822;\s*([^\r\n]+)/i)
  const statusMatch = rawContent.match(/Status:\s*(\d+\.\d+\.\d+)/i)
  const diagnosticMatch = rawContent.match(/Diagnostic-Code:\s*smtp;\s*([^\r\n]+)/i)
  
  return {
    isDsn: true,
    finalRecipient: recipientMatch?.[1]?.trim(),
    status: statusMatch?.[1],
    diagnosticCode: diagnosticMatch?.[1]?.trim(),
  }
}

