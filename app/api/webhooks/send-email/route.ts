import { NextRequest, NextResponse } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { db } from '@/lib/db'
import { scheduledEmails, sentEmails, SCHEDULED_EMAIL_STATUS, SENT_EMAIL_STATUS } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses'
import { buildRawEmailMessage } from '../../v2/helper/email-builder'
import { extractEmailAddress } from '@/lib/email-management/agent-email-helper'
import { nanoid } from 'nanoid'
import { waitUntil } from '@vercel/functions'
import { evaluateSending } from '@/lib/email-management/email-evaluation'

/**
 * POST /api/webhooks/send-email
 * QStash webhook for processing scheduled emails
 * 
 * This endpoint is called by QStash when a scheduled email is due to be sent.
 * 
 * Security: Protected by QStash signature verification
 * Has tests? ❌ (TODO)
 * Has logging? ✅
 * Has types? ✅
 */

// Initialize SES client
const awsRegion = process.env.AWS_REGION || 'us-east-2'
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

let sesClient: SESClient | null = null

if (awsAccessKeyId && awsSecretAccessKey) {
    sesClient = new SESClient({
        region: awsRegion,
        credentials: {
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
        }
    })
} else {
    console.warn('⚠️ AWS credentials not configured. Scheduled email processing will not work.')
}

// Initialize QStash receiver for signature verification
const qstashReceiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

interface QStashPayload {
    type: 'scheduled'
    scheduledEmailId: string
}

export async function POST(request: NextRequest) {
    console.log('📨 QStash Webhook - Received scheduled email request')

    try {
        // Verify QStash signature
        const signature = request.headers.get('upstash-signature')
        if (!signature) {
            console.error('❌ QStash Webhook - Missing signature')
            return NextResponse.json({ error: 'Missing signature' }, { status: 401 })
        }

        // Get raw body for signature verification
        const body = await request.text()
        
        try {
            await qstashReceiver.verify({
                signature,
                body,
            })
            console.log('✅ QStash signature verified')
        } catch (verifyError) {
            console.error('❌ QStash signature verification failed:', verifyError)
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        // Parse the payload
        const payload: QStashPayload = JSON.parse(body)
        
        // Validate payload structure
        if (payload.type !== 'scheduled' || !payload.scheduledEmailId) {
            console.error('❌ QStash Webhook - Invalid payload structure')
            return NextResponse.json({ error: 'Invalid payload structure' }, { status: 400 })
        }

        const { scheduledEmailId } = payload
        console.log('📧 Processing scheduled email:', scheduledEmailId)

        // Check if SES is configured
        if (!sesClient) {
            console.error('❌ AWS SES not configured')
            return NextResponse.json({
                error: 'AWS SES not configured'
            }, { status: 500 })
        }

        // Fetch the scheduled email from database
        const [scheduledEmail] = await db
            .select()
            .from(scheduledEmails)
            .where(eq(scheduledEmails.id, scheduledEmailId))
            .limit(1)

        if (!scheduledEmail) {
            console.error('❌ Scheduled email not found:', scheduledEmailId)
            // Return 400 so QStash doesn't retry (email was deleted/doesn't exist)
            return NextResponse.json({ error: 'Scheduled email not found' }, { status: 400 })
        }

        // Check if already processed
        if (scheduledEmail.status === SCHEDULED_EMAIL_STATUS.SENT) {
            console.log('✅ Email already sent, skipping:', scheduledEmailId)
            return NextResponse.json({ message: 'Email already sent' }, { status: 200 })
        }

        if (scheduledEmail.status === SCHEDULED_EMAIL_STATUS.CANCELLED) {
            console.log('⏭️ Email was cancelled, skipping:', scheduledEmailId)
            return NextResponse.json({ message: 'Email was cancelled' }, { status: 200 })
        }

        // Mark as processing to prevent duplicate processing
        await db
            .update(scheduledEmails)
            .set({
                status: SCHEDULED_EMAIL_STATUS.PROCESSING,
                attempts: (scheduledEmail.attempts || 0) + 1,
                updatedAt: new Date()
            })
            .where(eq(scheduledEmails.id, scheduledEmailId))

        // Parse email data
        const toAddresses = JSON.parse(scheduledEmail.toAddresses)
        const ccAddresses = scheduledEmail.ccAddresses ? JSON.parse(scheduledEmail.ccAddresses) : []
        const bccAddresses = scheduledEmail.bccAddresses ? JSON.parse(scheduledEmail.bccAddresses) : []
        const replyToAddresses = scheduledEmail.replyToAddresses ? JSON.parse(scheduledEmail.replyToAddresses) : []
        const headers = scheduledEmail.headers ? JSON.parse(scheduledEmail.headers) : undefined
        const rawAttachments = scheduledEmail.attachments ? JSON.parse(scheduledEmail.attachments) : []
        const tags = scheduledEmail.tags ? JSON.parse(scheduledEmail.tags) : []

        // Validate and fix attachment data - ensure contentType is set
        const attachments = rawAttachments.map((att: any, index: number) => {
            if (!att.contentType && !att.content_type) {
                console.log(`⚠️ Attachment ${index + 1} missing contentType, using fallback`)
                const filename = att.filename || 'unknown'
                const ext = filename.toLowerCase().split('.').pop()
                let contentType = 'application/octet-stream'

                // Common file type mappings
                switch (ext) {
                    case 'pdf': contentType = 'application/pdf'; break
                    case 'jpg': case 'jpeg': contentType = 'image/jpeg'; break
                    case 'png': contentType = 'image/png'; break
                    case 'gif': contentType = 'image/gif'; break
                    case 'txt': contentType = 'text/plain'; break
                    case 'html': contentType = 'text/html'; break
                    case 'json': contentType = 'application/json'; break
                    case 'zip': contentType = 'application/zip'; break
                    case 'doc': contentType = 'application/msword'; break
                    case 'docx': contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'; break
                    case 'xls': contentType = 'application/vnd.ms-excel'; break
                    case 'xlsx': contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'; break
                }

                return {
                    ...att,
                    contentType: contentType
                }
            }

            return {
                ...att,
                contentType: att.contentType || att.content_type
            }
        })

        // Create sent email record first (for tracking)
        const sentEmailId = nanoid()
        const sentEmailData = {
            id: sentEmailId,
            from: scheduledEmail.fromAddress,
            fromAddress: extractEmailAddress(scheduledEmail.fromAddress),
            fromDomain: scheduledEmail.fromDomain,
            to: JSON.stringify(toAddresses),
            cc: ccAddresses.length > 0 ? JSON.stringify(ccAddresses) : null,
            bcc: bccAddresses.length > 0 ? JSON.stringify(bccAddresses) : null,
            replyTo: replyToAddresses.length > 0 ? JSON.stringify(replyToAddresses) : null,
            subject: scheduledEmail.subject,
            textBody: scheduledEmail.textBody,
            htmlBody: scheduledEmail.htmlBody,
            headers: scheduledEmail.headers,
            attachments: scheduledEmail.attachments,
            tags: scheduledEmail.tags,
            status: SENT_EMAIL_STATUS.PENDING,
            provider: 'ses',
            userId: scheduledEmail.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        }

        const [createdSentEmail] = await db
            .insert(sentEmails)
            .values(sentEmailData)
            .returning()

        // Build raw email message
        console.log('📧 Building raw email message for scheduled email')
        const rawMessage = buildRawEmailMessage({
            from: scheduledEmail.fromAddress,
            to: toAddresses,
            cc: ccAddresses.length > 0 ? ccAddresses : undefined,
            bcc: bccAddresses.length > 0 ? bccAddresses : undefined,
            replyTo: replyToAddresses.length > 0 ? replyToAddresses : undefined,
            subject: scheduledEmail.subject,
            textBody: scheduledEmail.textBody || undefined,
            htmlBody: scheduledEmail.htmlBody || undefined,
            customHeaders: headers,
            attachments: attachments,
            date: new Date()
        })

        // Send via AWS SES
        const rawCommand = new SendRawEmailCommand({
            RawMessage: {
                Data: Buffer.from(rawMessage)
            },
            Source: extractEmailAddress(scheduledEmail.fromAddress),
            Destinations: [...toAddresses, ...ccAddresses, ...bccAddresses].map(extractEmailAddress)
        })

        const sesResponse = await sesClient.send(rawCommand)
        const messageId = sesResponse.MessageId

        console.log('✅ Scheduled email sent successfully via SES:', messageId)

        // Update both records with success
        await Promise.all([
            // Update scheduled email
            db.update(scheduledEmails)
                .set({
                    status: SCHEDULED_EMAIL_STATUS.SENT,
                    sentAt: new Date(),
                    sentEmailId: createdSentEmail.id,
                    updatedAt: new Date()
                })
                .where(eq(scheduledEmails.id, scheduledEmailId)),

            // Update sent email
            db.update(sentEmails)
                .set({
                    status: SENT_EMAIL_STATUS.SENT,
                    messageId: messageId,
                    providerResponse: JSON.stringify(sesResponse),
                    sentAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(sentEmails.id, createdSentEmail.id))
        ])

        // Evaluate email for security risks (non-blocking)
        waitUntil(
            evaluateSending(createdSentEmail.id, scheduledEmail.userId, {
                from: scheduledEmail.fromAddress,
                to: toAddresses,
                subject: scheduledEmail.subject,
                textBody: scheduledEmail.textBody || undefined,
                htmlBody: scheduledEmail.htmlBody || undefined,
            })
        )

        console.log('✅ Scheduled email processed successfully:', scheduledEmailId)

        return NextResponse.json({
            success: true,
            emailId: scheduledEmailId,
            messageId: messageId
        }, { status: 200 })

    } catch (error) {
        console.error('❌ QStash Webhook - Error processing scheduled email:', error)
        
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        // Try to update the scheduled email with error info
        try {
            const body = await request.text()
            const payload: QStashPayload = JSON.parse(body)
            
            if (payload.scheduledEmailId) {
                await db
                    .update(scheduledEmails)
                    .set({
                        lastError: errorMessage,
                        updatedAt: new Date()
                    })
                    .where(eq(scheduledEmails.id, payload.scheduledEmailId))
            }
        } catch (updateError) {
            console.error('❌ Failed to update error in database:', updateError)
        }

        // Return 500 so QStash will retry
        return NextResponse.json({
            error: 'Failed to process scheduled email',
            details: errorMessage
        }, { status: 500 })
    }
}

