import { NextRequest, NextResponse } from 'next/server'
import { validateRequest } from '../../helper/main'
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
 * Send batch emails through the API (Resend-compatible)
 * Supports up to 100 emails per batch
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

export type PostEmailsBatchRequest = PostEmailsRequest[]

export interface PostEmailsBatchResponse {
    data: Array<{ id: string }>
    errors?: Array<{ index: number; message: string }>
}

// Helper function to convert string or array to array
function toArray(value: string | string[] | undefined): string[] {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
}

// Validation function for a single email
interface ValidationResult {
    valid: boolean
    error?: string
}

async function validateEmail(
    email: PostEmailsRequest,
    userId: string,
    index: number
): Promise<ValidationResult> {
    // Validate required fields
    if (!email.from || !email.to || !email.subject) {
        return {
            valid: false,
            error: `Email at index ${index}: Missing required fields: from, to, and subject are required`
        }
    }

    // Validate email content
    if (!email.html && !email.text) {
        return {
            valid: false,
            error: `Email at index ${index}: Either html or text content must be provided`
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
                error: `Email at index ${index}: You don't have permission to send from domain: ${fromDomain}`
            }
        }
    }

    // Convert recipients to arrays
    const toAddresses = toArray(email.to)
    const ccAddresses = toArray(email.cc)
    const bccAddresses = toArray(email.bcc)

    // Validate combined recipients count (max 50 per email)
    const allRecipients = [...toAddresses, ...ccAddresses, ...bccAddresses]
    if (allRecipients.length > 50) {
        return {
            valid: false,
            error: `Email at index ${index}: Combined total of all recipients (to, cc, bcc) should not exceed 50 addresses`
        }
    }

    // Validate email addresses format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    for (const recipient of allRecipients) {
        const address = extractEmailAddress(recipient)
        if (!emailRegex.test(address)) {
            return {
                valid: false,
                error: `Email at index ${index}: Invalid email format: ${recipient}`
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

        // Get validation mode from header
        const validationMode = request.headers.get('x-batch-validation') || 'strict'
        console.log('📋 Validation mode:', validationMode)

        // Parse request body
        console.log('📝 Parsing request body')
        const body: PostEmailsBatchRequest = await request.json()

        // Validate that body is an array
        if (!Array.isArray(body)) {
            return NextResponse.json(
                { error: 'Request body must be an array of email objects' },
                { status: 400 }
            )
        }

        // Validate batch size (max 1000 emails)
        if (body.length === 0) {
            return NextResponse.json(
                { error: 'Batch must contain at least one email' },
                { status: 400 }
            )
        }

        if (body.length > 1000) {
            return NextResponse.json(
                { error: 'Batch cannot contain more than 1000 emails, please split your batch into smaller batches' },
                { status: 400 }
            )
        }

        console.log(`📊 Processing batch of ${body.length} emails`)

        // Validate all emails
        const validationResults: Array<{ index: number; result: ValidationResult }> = []
        const errors: Array<{ index: number; message: string }> = []

        for (let i = 0; i < body.length; i++) {
            const result = await validateEmail(body[i], userId, i)
            validationResults.push({ index: i, result })
            
            if (!result.valid) {
                errors.push({ index: i, message: result.error || 'Validation failed' })
            }
        }

        // In strict mode, return error if any validation failed
        if (validationMode === 'strict' && errors.length > 0) {
            console.log('❌ Strict mode: Validation failed for some emails')
            return NextResponse.json(
                { error: 'Batch validation failed', errors },
                { status: 400 }
            )
        }

        // In permissive mode, continue with valid emails only
        const validEmails = body.filter((_, index) => {
            const validation = validationResults.find(v => v.index === index)
            return validation?.result.valid
        })

        console.log(`✅ ${validEmails.length} valid emails, ${errors.length} invalid emails`)

        // Generate batch ID for grouping
        const batchId = nanoid()
        console.log('🆔 Batch ID:', batchId)

        // Initialize QStash client
        const qstashClient = new QStashClient({ 
            token: process.env.QSTASH_TOKEN! 
        })
        const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/send-email`

        // Process each valid email
        const emailIds: Array<{ id: string }> = []
        const validIndices: number[] = []

        for (let i = 0; i < body.length; i++) {
            const email = body[i]
            const validation = validationResults.find(v => v.index === i)
            
            // Skip invalid emails in permissive mode
            if (validationMode === 'permissive' && !validation?.result.valid) {
                continue
            }

            validIndices.push(i)
            const emailId = nanoid()
            const batchIndex = validIndices.length - 1

            // Create initial sentEmails record with PENDING status
            const toAddresses = toArray(email.to)
            const ccAddresses = toArray(email.cc)
            const bccAddresses = toArray(email.bcc)
            const replyToAddresses = toArray(email.replyTo || email.reply_to)
            const fromAddress = extractEmailAddress(email.from)
            const fromDomain = extractDomain(email.from)

            // Process attachments if present
            let processedAttachments: any[] = []
            if (email.attachments && email.attachments.length > 0) {
                try {
                    const { processAttachments: processAttachmentsFn } = await import('../../helper/attachment-processor')
                    processedAttachments = await processAttachmentsFn(email.attachments)
                } catch (attachmentError) {
                    console.error(`❌ Attachment processing error for email ${i}:`, attachmentError)
                    // In permissive mode, add to errors and continue
                    if (validationMode === 'permissive') {
                        errors.push({
                            index: i,
                            message: `Failed to process attachments: ${attachmentError instanceof Error ? attachmentError.message : 'Unknown error'}`
                        })
                        continue
                    } else {
                        // This shouldn't happen in strict mode, but handle it
                        return NextResponse.json(
                            { error: `Failed to process attachments for email at index ${i}` },
                            { status: 400 }
                        )
                    }
                }
            }

            // Create sent email record
            await db.insert(sentEmails).values({
                id: emailId,
                from: email.from,
                fromAddress,
                fromDomain,
                to: JSON.stringify(toAddresses),
                cc: ccAddresses.length > 0 ? JSON.stringify(ccAddresses) : null,
                bcc: bccAddresses.length > 0 ? JSON.stringify(bccAddresses) : null,
                replyTo: replyToAddresses.length > 0 ? JSON.stringify(replyToAddresses) : null,
                subject: email.subject,
                textBody: email.text || null,
                htmlBody: email.html || null,
                headers: email.headers ? JSON.stringify(email.headers) : null,
                attachments: processedAttachments.length > 0 ? JSON.stringify(
                    attachmentsToStorageFormat(processedAttachments)
                ) : null,
                tags: email.tags ? JSON.stringify(email.tags) : null,
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

            console.log(`📤 Queueing email ${emailId} (index ${batchIndex}) with delay ${delaySeconds}s`)

            try {
                await qstashClient.publishJSON({
                    url: webhookUrl,
                    body: {
                        type: 'batch',
                        emailId,
                        userId,
                        emailData: email,
                        batchId,
                        batchIndex
                    },
                    notBefore,
                    retries: 3
                })

                emailIds.push({ id: emailId })
            } catch (qstashError) {
                console.error(`❌ Failed to queue email ${emailId}:`, qstashError)
                
                // Update email status to failed
                await db
                    .update(sentEmails)
                    .set({
                        status: SENT_EMAIL_STATUS.FAILED,
                        failureReason: qstashError instanceof Error ? qstashError.message : 'Failed to queue email',
                        updatedAt: new Date()
                    })
                    .where(eq(sentEmails.id, emailId))

                // In permissive mode, add to errors
                if (validationMode === 'permissive') {
                    errors.push({
                        index: i,
                        message: `Failed to queue email: ${qstashError instanceof Error ? qstashError.message : 'Unknown error'}`
                    })
                } else {
                    // In strict mode, this is unexpected but handle it
                    return NextResponse.json(
                        { error: `Failed to queue email at index ${i}` },
                        { status: 500 }
                    )
                }
            }
        }

        console.log(`✅ Batch processing complete: ${emailIds.length} emails queued`)

        // Build response
        const response: PostEmailsBatchResponse = {
            data: emailIds
        }

        // Include errors array only in permissive mode if there are errors
        if (validationMode === 'permissive' && errors.length > 0) {
            response.errors = errors
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

