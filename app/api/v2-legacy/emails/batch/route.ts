import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, checkNewAccountWarmupLimits } from '../../helper/main'
import { processAttachments, attachmentsToStorageFormat, type AttachmentInput } from '../../helper/attachment-processor'
import { db } from '@/lib/db'
import { sentEmails, emailDomains, SENT_EMAIL_STATUS } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { Autumn as autumn } from 'autumn-js'
import { nanoid } from 'nanoid'
import { Client as QStashClient } from '@upstash/qstash'
import { canUserSendFromEmail, extractEmailAddress, extractDomain } from '@/lib/email-management/agent-email-helper'
import { isSubdomain, getRootDomain } from '@/lib/domains-and-dns/domain-utils'

/**
 * POST /api/v2/emails/batch
 * Send batch emails through the API
 * Accepts a single email object with an array of recipients in the 'to' field
 * Creates separate email entities for each recipient
 * Supports up to 1000 recipients per batch
 * Each email is queued via QStash with 500ms delays
 * Has tests? ❌
 * Has logging? ✅
 * Has types? ✅
 */

// Import the request type from the main emails route
export interface PostEmailsRequest {
    from: string
    to: string | string[]
    subject: string
    bcc?: string | string[]
    cc?: string | string[]
    reply_to?: string | string[] // snake_case (legacy)
    replyTo?: string | string[]  // camelCase (Resend-compatible)
    html?: string
    text?: string
    headers?: Record<string, string>
    attachments?: AttachmentInput[]
    tags?: Array<{
        name: string
        value: string
    }>
}

export interface PostEmailsBatchRequest extends PostEmailsRequest {
    to: string[] // In batch mode, 'to' must be an array
}

export interface PostEmailsBatchResponse {
    data: Array<{ id: string }>
    errors?: Array<{ index: number; message: string }>
}

// Helper function to convert string or array to array
function toArray(value: string | string[] | undefined): string[] {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
}

// Validation function for batch email request
interface ValidationResult {
    valid: boolean
    error?: string
}

async function validateBatchEmail(
    email: PostEmailsBatchRequest,
    userId: string
): Promise<ValidationResult> {
    // Validate required fields
    if (!email.from || !email.to || !email.subject) {
        return {
            valid: false,
            error: 'Missing required fields: from, to, and subject are required'
        }
    }

    // Validate that 'to' is an array
    if (!Array.isArray(email.to)) {
        return {
            valid: false,
            error: 'The "to" field must be an array of email addresses for batch sending'
        }
    }

    // Validate batch size (max 1000 recipients)
    if (email.to.length === 0) {
        return {
            valid: false,
            error: 'At least one recipient email address is required in the "to" array'
        }
    }

    if (email.to.length > 1000) {
        return {
            valid: false,
            error: 'Cannot send to more than 1000 recipients at once. Please split into smaller batches.'
        }
    }

    // Validate combined recipients per email (to + cc + bcc)
    // Each email in the batch will have: 1 recipient from 'to' + all 'cc' + all 'bcc'
    const ccAddresses = toArray(email.cc)
    const bccAddresses = toArray(email.bcc)
    const recipientsPerEmail = 1 + ccAddresses.length + bccAddresses.length
    
    // AWS SES limit is 50 recipients per email
    const MAX_RECIPIENTS_PER_EMAIL = 50
    if (recipientsPerEmail > MAX_RECIPIENTS_PER_EMAIL) {
        return {
            valid: false,
            error: `Combined total of recipients per email (1 'to' + ${ccAddresses.length} 'cc' + ${bccAddresses.length} 'bcc' = ${recipientsPerEmail}) exceeds the limit of ${MAX_RECIPIENTS_PER_EMAIL} recipients per email. Please reduce the number of CC or BCC recipients.`
        }
    }

    // Validate email content
    if (!email.html && !email.text) {
        return {
            valid: false,
            error: 'Either html or text content must be provided'
        }
    }

    // Extract sender information
    const fromAddress = extractEmailAddress(email.from)
    const fromDomain = extractDomain(email.from)
    const { isAgentEmail } = canUserSendFromEmail(email.from)

    // Verify domain ownership (unless using agent@inbnd.dev)
    if (!isAgentEmail) {
        const userDomain = await db
            .select()
            .from(emailDomains)
            .where(
                and(
                    eq(emailDomains.userId, userId),
                    eq(emailDomains.domain, fromDomain),
                    eq(emailDomains.status, 'verified')
                )
            )
            .limit(1)

        // Check parent domain if subdomain
        let domainFound = userDomain.length > 0
        if (!domainFound && isSubdomain(fromDomain)) {
            const rootDomain = getRootDomain(fromDomain)
            if (rootDomain) {
                const parentDomain = await db
                    .select()
                    .from(emailDomains)
                    .where(
                        and(
                            eq(emailDomains.userId, userId),
                            eq(emailDomains.domain, rootDomain),
                            eq(emailDomains.status, 'verified')
                        )
                    )
                    .limit(1)
                domainFound = parentDomain.length > 0
            }
        }

        if (!domainFound) {
            return {
                valid: false,
                error: `You don't have permission to send from domain: ${fromDomain}`
            }
        }
    }

    // Validate email addresses format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const recipient of email.to) {
        const address = extractEmailAddress(recipient)
        if (!emailRegex.test(address)) {
            return {
                valid: false,
                error: `Invalid email format in 'to' array: ${recipient}`
            }
        }
    }

    // Validate cc/bcc if provided (already converted to arrays above)
    for (const recipient of [...ccAddresses, ...bccAddresses]) {
        const address = extractEmailAddress(recipient)
        if (!emailRegex.test(address)) {
            return {
                valid: false,
                error: `Invalid email format: ${recipient}`
            }
        }
    }

    return { valid: true }
}

export async function POST(request: NextRequest) {
    console.log('📦 POST /api/v2/emails/batch - Starting batch request')
    
    try {
        // Authenticate once for entire batch
        console.log('🔐 Validating request authentication')
        const { userId, error } = await validateRequest(request)
        if (!userId) {
            console.log('❌ Authentication failed:', error)
            return NextResponse.json(
                { error: error },
                { status: 401 }
            )
        }
        console.log('✅ Authentication successful for userId:', userId)

        // Check new account warmup limits (100 emails/day for first 7 days)
        const warmupCheck = await checkNewAccountWarmupLimits(userId)
        if (!warmupCheck.allowed) {
            console.log(`🚫 Warmup limit exceeded for user ${userId}`)
            return NextResponse.json(
                { 
                    error: warmupCheck.error,
                    emailsSentToday: warmupCheck.emailsSentToday,
                    dailyLimit: warmupCheck.dailyLimit,
                    daysRemaining: warmupCheck.daysRemaining
                },
                { status: 429 }
            )
        }

        // Get validation mode from header
        const validationMode = request.headers.get('x-batch-validation') || 'strict'
        console.log('📋 Validation mode:', validationMode)

        // Parse request body
        console.log('📝 Parsing request body')
        const body: PostEmailsBatchRequest = await request.json()

        // Validate that body is an object (not an array)
        if (Array.isArray(body)) {
            return NextResponse.json(
                { error: 'Request body must be a single email object with an array of recipients in the "to" field' },
                { status: 400 }
            )
        }

        // Validate the batch email request
        const validation = await validateBatchEmail(body, userId)
        if (!validation.valid) {
            return NextResponse.json(
                { error: validation.error },
                { status: 400 }
            )
        }

        // Get recipients array
        const recipients = Array.isArray(body.to) ? body.to : [body.to]
        console.log(`📊 Processing batch of ${recipients.length} recipients`)

        // Generate batch ID for grouping
        const batchId = nanoid()
        console.log('🆔 Batch ID:', batchId)

        // Process attachments once (shared across all emails)
        let processedAttachments: any[] = []
        if (body.attachments && body.attachments.length > 0) {
            try {
                const { processAttachments: processAttachmentsFn } = await import('../../helper/attachment-processor')
                processedAttachments = await processAttachmentsFn(body.attachments)
            } catch (attachmentError) {
                console.error('❌ Attachment processing error:', attachmentError)
                return NextResponse.json(
                    { error: `Failed to process attachments: ${attachmentError instanceof Error ? attachmentError.message : 'Unknown error'}` },
                    { status: 400 }
                )
            }
        }

        // Initialize QStash client
        const qstashClient = new QStashClient({ 
            token: process.env.QSTASH_TOKEN! 
        })
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/send-email`

        // Extract common email data
        const fromAddress = extractEmailAddress(body.from)
        const fromDomain = extractDomain(body.from)
        const ccAddresses = toArray(body.cc)
        const bccAddresses = toArray(body.bcc)
        const replyToAddresses = toArray(body.replyTo || body.reply_to)

        // Process each recipient - create separate email for each
        const emailIds: Array<{ id: string }> = []
        const errors: Array<{ index: number; message: string }> = []

        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i]
            const emailId = nanoid()
            const batchIndex = i

            try {
                // Create sent email record for this recipient
                // Each recipient gets their own email with only them in the 'to' field
                await db.insert(sentEmails).values({
                    id: emailId,
                    from: body.from,
                    fromAddress,
                    fromDomain,
                    to: JSON.stringify([recipient]), // Single recipient per email
                    cc: ccAddresses.length > 0 ? JSON.stringify(ccAddresses) : null,
                    bcc: bccAddresses.length > 0 ? JSON.stringify(bccAddresses) : null,
                    replyTo: replyToAddresses.length > 0 ? JSON.stringify(replyToAddresses) : null,
                    subject: body.subject,
                    textBody: body.text || null,
                    htmlBody: body.html || null,
                    headers: body.headers ? JSON.stringify(body.headers) : null,
                    attachments: processedAttachments.length > 0 ? JSON.stringify(
                        attachmentsToStorageFormat(processedAttachments)
                    ) : null,
                    tags: body.tags ? JSON.stringify(body.tags) : null,
                    status: SENT_EMAIL_STATUS.PENDING,
                    userId,
                    batchId,
                    batchIndex,
                    createdAt: new Date(),
                    updatedAt: new Date()
                })

                // Queue via QStash with delay (500ms per email)
                const delaySeconds = Math.floor((batchIndex * 500) / 1000) // Convert to seconds
                const notBefore = Math.floor(Date.now() / 1000) + delaySeconds

                console.log(`📤 Queueing email ${emailId} for recipient ${recipient} (index ${batchIndex}) with delay ${delaySeconds}s`)

                // Create email data for QStash (single recipient version)
                const emailDataForQueue: PostEmailsRequest = {
                    ...body,
                    to: recipient // Single recipient for this email
                }

                await qstashClient.publishJSON({
                    url: webhookUrl,
                    body: {
                        type: 'batch',
                        emailId,
                        userId,
                        emailData: emailDataForQueue,
                        batchId,
                        batchIndex
                    },
                    notBefore,
                    retries: 3
                })

                emailIds.push({ id: emailId })
            } catch (error) {
                console.error(`❌ Failed to queue email for recipient ${recipient}:`, error)
                
                // Update email status to failed if record was created
                try {
                    await db
                        .update(sentEmails)
                        .set({
                            status: SENT_EMAIL_STATUS.FAILED,
                            failureReason: error instanceof Error ? error.message : 'Failed to queue email',
                            updatedAt: new Date()
                        })
                        .where(eq(sentEmails.id, emailId))
                } catch (updateError) {
                    // Record might not exist, that's okay
                }

                errors.push({
                    index: i,
                    message: `Failed to queue email for recipient ${recipient}: ${error instanceof Error ? error.message : 'Unknown error'}`
                })
            }
        }

        console.log(`✅ Batch processing complete: ${emailIds.length} emails queued, ${errors.length} errors`)

        // Build response
        const response: PostEmailsBatchResponse = {
            data: emailIds
        }

        // Include errors if any occurred
        if (errors.length > 0) {
            response.errors = errors
        }

        // If no emails were queued successfully, return error
        if (emailIds.length === 0) {
            return NextResponse.json(
                { error: 'Failed to queue any emails', errors },
                { status: 500 }
            )
        }

        return NextResponse.json(response, { status: 200 })

    } catch (error) {
        console.error('💥 Unexpected error in POST /api/v2/emails/batch:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}

