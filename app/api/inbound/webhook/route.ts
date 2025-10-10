// THIS IS THE PRIMARY WEBHOOK FOR PROCESSING EMAILS DO NOT DELETE THIS FILE

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sesEvents, structuredEmails, emailDomains, emailAddresses, webhooks, webhookDeliveries } from '@/lib/db/schema'
import { nanoid } from 'nanoid'
import { eq, and } from 'drizzle-orm'
import { Autumn as autumn } from 'autumn-js'
import { createHmac } from 'crypto'
import { parseEmail, sanitizeHtml, type ParsedEmailData } from '@/lib/email-management/email-parser'
import { type SESEvent, type SESRecord } from '@/lib/aws-ses/aws-ses'
import { isEmailBlocked } from '@/lib/email-management/email-blocking'
import { routeEmail } from '@/lib/email-management/email-router'

interface ProcessedSESRecord extends SESRecord {
  emailContent?: string | null
  s3Location?: {
    bucket: string
    key: string
    contentFetched: boolean
    contentSize: number
  }
  s3Error?: string
}

interface WebhookPayload {
  type: 'ses_event_with_content'
  timestamp: string
  originalEvent: SESEvent
  processedRecords: ProcessedSESRecord[]
  context: {
    functionName: string
    functionVersion: string
    requestId: string
  }
}

/**
 * Extract domain from email address
 */
function extractDomain(email: string): string {
  return email.split('@')[1]?.toLowerCase() || ''
}

/**
 * Map recipient email to user ID by looking up domain owner
 * This function handles the mapping of email recipients to user IDs by:
 * 1. Extracting the domain from the recipient email
 * 2. Looking up the domain owner in the emailDomains table
 * 3. Returning the userId or 'system' as fallback
 */
async function mapRecipientToUserId(recipient: string): Promise<string> {
  try {
    // Validate email format first
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(recipient)) {
      console.warn(`⚠️ Webhook - Invalid email format: ${recipient}`)
      return 'system'
    }

    const domain = extractDomain(recipient)
    
    if (!domain) {
      console.warn(`⚠️ Webhook - Could not extract domain from recipient: ${recipient}`)
      return 'system'
    }

    console.log(`🔍 Webhook - Looking up domain owner for: ${domain}`)

    // Look up the domain in the emailDomains table to find the owner
    const domainRecord = await db
      .select({ 
        userId: emailDomains.userId,
        status: emailDomains.status,
        canReceiveEmails: emailDomains.canReceiveEmails
      })
      .from(emailDomains)
      .where(eq(emailDomains.domain, domain))
      .limit(1)

    if (domainRecord[0]?.userId) {
      const { userId, status, canReceiveEmails } = domainRecord[0]
      
      // Log domain status for debugging
      console.log(`✅ Webhook - Found domain ${domain}: status=${status}, canReceiveEmails=${canReceiveEmails}, userId=${userId}`)
      
      // Check if domain is properly configured to receive emails
      if (!canReceiveEmails) {
        console.warn(`⚠️ Webhook - Domain ${domain} is not configured to receive emails, but processing anyway`)
      }
      
      return userId
    } else {
      console.warn(`⚠️ Webhook - No domain owner found for ${domain} (recipient: ${recipient}), using system`)
      return 'system'
    }
  } catch (error) {
    console.error(`❌ Webhook - Error mapping recipient ${recipient} to user:`, error)
    return 'system'
  }
}

/**
 * Check and track inbound trigger usage for a user
 */
async function checkAndTrackInboundTrigger(userId: string, recipient: string): Promise<{ allowed: boolean; error?: string }> {
  // Skip tracking for system emails
  if (userId === 'system') {
    console.log(`📧 Webhook - Skipping inbound trigger check for system email: ${recipient}`)
    return { allowed: true }
  }

  try {
    // Check if user can use inbound triggers
    const { data: triggerCheck, error: triggerCheckError } = await autumn.check({
      customer_id: userId,
      feature_id: "inbound_triggers",
    })

    if (triggerCheckError) {
      console.error(`❌ Webhook - Autumn inbound trigger check error for user ${userId}:`, triggerCheckError)
      return { 
        allowed: false, 
        error: `Failed to check inbound trigger limits: ${triggerCheckError}` 
      }
    }

    if (!triggerCheck?.allowed) {
      console.warn(`⚠️ Webhook - User ${userId} not allowed to use inbound triggers for email: ${recipient}`)
      return { 
        allowed: false, 
        error: 'Inbound trigger limit reached. Please upgrade your plan to process more emails.' 
      }
    }

    // Track the inbound trigger usage if allowed and not unlimited
    if (!triggerCheck.unlimited) {
      const { error: trackError } = await autumn.track({
        customer_id: userId,
        feature_id: "inbound_triggers",
        value: 1,
      })

      if (trackError) {
        console.error(`❌ Webhook - Failed to track inbound trigger usage for user ${userId}:`, trackError)
        return { 
          allowed: false, 
          error: `Failed to track inbound trigger usage: ${trackError}` 
        }
      }

      console.log(`📊 Webhook - Tracked inbound trigger usage for user ${userId}, email: ${recipient}`)
    } else {
      console.log(`♾️ Webhook - User ${userId} has unlimited inbound triggers, no tracking needed for: ${recipient}`)
    }

    return { allowed: true }
  } catch (error) {
    console.error(`❌ Webhook - Error checking/tracking inbound trigger for user ${userId}:`, error)
    return { 
      allowed: false, 
      error: `Inbound trigger check failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

/**
 * Create a structured email record from ParsedEmailData that matches the type exactly
 */
async function createStructuredEmailRecord(
  sesEventId: string, 
  parsedEmailData: ParsedEmailData, 
  userId: string,
  recipient: string
): Promise<string> {
  try {
    console.log(`📝 Webhook - Creating structured email record for recipient ${recipient}`)

    const structuredEmailId = 'inbnd_' + nanoid()
    const structuredEmailRecord = {
      id: structuredEmailId,
      emailId: structuredEmailId, // Self-referencing for backward compatibility
      sesEventId: sesEventId,
      recipient: recipient,
      
      // Core email fields matching ParsedEmailData exactly
      messageId: parsedEmailData.messageId || null,
      date: parsedEmailData.date || null,
      subject: parsedEmailData.subject || null,
      
      // Address fields - stored as JSON matching ParsedEmailAddress structure
      fromData: parsedEmailData.from ? JSON.stringify(parsedEmailData.from) : null,
      toData: parsedEmailData.to ? JSON.stringify(parsedEmailData.to) : null,
      ccData: parsedEmailData.cc ? JSON.stringify(parsedEmailData.cc) : null,
      bccData: parsedEmailData.bcc ? JSON.stringify(parsedEmailData.bcc) : null,
      replyToData: parsedEmailData.replyTo ? JSON.stringify(parsedEmailData.replyTo) : null,
      
      // Threading fields
      inReplyTo: parsedEmailData.inReplyTo || null,
      references: parsedEmailData.references ? JSON.stringify(parsedEmailData.references) : null,
      
      // Content fields
      textBody: parsedEmailData.textBody || null,
      htmlBody: parsedEmailData.htmlBody || null,
      rawContent: parsedEmailData.raw || null,
      
      // Attachments - stored as JSON array matching ParsedEmailData structure
      attachments: parsedEmailData.attachments ? JSON.stringify(parsedEmailData.attachments) : null,
      
      // Headers - stored as JSON object matching enhanced headers structure
      headers: parsedEmailData.headers ? JSON.stringify(parsedEmailData.headers) : null,
      
      // Priority field
      priority: typeof parsedEmailData.priority === 'string' ? parsedEmailData.priority : 
                parsedEmailData.priority === false ? 'false' : null,
      
      // Processing metadata
      parseSuccess: true,
      parseError: null,
      
      // User and timestamps
      userId: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await db.insert(structuredEmails).values(structuredEmailRecord)
    console.log(`✅ Webhook - Created structured email record ${structuredEmailId}`)
    
    return structuredEmailId

  } catch (error) {
    console.error(`❌ Webhook - Error creating structured email record for recipient ${recipient}:`, error)
    
    // Create a minimal record indicating parse failure
    try {
      const failedStructuredId = 'inbnd_' + nanoid()
      const failedStructuredRecord = {
        id: failedStructuredId,
        emailId: failedStructuredId, // Self-referencing
        sesEventId: sesEventId,
        recipient: recipient,
        parseSuccess: false,
        parseError: error instanceof Error ? error.message : 'Unknown parsing error',
        userId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      await db.insert(structuredEmails).values(failedStructuredRecord)
      console.log(`⚠️ Webhook - Created failed structured parse record ${failedStructuredId}`)
      return failedStructuredId
    } catch (insertError) {
      console.error(`❌ Webhook - Failed to create failed structured parse record for recipient ${recipient}:`, insertError)
      throw insertError
    }
  }
}



/**
 * Trigger email action by emailID - looks up email data and sends to configured webhook
 * This function separates webhook processing from the main email ingestion flow
 */
export async function triggerEmailAction(emailId: string): Promise<{ success: boolean; error?: string; deliveryId?: string }> {
  try {
    console.log(`🎯 triggerEmailAction - Processing email ID: ${emailId}`)

    // Get the structured email record directly
    const emailRecords = await db
      .select({
        // All structured email data
        id: structuredEmails.id,
        emailId: structuredEmails.emailId,
        messageId: structuredEmails.messageId,
        date: structuredEmails.date,
        subject: structuredEmails.subject,
        recipient: structuredEmails.recipient,
        fromData: structuredEmails.fromData,
        toData: structuredEmails.toData,
        ccData: structuredEmails.ccData,
        bccData: structuredEmails.bccData,
        replyToData: structuredEmails.replyToData,
        inReplyTo: structuredEmails.inReplyTo,
        references: structuredEmails.references,
        textBody: structuredEmails.textBody,
        htmlBody: structuredEmails.htmlBody,
        rawContent: structuredEmails.rawContent,
        attachments: structuredEmails.attachments,
        headers: structuredEmails.headers,
        priority: structuredEmails.priority,
        parseSuccess: structuredEmails.parseSuccess,
        parseError: structuredEmails.parseError,
        userId: structuredEmails.userId,
      })
      .from(structuredEmails)
      .where(eq(structuredEmails.id, emailId))
      .limit(1)

    if (!emailRecords[0]) {
      return { success: false, error: 'Email not found' }
    }

    const emailData = emailRecords[0]

    // Check if parsing was successful
    if (!emailData.parseSuccess) {
      return { 
        success: false, 
        error: `Email parsing failed: ${emailData.parseError || 'Unknown error'}` 
      }
    }

    // Check if recipient exists
    if (!emailData.recipient) {
      return {
        success: false,
        error: 'Email recipient not found'
      }
    }

    // Look up the email address to find the configured webhook
    const emailAddressRecord = await db
      .select({
        webhookId: emailAddresses.webhookId,
        address: emailAddresses.address,
        isActive: emailAddresses.isActive,
      })
      .from(emailAddresses)
      .where(and(
        eq(emailAddresses.address, emailData.recipient),
        eq(emailAddresses.isActive, true)
      ))
      .limit(1)

    if (!emailAddressRecord[0]?.webhookId) {
      return { 
        success: false, 
        error: `No webhook configured for ${emailData.recipient}` 
      }
    }

    const webhookId = emailAddressRecord[0].webhookId

    // Get the webhook configuration
    const webhookRecord = await db
      .select()
      .from(webhooks)
      .where(and(
        eq(webhooks.id, webhookId),
        eq(webhooks.isActive, true)
      ))
      .limit(1)

    if (!webhookRecord[0]) {
      return { 
        success: false, 
        error: `Webhook ${webhookId} not found or disabled for ${emailData.recipient}` 
      }
    }

    const webhook = webhookRecord[0]

    console.log(`📤 triggerEmailAction - Sending email ${emailData.messageId} to webhook: ${webhook.name} (${webhook.url})`)

    // Reconstruct ParsedEmailData from structured data
    const parsedEmailData: ParsedEmailData = {
      messageId: emailData.messageId || undefined,
      date: emailData.date || undefined,
      subject: emailData.subject || undefined,
      from: emailData.fromData ? JSON.parse(emailData.fromData) : null,
      to: emailData.toData ? JSON.parse(emailData.toData) : null,
      cc: emailData.ccData ? JSON.parse(emailData.ccData) : null,
      bcc: emailData.bccData ? JSON.parse(emailData.bccData) : null,
      replyTo: emailData.replyToData ? JSON.parse(emailData.replyToData) : null,
      inReplyTo: emailData.inReplyTo || undefined,
      references: emailData.references ? JSON.parse(emailData.references) : undefined,
      textBody: emailData.textBody || undefined,
      htmlBody: emailData.htmlBody || undefined,
      raw: emailData.rawContent || undefined,
      attachments: emailData.attachments ? JSON.parse(emailData.attachments) : [],
      headers: emailData.headers ? JSON.parse(emailData.headers) : {},
      priority: emailData.priority === 'false' ? false : (emailData.priority || undefined)
    }

    // Create webhook payload with the exact ParsedEmailData structure
    const webhookPayload = {
      event: 'email.received',
      timestamp: new Date().toISOString(),
      email: {
        id: emailData.id, // structuredEmails.id
        messageId: emailData.messageId,
        from: emailData.fromData ? JSON.parse(emailData.fromData) : null,
        to: emailData.toData ? JSON.parse(emailData.toData) : null,
        recipient: emailData.recipient,
        subject: emailData.subject,
        receivedAt: emailData.date,
        
        // Full ParsedEmailData structure
        parsedData: parsedEmailData,
        
        // Cleaned content for backward compatibility
        cleanedContent: {
          html: parsedEmailData.htmlBody ? sanitizeHtml(parsedEmailData.htmlBody) : null,
          text: parsedEmailData.textBody || null,
          hasHtml: !!parsedEmailData.htmlBody,
          hasText: !!parsedEmailData.textBody,
          attachments: parsedEmailData.attachments || [],
          headers: parsedEmailData.headers || {}
        }
      },
      webhook: {
        id: webhook.id,
        name: webhook.name
      }
    }

    const payloadString = JSON.stringify(webhookPayload)

    // Create webhook signature if secret exists
    let signature = null
    if (webhook.secret) {
      const hmac = createHmac('sha256', webhook.secret)
      hmac.update(payloadString)
      signature = `sha256=${hmac.digest('hex')}`
    }

    // Prepare headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'InboundEmail-Webhook/1.0',
      'X-Webhook-Event': 'email.received',
      'X-Webhook-ID': webhook.id,
      'X-Webhook-Timestamp': webhookPayload.timestamp,
      'X-Email-ID': emailData.id,
      'X-Message-ID': emailData.messageId || '',
    }

    if (signature) {
      headers['X-Webhook-Signature'] = signature
    }

    // Add custom headers if any
    if (webhook.headers) {
      try {
        const customHeaders = JSON.parse(webhook.headers)
        Object.assign(headers, customHeaders)
      } catch (error) {
        console.error('Error parsing custom headers:', error)
      }
    }

    // Create delivery record
    const deliveryId = nanoid()
    
    // Send the webhook
    const startTime = Date.now()
    let deliverySuccess = false
    let responseCode = 0
    let responseBody = ''
    let errorMessage = ''
    let deliveryTime = 0

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: AbortSignal.timeout((webhook.timeout || 30) * 1000)
      })

      deliveryTime = Date.now() - startTime
      responseCode = response.status
      responseBody = await response.text().catch(() => 'Unable to read response body')
      deliverySuccess = response.ok

      console.log(`${deliverySuccess ? '✅' : '❌'} triggerEmailAction - Delivery ${deliverySuccess ? 'succeeded' : 'failed'} for ${emailData.recipient}: ${responseCode} in ${deliveryTime}ms`)

    } catch (error) {
      deliveryTime = Date.now() - startTime
      deliverySuccess = false
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = `Request timeout after ${webhook.timeout}s`
        } else {
          errorMessage = error.message
        }
      } else {
        errorMessage = 'Unknown error'
      }

      console.error(`❌ triggerEmailAction - Delivery failed for ${emailData.recipient}:`, errorMessage)
    }

    // Create final delivery record with all data
    const deliveryRecord = {
      id: deliveryId,
      emailId: emailData.id, // structuredEmails.id
      webhookId: webhook.id,
      endpoint: webhook.url,
      payload: payloadString,
      status: deliverySuccess ? 'success' as const : 'failed' as const,
      attempts: 1,
      lastAttemptAt: new Date(),
      responseCode: responseCode || null,
      responseBody: responseBody ? responseBody.substring(0, 2000) : null, // Limit response body size
      deliveryTime: deliveryTime,
      error: errorMessage || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Store delivery record
    await db.insert(webhookDeliveries).values(deliveryRecord)

    // Update webhook stats
    await db
      .update(webhooks)
      .set({
        lastUsed: new Date(),
        totalDeliveries: (webhook.totalDeliveries || 0) + 1,
        successfulDeliveries: deliverySuccess ? (webhook.successfulDeliveries || 0) + 1 : (webhook.successfulDeliveries || 0),
        failedDeliveries: deliverySuccess ? (webhook.failedDeliveries || 0) : (webhook.failedDeliveries || 0) + 1,
        updatedAt: new Date()
      })
      .where(eq(webhooks.id, webhook.id))

    console.log(`📊 triggerEmailAction - Updated webhook stats for ${webhook.name}`)

    return { 
      success: deliverySuccess, 
      error: deliverySuccess ? undefined : errorMessage,
      deliveryId: deliveryId
    }

  } catch (error) {
    console.error(`❌ triggerEmailAction - Error processing email ${emailId}:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('===============================================')
    console.log('📧 Webhook - Received email event from Lambda')
    console.log('===============================================')
    
    // Verify the request is from our Lambda function
    const authHeader = request.headers.get('authorization')
    const expectedApiKey = process.env.SERVICE_API_KEY
    
    if (!authHeader || !expectedApiKey) {
      console.error('❌ Webhook - Missing authentication');
      return NextResponse.json(
        { error: 'Missing authentication' },
        { status: 401 }
      )
    }

    const providedKey = authHeader.replace('Bearer ', '')
    if (providedKey !== expectedApiKey) {
      console.error('❌ Webhook - Invalid authentication');
      return NextResponse.json(
        { error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    const payload: WebhookPayload = await request.json()
    console.log('🔍 Webhook - Payload type:', payload.type);

    // Validate payload structure
    if (payload.type !== 'ses_event_with_content' || !payload.processedRecords) {
      console.error('❌ Webhook - Invalid payload structure');
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      )
    }

    const processedEmails: Array<{
      emailId: string
      sesEventId: string
      messageId: string
      recipient: string
      subject: string
      webhookDelivery: { success: boolean; deliveryId?: string; error?: string } | null
    }> = []
    
    const rejectedEmails: Array<{
      messageId: string
      recipient: string
      userId: string
      reason: string
      subject: string
    }> = []

    // Process each enhanced SES record
    for (const record of payload.processedRecords) {
      try {
        const sesData = record.ses
        console.log('===============================================')
        console.log('Record Full Data:', JSON.stringify(record, null, 2))
        console.log('===============================================')
        const mail = sesData.mail
        const receipt = sesData.receipt

        console.log(`📨 Webhook - Processing email: ${mail.messageId}`);
        console.log(`👥 Webhook - Recipients: ${receipt.recipients.join(', ')}`);

        // First, store the SES event
        const sesEventId = nanoid()
        const sesEventRecord = {
          id: sesEventId,
          eventSource: record.eventSource,
          eventVersion: record.eventVersion,
          messageId: mail.messageId,
          source: mail.source,
          destination: JSON.stringify(mail.destination),
          subject: mail.commonHeaders.subject || null,
          timestamp: new Date(mail.timestamp),
          receiptTimestamp: new Date(receipt.timestamp),
          processingTimeMillis: receipt.processingTimeMillis,
          recipients: JSON.stringify(receipt.recipients),
          spamVerdict: receipt.spamVerdict.status,
          virusVerdict: receipt.virusVerdict.status,
          spfVerdict: receipt.spfVerdict.status,
          dkimVerdict: receipt.dkimVerdict.status,
          dmarcVerdict: receipt.dmarcVerdict.status,
          actionType: receipt.action.type,
          s3BucketName: receipt.action.bucketName,
          s3ObjectKey: receipt.action.objectKey,
          emailContent: record.emailContent || null,
          s3ContentFetched: record.s3Location?.contentFetched || false,
          s3ContentSize: record.s3Location?.contentSize || null,
          s3Error: record.s3Error || null,
          commonHeaders: JSON.stringify(mail.commonHeaders),
          rawSesEvent: JSON.stringify(record.ses),
          lambdaContext: JSON.stringify(payload.context),
          webhookPayload: JSON.stringify(payload),
          updatedAt: new Date(),
        }

        await db.insert(sesEvents).values(sesEventRecord)
        console.log(`✅ Webhook - Stored SES event ${sesEventId} for message ${mail.messageId}`);

        // Then, create a receivedEmail record for each recipient
        for (const recipient of receipt.recipients) {
          const userId = await mapRecipientToUserId(recipient)

          // Check and track inbound trigger usage
          const triggerResult = await checkAndTrackInboundTrigger(userId, recipient)
          
          if (!triggerResult.allowed) {
            console.warn(`⚠️ Webhook - Rejected email for ${recipient} due to inbound trigger limits: ${triggerResult.error}`)
            rejectedEmails.push({
              messageId: mail.messageId,
              recipient: recipient,
              userId: userId,
              reason: triggerResult.error || 'Inbound trigger limit reached',
              subject: mail.commonHeaders.subject,
            })
            continue // Skip processing this recipient
          }

          // Check if the sender email is blocked
          const senderBlocked = await isEmailBlocked(mail.source)
          let emailStatus: 'received' | 'blocked' = 'received'
          
          if (senderBlocked) {
            console.warn(`🚫 Webhook - Email from blocked sender ${mail.source} to ${recipient}`)
            emailStatus = 'blocked'
          }

          // Parse the email content using the new parseEmail function
          let parsedEmailData: ParsedEmailData | null = null
          console.log('Email content:', record.emailContent)
          if (record.emailContent) {
            console.log(`📧 Webhook - Parsing email content for ${mail.messageId}`)
            try {
              parsedEmailData = await parseEmail(record.emailContent)
              console.log(`✅ Webhook - Successfully parsed email content for ${mail.messageId}`)
            } catch (parseError) {
              console.error(`❌ Webhook - Failed to parse email content for ${mail.messageId}:`, parseError)
            }
          }

          // Create structured email record - this is now the PRIMARY and ONLY record
          let structuredEmailId: string
          if (parsedEmailData) {
            structuredEmailId = await createStructuredEmailRecord(sesEventId, parsedEmailData, userId, recipient)
          } else {
            // Create minimal record for unparseable emails
            console.warn(`⚠️ Webhook - No parsed data for ${mail.messageId}, creating minimal record`)
            structuredEmailId = 'inbnd_' + nanoid()
            const minimalRecord = {
              id: structuredEmailId,
              emailId: structuredEmailId,
              sesEventId: sesEventId,
              recipient: recipient,
              messageId: mail.messageId,
              subject: mail.commonHeaders.subject || 'No Subject',
              parseSuccess: false,
              parseError: 'Failed to parse email content',
              userId: userId,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
            await db.insert(structuredEmails).values(minimalRecord)
          }
          
          // Initialize email processing record
          const emailProcessingRecord = {
            emailId: structuredEmailId,
            sesEventId: sesEventId,
            messageId: mail.messageId,
            recipient: recipient,
            subject: mail.commonHeaders.subject,
            webhookDelivery: null as { success: boolean; deliveryId?: string; error?: string } | null,
          }

          console.log(`✅ Webhook - Stored email ${mail.messageId} for ${recipient} with ID ${structuredEmailId}`);

          // Route email using the new unified routing system (skip routing for blocked emails)
          if (emailStatus === 'blocked') {
            console.log(`🚫 Webhook - Skipping routing for blocked email ${structuredEmailId} from ${mail.source}`)
            
            // Update processing record to indicate blocked
            emailProcessingRecord.webhookDelivery = {
              success: false,
              error: 'Email blocked - sender is on the blocklist'
            }
          } else {
            try {
              
              await routeEmail(structuredEmailId)
              console.log(`✅ Webhook - Successfully routed email ${structuredEmailId}`)
              
              // Update processing record with success
              emailProcessingRecord.webhookDelivery = {
                success: true,
                deliveryId: undefined // Will be tracked in endpointDeliveries table
              }
            } catch (routingError) {
              console.error(`❌ Webhook - Failed to route email ${structuredEmailId}:`, routingError)
              
              // Update processing record with failure
              emailProcessingRecord.webhookDelivery = {
                success: false,
                error: routingError instanceof Error ? routingError.message : 'Unknown routing error'
              }
            }
          }

          // Processing record already updated above in the try/catch block

          processedEmails.push(emailProcessingRecord)
        }
      } catch (recordError) {
        console.error('❌ Webhook - Error processing SES record:', recordError);
        // Continue processing other records
      }
    }

    const response = {
      success: true,
      processedEmails: processedEmails.length,
      rejectedEmails: rejectedEmails.length,
      emails: processedEmails,
      rejected: rejectedEmails,
      timestamp: new Date(),
      lambdaContext: payload.context,
    }

    console.log(`✅ Webhook - Successfully processed ${processedEmails.length} emails, rejected ${rejectedEmails.length} emails`);

    return NextResponse.json(response)
  } catch (error) {
    console.error('💥 Webhook - Processing error:', error)
    
    // Return success even on error to prevent Lambda retries
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process email webhook',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      },
      { status: 200 } // Return 200 to prevent retries
    )
  }
}