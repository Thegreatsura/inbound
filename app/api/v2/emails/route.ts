import { NextRequest, NextResponse } from 'next/server'
import { validateRequest, checkNewAccountWarmupLimits } from '../helper/main'
import { processAttachments, attachmentsToStorageFormat, type AttachmentInput } from '../helper/attachment-processor'
import { buildRawEmailMessage } from '../helper/email-builder'
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'
import { db } from '@/lib/db'
import { sentEmails, emailDomains, scheduledEmails, SENT_EMAIL_STATUS, SCHEDULED_EMAIL_STATUS } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { Autumn as autumn } from 'autumn-js'
import { nanoid } from 'nanoid'
import { canUserSendFromEmail, extractEmailAddress, extractDomain } from '@/lib/email-management/agent-email-helper'
import { parseScheduledAt, validateScheduledDate, formatScheduledDate } from '@/lib/utils/date-parser'
import { Client as QStashClient } from '@upstash/qstash'
import { waitUntil } from '@vercel/functions'
import { evaluateSending } from '@/lib/email-management/email-evaluation'
import { isSubdomain, getRootDomain } from '@/lib/domains-and-dns/domain-utils'
import { getTenantSendingInfoForDomainOrParent, getAgentIdentityArn, type TenantSendingInfo } from '@/lib/aws-ses/identity-arn-helper'

/**
 * POST /api/v2/emails
 * Send an email through the API (Resend-compatible)
 * Supports both session-based auth and API key auth
 * Has tests? ❌
 * Has logging? ✅
 * Has types? ✅
 */

// POST /api/v2/emails types
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
    tags?: Array<{  // Resend-compatible tags
        name: string
        value: string
    }>
    scheduled_at?: string // ISO 8601 or natural language ("in 1 hour", "tomorrow at 9am")
    timezone?: string     // User's timezone for natural language parsing (defaults to UTC)
}

export interface PostEmailsResponse {
    id: string
    messageId: string  // AWS SES Message ID
}

// Helper functions moved to @/lib/email-management/agent-email-helper

// Helper function to convert string or array to array
function toArray(value: string | string[] | undefined): string[] {
    if (!value) return []
    return Array.isArray(value) ? value : [value]
}

// Helper function to parse email with optional display name
function parseEmailWithName(emailString: string): { email: string; name?: string } {
    const match = emailString.match(/^(.+?)\s*<([^>]+)>$/)
    if (match) {
        return {
            name: match[1].replace(/^["']|["']$/g, '').trim(), // Remove quotes if present
            email: match[2].trim()
        }
    }
    return { email: emailString.trim() }
}

// Helper function to format email with display name
function formatEmailWithName(email: string, name?: string): string {
    if (name && name.trim()) {
        // Escape name if it contains special characters
        const escapedName = name.includes(',') || name.includes(';') || name.includes('<') || name.includes('>') 
            ? `"${name.replace(/"/g, '\\"')}"` 
            : name
        return `${escapedName} <${email}>`
    }
    return email
}

// buildRawEmailMessage function moved to ../helper/email-builder.ts

// Initialize SES client
const awsRegion = process.env.AWS_REGION || 'us-east-2'
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

let sesClient: SESv2Client | null = null

if (awsAccessKeyId && awsSecretAccessKey) {
    sesClient = new SESv2Client({
        region: awsRegion,
        credentials: {
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
        }
    })
} else {
    console.warn('⚠️ AWS credentials not configured. Email sending will not work.')
}

export async function POST(request: NextRequest) {
    console.log('📧 POST /api/v2/emails - Starting request')
    
    try {
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

        // Check for idempotency key
        const idempotencyKey = request.headers.get('Idempotency-Key')
        if (idempotencyKey) {
            console.log('🔑 Idempotency key provided:', idempotencyKey)
            
            // Check if we've already processed this request
            const existingEmail = await db
                .select()
                .from(sentEmails)
                .where(
                    and(
                        eq(sentEmails.userId, userId),
                        eq(sentEmails.idempotencyKey, idempotencyKey)
                    )
                )
                .limit(1)
            
            if (existingEmail.length > 0) {
                console.log('♻️ Idempotent request - returning existing email:', existingEmail[0].id)
                return NextResponse.json({ id: existingEmail[0].id })
            }
        }

        console.log('📝 Parsing request body')
        const body: PostEmailsRequest = await request.json()
        
        // Validate required fields
        if (!body.from || !body.to || !body.subject) {
            console.log('⚠️ Missing required fields')
            return NextResponse.json(
                { error: 'Missing required fields: from, to, and subject are required' },
                { status: 400 }
            )
        }

        // Validate email content
        if (!body.html && !body.text) {
            console.log('⚠️ No email content provided')
            return NextResponse.json(
                { error: 'Either html or text content must be provided' },
                { status: 400 }
            )
        }

        // If scheduled_at is provided, handle as a scheduled email
        if (body.scheduled_at) {
            console.log('⏰ Scheduled email detected, redirecting to scheduling flow')
            
            // Parse and validate scheduled_at
            const parsedDate = parseScheduledAt(body.scheduled_at, body.timezone || 'UTC')
            if (!parsedDate.isValid) {
                console.log('❌ Invalid scheduled_at:', parsedDate.error)
                return NextResponse.json(
                    { error: parsedDate.error },
                    { status: 400 }
                )
            }

            // Validate that the date is in the future
            const dateValidation = validateScheduledDate(parsedDate.date)
            if (!dateValidation.isValid) {
                console.log('❌ Invalid schedule time:', dateValidation.error)
                return NextResponse.json(
                    { error: dateValidation.error },
                    { status: 400 }
                )
            }

            console.log('✅ Parsed scheduled_at:', formatScheduledDate(parsedDate.date))
            
            // Continue with scheduling flow below (will be handled in the existing logic)
        }

        // Extract sender information
        const fromAddress = extractEmailAddress(body.from)
        const fromDomain = extractDomain(body.from)
        
        console.log('📧 Sender details:', { from: body.from, address: fromAddress, domain: fromDomain })

        // Check if this is the special agent@inbnd.dev email (allowed for all users)
        const { isAgentEmail } = canUserSendFromEmail(body.from)
        
        if (isAgentEmail) {
            console.log('✅ Using agent@inbnd.dev - allowed for all users')
        } else {
            // Verify sender domain ownership for non-agent emails
            console.log('🔍 Verifying domain ownership for:', fromDomain)
            let userDomain = await db
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

            // NEW: If not found and is subdomain, check parent root domain
            if (userDomain.length === 0 && isSubdomain(fromDomain)) {
                const rootDomain = getRootDomain(fromDomain)
                if (rootDomain) {
                    console.log(`🔍 Checking parent domain ${rootDomain} for subdomain ${fromDomain}`)
                    userDomain = await db
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
                    
                    if (userDomain.length > 0) {
                        console.log(`✅ Allowing send from ${fromDomain} - parent ${rootDomain} is verified`)
                    }
                }
            }

            if (userDomain.length === 0) {
                console.log('❌ User does not own the sender domain:', fromDomain)
                return NextResponse.json(
                    { error: `You don't have permission to send from domain: ${fromDomain}` },
                    { status: 403 }
                )
            }

            console.log('✅ Domain ownership verified')
        }

        // Convert recipients to arrays (support both snake_case and camelCase)
        const toAddresses = toArray(body.to)
        const ccAddresses = toArray(body.cc)
        const bccAddresses = toArray(body.bcc)
        const replyToAddresses = toArray(body.replyTo || body.reply_to) // Support both formats

        // Validate email addresses
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        const allRecipients = [...toAddresses, ...ccAddresses, ...bccAddresses]
        
        for (const email of allRecipients) {
            const address = extractEmailAddress(email)
            if (!emailRegex.test(address)) {
                console.log('⚠️ Invalid email format:', email)
                return NextResponse.json(
                    { error: `Invalid email format: ${email}` },
                    { status: 400 }
                )
            }
        }

        // Process attachments if provided
        console.log('📎 Processing attachments')
        let processedAttachments: any[] = []
        if (body.attachments && body.attachments.length > 0) {
            try {
                processedAttachments = await processAttachments(body.attachments)
                console.log('✅ Attachments processed successfully:', processedAttachments.length)
            } catch (attachmentError) {
                console.error('❌ Attachment processing error:', attachmentError)
                return NextResponse.json(
                    { error: attachmentError instanceof Error ? attachmentError.message : 'Failed to process attachments' },
                    { status: 400 }
                )
            }
        }

        // Check Autumn for email sending limits
        console.log('🔍 Checking email sending limits with Autumn')
        const { data: emailCheck, error: emailCheckError } = await autumn.check({
            customer_id: userId,
            feature_id: "emails_sent"
        })

        if (emailCheckError) {
            console.error('❌ Autumn email check error:', emailCheckError)
            return NextResponse.json(
                { error: 'Failed to check email sending limits' },
                { status: 500 }
            )
        }

        console.log('🔍 Email check:', emailCheck)

        if (!emailCheck.allowed) {
            console.log('❌ Email sending limit reached for user:', userId)
            return NextResponse.json(
                { error: 'Email sending limit reached. Please upgrade your plan to send more emails.' },
                { status: 429 }
            )
        }

        // If scheduled_at is provided, create scheduled email instead of sending immediately
        if (body.scheduled_at) {
            const parsedDate = parseScheduledAt(body.scheduled_at, body.timezone || 'UTC')
            const scheduledEmailId = nanoid()
            console.log('💾 Creating scheduled email record:', scheduledEmailId)

            const scheduledEmailData = {
                id: scheduledEmailId,
                userId,
                scheduledAt: parsedDate.date,
                timezone: parsedDate.timezone,
                status: SCHEDULED_EMAIL_STATUS.SCHEDULED,
                fromAddress: body.from,
                fromDomain,
                toAddresses: JSON.stringify(toAddresses),
                ccAddresses: ccAddresses.length > 0 ? JSON.stringify(ccAddresses) : null,
                bccAddresses: bccAddresses.length > 0 ? JSON.stringify(bccAddresses) : null,
                replyToAddresses: replyToAddresses.length > 0 ? JSON.stringify(replyToAddresses) : null,
                subject: body.subject,
                textBody: body.text || null,
                htmlBody: body.html || null,
                headers: body.headers ? JSON.stringify(body.headers) : null,
                attachments: processedAttachments.length > 0 ? JSON.stringify(attachmentsToStorageFormat(processedAttachments)) : null,
                tags: body.tags ? JSON.stringify(body.tags) : null,
                idempotencyKey,
                createdAt: new Date(),
                updatedAt: new Date()
            }

            // Insert into database
            const [createdScheduledEmail] = await db
                .insert(scheduledEmails)
                .values(scheduledEmailData)
                .returning()

            console.log('✅ Scheduled email created in database:', scheduledEmailId)

            // Schedule with QStash
            try {
                const qstashClient = new QStashClient({ 
                    token: process.env.QSTASH_TOKEN! 
                })

                const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/send-email`
                const notBefore = Math.floor(parsedDate.date.getTime() / 1000)

                console.log('📅 Scheduling with QStash:', {
                    url: webhookUrl,
                    notBefore: new Date(notBefore * 1000).toISOString(),
                    scheduledEmailId
                })

                const scheduleResponse = await qstashClient.publishJSON({
                    url: webhookUrl,
                    body: { 
                        type: 'scheduled',
                        scheduledEmailId: scheduledEmailId 
                    },
                    notBefore: notBefore,
                    retries: 3
                })

                // Update with QStash schedule ID
                await db
                    .update(scheduledEmails)
                    .set({
                        qstashScheduleId: scheduleResponse.messageId,
                        updatedAt: new Date()
                    })
                    .where(eq(scheduledEmails.id, scheduledEmailId))

                console.log('✅ Scheduled with QStash, messageId:', scheduleResponse.messageId)

                return NextResponse.json({
                    id: scheduledEmailId,
                    scheduled_at: formatScheduledDate(createdScheduledEmail.scheduledAt),
                    status: 'scheduled',
                    timezone: createdScheduledEmail.timezone || 'UTC'
                }, { status: 201 })

            } catch (qstashError) {
                console.error('❌ Failed to schedule with QStash:', qstashError)
                
                // Clean up the database record
                await db
                    .update(scheduledEmails)
                    .set({
                        status: SCHEDULED_EMAIL_STATUS.FAILED,
                        lastError: qstashError instanceof Error ? qstashError.message : 'Failed to schedule with QStash',
                        updatedAt: new Date()
                    })
                    .where(eq(scheduledEmails.id, scheduledEmailId))

                return NextResponse.json(
                    { 
                        error: 'Failed to schedule email with QStash', 
                        details: qstashError instanceof Error ? qstashError.message : 'Unknown error' 
                    },
                    { status: 500 }
                )
            }
        }

        // Create sent email record (for immediate sending)
        const emailId = nanoid()
        console.log('💾 Creating sent email record:', emailId)
        
        const sentEmailRecord = await db.insert(sentEmails).values({
            id: emailId,
            from: body.from,
            fromAddress,
            fromDomain,
            to: JSON.stringify(toAddresses),
            cc: ccAddresses.length > 0 ? JSON.stringify(ccAddresses) : null,
            bcc: bccAddresses.length > 0 ? JSON.stringify(bccAddresses) : null,
            replyTo: replyToAddresses.length > 0 ? JSON.stringify(replyToAddresses) : null,
            subject: body.subject,
            textBody: body.text,
            htmlBody: body.html,
            headers: body.headers ? JSON.stringify(body.headers) : null,
            attachments: processedAttachments.length > 0 ? JSON.stringify(
                attachmentsToStorageFormat(processedAttachments)
            ) : null,
            tags: body.tags ? JSON.stringify(body.tags) : null, // Store tags
            status: SENT_EMAIL_STATUS.PENDING,
            userId,
            idempotencyKey,
            createdAt: new Date(),
            updatedAt: new Date()
        }).returning()

        // Check if SES is configured
        if (!sesClient) {
            console.log('❌ AWS SES not configured')
            
            // Update email status to failed
            await db
                .update(sentEmails)
                .set({
                    status: SENT_EMAIL_STATUS.FAILED,
                    failureReason: 'AWS SES not configured',
                    updatedAt: new Date()
                })
                .where(eq(sentEmails.id, emailId))
            
            return NextResponse.json(
                { error: 'Email service not configured. Please contact support.' },
                { status: 500 }
            )
        }

        try {
            console.log('📤 Sending email via AWS SES')
            
            // Parse the from address to support display names
            const fromParsed = parseEmailWithName(body.from)
            const sourceEmail = fromParsed.email
            const formattedFromAddress = formatEmailWithName(sourceEmail, fromParsed.name)
            
            // Get the tenant sending info (identity ARN, configuration set, and tenant name) for tenant-level tracking
            // Per AWS docs: https://docs.aws.amazon.com/ses/latest/dg/tenants.html
            let tenantSendingInfo: TenantSendingInfo = { identityArn: null, configurationSetName: null, tenantName: null }
            if (isAgentEmail) {
                // Agent emails don't use tenant tracking - they go through the main account
                tenantSendingInfo = { identityArn: getAgentIdentityArn(), configurationSetName: null, tenantName: null }
            } else {
                // Check if sending from a subdomain and get parent if needed
                const parentDomain = isSubdomain(fromDomain) ? getRootDomain(fromDomain) : undefined
                tenantSendingInfo = await getTenantSendingInfoForDomainOrParent(userId, fromDomain, parentDomain || undefined)
            }
            
            if (tenantSendingInfo.identityArn) {
                console.log(`🏢 Using SourceArn for tenant tracking: ${tenantSendingInfo.identityArn}`)
            } else {
                console.warn('⚠️ No SourceArn available - email will not be tracked at tenant level')
            }
            
            if (tenantSendingInfo.configurationSetName) {
                console.log(`📋 Using ConfigurationSet for tenant tracking: ${tenantSendingInfo.configurationSetName}`)
            } else {
                console.warn('⚠️ No ConfigurationSet available - tenant metrics may not be tracked correctly')
            }
            
            if (tenantSendingInfo.tenantName) {
                console.log(`🏠 Using TenantName for AWS SES tenant tracking: ${tenantSendingInfo.tenantName}`)
            } else {
                console.warn('⚠️ No TenantName available - email will NOT appear in tenant dashboard!')
            }
            
            // Use SESv2 SendEmailCommand with Raw content for full MIME support (attachments, display names, etc.)
            console.log('📧 Building raw email message with full MIME support')
            
            const rawMessage = buildRawEmailMessage({
                from: formattedFromAddress,
                to: toAddresses,
                cc: ccAddresses.length > 0 ? ccAddresses : undefined,
                bcc: bccAddresses.length > 0 ? bccAddresses : undefined,
                replyTo: replyToAddresses.length > 0 ? replyToAddresses : undefined,
                subject: body.subject,
                textBody: body.text,
                htmlBody: body.html,
                customHeaders: body.headers,
                attachments: processedAttachments,
                date: new Date()
            })
            
            // Use SESv2 SendEmailCommand with TenantName for proper tenant-level tracking
            // Per AWS docs: https://docs.aws.amazon.com/ses/latest/dg/tenants.html
            const rawCommand = new SendEmailCommand({
                FromEmailAddress: sourceEmail,
                // FromEmailAddressIdentityArn associates the email with the tenant's identity
                ...(tenantSendingInfo.identityArn && { FromEmailAddressIdentityArn: tenantSendingInfo.identityArn }),
                Destination: {
                    ToAddresses: toAddresses.map(extractEmailAddress),
                    CcAddresses: ccAddresses.length > 0 ? ccAddresses.map(extractEmailAddress) : undefined,
                    BccAddresses: bccAddresses.length > 0 ? bccAddresses.map(extractEmailAddress) : undefined
                },
                Content: {
                    Raw: {
                        Data: Buffer.from(rawMessage)
                    }
                },
                // ConfigurationSetName is REQUIRED for tenant-level metrics tracking
                ...(tenantSendingInfo.configurationSetName && { ConfigurationSetName: tenantSendingInfo.configurationSetName }),
                // TenantName is REQUIRED for AWS SES to track this email under the tenant
                // Without this, metrics won't appear in the tenant dashboard!
                ...(tenantSendingInfo.tenantName && { TenantName: tenantSendingInfo.tenantName })
            })
            
            const sesResponse = await sesClient.send(rawCommand)
            const messageId = sesResponse.MessageId

            console.log('✅ Email sent successfully via SES:', messageId)

            // Update email record with success
            await db
                .update(sentEmails)
                .set({
                    status: SENT_EMAIL_STATUS.SENT,
                    messageId,
                    providerResponse: JSON.stringify(sesResponse),
                    sentAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(sentEmails.id, emailId))

            // Track email usage with Autumn (only if not unlimited)
            if (!emailCheck.unlimited) {
                console.log('📊 Tracking email usage with Autumn')
                const { error: trackError } = await autumn.track({
                    customer_id: userId,
                    feature_id: "emails_sent",
                    value: 1,
                })

                if (trackError) {
                    console.error('❌ Failed to track email usage:', trackError)
                    // Don't fail the request if tracking fails
                }
            }

            // Evaluate email for security risks (non-blocking)
            waitUntil(
                evaluateSending(emailId, userId, {
                    from: body.from,
                    to: body.to,
                    subject: body.subject,
                    textBody: body.text,
                    htmlBody: body.html,
                })
            )

            console.log('✅ Email processing complete')
            const response: PostEmailsResponse = {
                id: emailId,
                messageId: messageId || ''
            }
            return NextResponse.json(response, { status: 200 })

        } catch (sesError) {
            console.error('❌ SES send error:', sesError)
            
            // Update email status to failed
            await db
                .update(sentEmails)
                .set({
                    status: SENT_EMAIL_STATUS.FAILED,
                    failureReason: sesError instanceof Error ? sesError.message : 'Unknown SES error',
                    providerResponse: JSON.stringify(sesError),
                    updatedAt: new Date()
                })
                .where(eq(sentEmails.id, emailId))
            
            return NextResponse.json(
                { error: 'Failed to send email. Please try again later.' },
                { status: 500 }
            )
        }

    } catch (error) {
        console.error('💥 Unexpected error in POST /api/v2/emails:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
} 