import { NextRequest, NextResponse } from 'next/server'
import { validateRequest } from '../../helper/main'
import { db } from '@/lib/db'
import { sentEmails, structuredEmails, scheduledEmails } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * GET /api/v2/emails/{id}
 * Retrieve a single email by ID (searches inbound, outbound, and scheduled emails)
 * Supports both session-based auth and API key auth
 * Has tests? ❌
 * Has logging? ✅
 * Has types? ✅
 */

// GET /api/v2/emails/{id} types
export interface GetEmailByIdResponse {
    object: "email"
    id: string
    to: string[]
    from: string
    created_at: string
    subject: string
    html: string | null
    text: string | null
    bcc: (string | null)[]
    cc: (string | null)[]
    reply_to: (string | null)[]
    last_event: string
    email_type: "inbound" | "outbound" | "scheduled"
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    console.log('📧 GET /api/v2/emails/[id] - Starting request')
    
    try {
        // Await params as required by Next.js 15
        const { id } = await params
        console.log('📧 Retrieving email with ID:', id)

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

        // Try to find email in inbound emails first (structuredEmails)
        console.log('🔍 Searching inbound emails (structuredEmails)...')
        const inboundEmail = await db
            .select()
            .from(structuredEmails)
            .where(
                and(
                    eq(structuredEmails.id, id),
                    eq(structuredEmails.userId, userId)
                )
            )
            .limit(1)

        if (inboundEmail.length > 0) {
            const emailData = inboundEmail[0]
            console.log('✅ Found in inbound emails:', {
                id: emailData.id,
                subject: emailData.subject
            })

            // Parse JSON fields for inbound emails
            const parseJsonField = (field: string | null) => {
                if (!field) return null
                try {
                    return JSON.parse(field)
                } catch (e) {
                    console.error('Failed to parse JSON field:', e)
                    return null
                }
            }

            const fromData = parseJsonField(emailData.fromData)
            const toData = parseJsonField(emailData.toData)
            const ccData = parseJsonField(emailData.ccData)
            const bccData = parseJsonField(emailData.bccData)
            const replyToData = parseJsonField(emailData.replyToData)

            // Extract addresses from parsed data
            const toAddresses = toData?.addresses?.map((a: any) => a.address) || []
            const ccAddresses = ccData?.addresses?.map((a: any) => a.address) || []
            const bccAddresses = bccData?.addresses?.map((a: any) => a.address) || []
            const replyToAddresses = replyToData?.addresses?.map((a: any) => a.address) || []
            const fromAddress = fromData?.addresses?.[0]?.address || 'unknown'

            // Map status to last_event for inbound
            const lastEvent = emailData.parseSuccess ? 'delivered' : 'failed'

            const response: GetEmailByIdResponse = {
                object: "email",
                id: emailData.id,
                to: toAddresses,
                from: fromAddress,
                created_at: emailData.createdAt ? emailData.createdAt.toISOString() : new Date().toISOString(),
                subject: emailData.subject || 'No Subject',
                html: emailData.htmlBody,
                text: emailData.textBody,
                bcc: bccAddresses.length > 0 ? bccAddresses : [null],
                cc: ccAddresses.length > 0 ? ccAddresses : [null],
                reply_to: replyToAddresses.length > 0 ? replyToAddresses : [null],
                last_event: lastEvent,
                email_type: "inbound"
            }

            console.log('✅ Successfully retrieved inbound email')
            return NextResponse.json(response)
        }

        // Try to find email in outbound emails (sentEmails)
        console.log('🔍 Searching outbound emails (sentEmails)...')
        const outboundEmail = await db
            .select()
            .from(sentEmails)
            .where(
                and(
                    eq(sentEmails.id, id),
                    eq(sentEmails.userId, userId)
                )
            )
            .limit(1)

        if (outboundEmail.length > 0) {
            const emailData = outboundEmail[0]
            console.log('✅ Found in outbound emails:', {
                id: emailData.id,
                from: emailData.from,
                subject: emailData.subject,
                status: emailData.status
            })

            // Parse JSON fields for outbound emails
            const toAddresses = emailData.to ? JSON.parse(emailData.to) : []
            const ccAddresses = emailData.cc ? JSON.parse(emailData.cc) : []
            const bccAddresses = emailData.bcc ? JSON.parse(emailData.bcc) : []
            const replyToAddresses = emailData.replyTo ? JSON.parse(emailData.replyTo) : []

            // Map status to last_event
            let lastEvent = 'created'
            switch (emailData.status) {
                case 'sent':
                    lastEvent = 'delivered'
                    break
                case 'failed':
                    lastEvent = 'failed'
                    break
                case 'pending':
                    lastEvent = 'pending'
                    break
            }

            const response: GetEmailByIdResponse = {
                object: "email",
                id: emailData.id,
                to: toAddresses,
                from: emailData.from,
                created_at: emailData.createdAt ? emailData.createdAt.toISOString() : new Date().toISOString(),
                subject: emailData.subject,
                html: emailData.htmlBody,
                text: emailData.textBody,
                bcc: bccAddresses.length > 0 ? bccAddresses : [null],
                cc: ccAddresses.length > 0 ? ccAddresses : [null],
                reply_to: replyToAddresses.length > 0 ? replyToAddresses : [null],
                last_event: lastEvent,
                email_type: "outbound"
            }

            console.log('✅ Successfully retrieved outbound email')
            return NextResponse.json(response)
        }

        // Try to find email in scheduled emails
        console.log('🔍 Searching scheduled emails (scheduledEmails)...')
        const scheduledEmail = await db
            .select()
            .from(scheduledEmails)
            .where(
                and(
                    eq(scheduledEmails.id, id),
                    eq(scheduledEmails.userId, userId)
                )
            )
            .limit(1)

        if (scheduledEmail.length > 0) {
            const emailData = scheduledEmail[0]
            console.log('✅ Found in scheduled emails:', {
                id: emailData.id,
                subject: emailData.subject,
                status: emailData.status,
                scheduledAt: emailData.scheduledAt
            })

            // Parse JSON fields for scheduled emails
            const toAddresses = emailData.toAddresses ? JSON.parse(emailData.toAddresses) : []
            const ccAddresses = emailData.ccAddresses ? JSON.parse(emailData.ccAddresses) : []
            const bccAddresses = emailData.bccAddresses ? JSON.parse(emailData.bccAddresses) : []
            const replyToAddresses = emailData.replyToAddresses ? JSON.parse(emailData.replyToAddresses) : []

            // Map status to last_event for scheduled emails
            let lastEvent = 'scheduled'
            switch (emailData.status) {
                case 'scheduled':
                    lastEvent = 'scheduled'
                    break
                case 'processing':
                    lastEvent = 'processing'
                    break
                case 'sent':
                    lastEvent = 'delivered'
                    break
                case 'failed':
                    lastEvent = 'failed'
                    break
                case 'cancelled':
                    lastEvent = 'cancelled'
                    break
            }

            const response: GetEmailByIdResponse = {
                object: "email",
                id: emailData.id,
                to: toAddresses,
                from: emailData.fromAddress,
                created_at: emailData.createdAt ? emailData.createdAt.toISOString() : new Date().toISOString(),
                subject: emailData.subject,
                html: emailData.htmlBody,
                text: emailData.textBody,
                bcc: bccAddresses.length > 0 ? bccAddresses : [null],
                cc: ccAddresses.length > 0 ? ccAddresses : [null],
                reply_to: replyToAddresses.length > 0 ? replyToAddresses : [null],
                last_event: lastEvent,
                email_type: "scheduled"
            }

            console.log('✅ Successfully retrieved scheduled email')
            return NextResponse.json(response)
        }

        // Email not found in any table
        console.log('❌ Email not found in any table:', id)
        return NextResponse.json(
            { error: 'Email not found' },
            { status: 404 }
        )

    } catch (error) {
        console.error('💥 Unexpected error in GET /api/v2/emails/[id]:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
} 