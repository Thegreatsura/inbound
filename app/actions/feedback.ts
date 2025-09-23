'use server'

import { auth } from '@/lib/auth/auth'
import { headers } from 'next/headers'
import { Resend } from 'resend'
import { render } from '@react-email/render'
import { Inbound } from '@inboundemail/sdk'
import FeedbackEmail from '@/emails/feedback'

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY)
const inbound = new Inbound(process.env.INBOUND_API_KEY!)

export interface FeedbackData {
  feedback: string
  browserLogs?: string
}

/**
 * Server action to send feedback email to ryan@inbound.new
 */
export async function sendFeedbackAction(
  data: FeedbackData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      }
    }

    // Validate required environment variable
    if (!process.env.INBOUND_API_KEY) {
      console.error('❌ sendFeedbackAction - INBOUND_API_KEY not configured')
      return {
        success: false,
        error: 'Email service not configured'
      }
    }

    // Validate feedback content
    if (!data.feedback?.trim()) {
      return {
        success: false,
        error: 'Feedback content is required'
      }
    }

    if (data.feedback.length > 5000) {
      return {
        success: false,
        error: 'Feedback is too long (max 5000 characters)'
      }
    }

    console.log(`📧 sendFeedbackAction - Sending feedback from user: ${session.user.email}`)

    // Prepare email template props
    const templateProps = {
      userFirstname: session.user.name?.split(' ')[0] || 'User',
      userEmail: session.user.email,
      feedback: data.feedback.trim(),
      submittedAt: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })
    }

    // Render the email template
    const html = await render(FeedbackEmail(templateProps))

    // Determine the from address
    const fromEmail = 'feedback@inbound.new'
    
    // Format sender with name - Resend accepts "Name <email@domain.com>" format
    const fromWithName = `inbound feedback <${fromEmail}>`

    // Build optional attachments
    const attachments: any[] = []
    if (data.browserLogs && data.browserLogs.trim().length > 0) {
      const base64 = Buffer.from(data.browserLogs, 'utf8').toString('base64')
      const filename = `browser-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`
      attachments.push({
        filename,
        content: base64,
        content_type: 'text/plain; charset=utf-8'
      })
    }

    // Send the email (Inbound API - supports attachments per docs)
    const response = await inbound.emails.send({
      from: fromWithName,
      to: 'ryan@mandarin3d.com',
      replyTo: session.user.email ? session.user.email : 'ryan@mandarin3d.com', // Allow Ryan to reply directly to the user
      subject: `💬 New Feedback from ${session.user.name || session.user.email} - inbound`,
      html: html,
      attachments: attachments.length ? attachments : undefined,
      tags: [
        { name: 'type', value: 'user-feedback' },
        { name: 'user_id', value: session.user.id }
      ]
    })

    if (response.error) {
      console.error('❌ sendFeedbackAction - Inbound API error:', response.error)
      const errMsg = typeof response.error === 'string' ? response.error : (response.error as any)?.message || 'Unknown error'
      return {
        success: false,
        error: `Email sending failed: ${errMsg}`
      }
    }

    console.log(`✅ sendFeedbackAction - Feedback email sent successfully from ${session.user.email}`)
    console.log(`   📧 Message ID: ${response.data?.id}`)

    return {
      success: true,
      messageId: response.data?.id
    }

  } catch (error) {
    console.error('❌ sendFeedbackAction - Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
} 