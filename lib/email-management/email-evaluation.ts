/**
 * Email Sending Evaluation - AI-powered evaluation of outgoing emails
 * Evaluates emails for malicious, spammy, or bad intent content using AI SDK
 * Results are stored in database for fraud monitoring and analytics
 */

import { generateText, Output, tool } from 'ai'
import { z } from 'zod'
import { db } from '@/lib/db'
import { emailSendingEvaluations, structuredEmails, sentEmails } from '@/lib/db/schema'
import { eq, sql, or, ilike, desc, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { Inbound } from '@inboundemail/sdk'
import { getModel, getModelName } from '@/lib/ai/provider'

// Zod schema for AI evaluation output
const emailEvaluationSchema = z.object({
  riskScore: z.number().min(0).max(100).describe('Overall risk score from 0-100, where 0 is safe and 100 is extremely risky'),
  isMalicious: z.boolean().describe('Whether the email contains malicious content (viruses, malware, etc.)'),
  isSpam: z.boolean().describe('Whether the email appears to be spam'),
  isPhishing: z.boolean().describe('Whether the email appears to be a phishing attempt'),
  hasBadIntent: z.boolean().describe('Overall flag indicating the email has bad intent'),
  flags: z.array(z.string()).describe('Array of specific issue flags found (e.g., "suspicious_links", "urgent_language", "impersonation")'),
  reasoning: z.string().describe('AI explanation of the evaluation and why flags were set'),
  confidence: z.number().min(0).max(1).describe('Confidence level of the evaluation from 0-1'),
})

export type EmailEvaluationResult = z.infer<typeof emailEvaluationSchema>

export interface EmailEvaluationData {
  from: string
  to: string | string[]
  subject: string
  textBody?: string
  htmlBody?: string
  rawContent?: string
}

/**
 * Helper function to extract plain text from HTML
 */
function extractTextFromHtml(html: string): string {
  if (!html) return ''
  
  // Remove script and style tags and their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
  
  // Convert HTML entities
  text = text.replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  
  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ')
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim()
  
  return text
}

/**
 * Search for related emails using fuzzy matching on subject and body
 * Searches both inbound (structuredEmails) and outbound (sentEmails) emails
 */
async function searchRelatedEmails(
  userId: string,
  subjectQuery?: string,
  bodyQuery?: string,
  limit: number = 10
): Promise<Array<{
  id: string
  type: 'inbound' | 'outbound'
  subject: string | null
  from: string | null
  to: string | null
  snippet: string | null
  createdAt: Date | null
}>> {
  const results: Array<{
    id: string
    type: 'inbound' | 'outbound'
    subject: string | null
    from: string | null
    to: string | null
    snippet: string | null
    createdAt: Date | null
  }> = []

  // Build conditions for fuzzy matching
  const conditions = [eq(structuredEmails.userId, userId)]
  
  if (subjectQuery) {
    conditions.push(ilike(structuredEmails.subject, `%${subjectQuery}%`))
  }
  
  if (bodyQuery) {
    conditions.push(
      or(
        ilike(structuredEmails.textBody, `%${bodyQuery}%`),
        ilike(structuredEmails.htmlBody, `%${bodyQuery}%`)
      )!
    )
  }

  // Search inbound emails (structuredEmails)
  if (subjectQuery || bodyQuery) {
    const inboundResults = await db
      .select({
        id: structuredEmails.id,
        subject: structuredEmails.subject,
        fromData: structuredEmails.fromData,
        toData: structuredEmails.toData,
        textBody: structuredEmails.textBody,
        createdAt: structuredEmails.createdAt,
      })
      .from(structuredEmails)
      .where(and(...conditions))
      .orderBy(desc(structuredEmails.createdAt))
      .limit(limit)

    for (const email of inboundResults) {
      // Extract from/to addresses from JSON
      let from = null
      let to = null
      try {
        if (email.fromData) {
          const fromParsed = JSON.parse(email.fromData)
          from = fromParsed?.text || fromParsed?.addresses?.[0]?.address || null
        }
        if (email.toData) {
          const toParsed = JSON.parse(email.toData)
          to = toParsed?.text || toParsed?.addresses?.[0]?.address || null
        }
      } catch {
        // Ignore parse errors
      }

      // Create snippet from body
      const snippet = email.textBody 
        ? email.textBody.substring(0, 200) + (email.textBody.length > 200 ? '...' : '')
        : null

      results.push({
        id: email.id,
        type: 'inbound',
        subject: email.subject,
        from,
        to,
        snippet,
        createdAt: email.createdAt,
      })
    }
  }

  // Search outbound emails (sentEmails)
  const sentConditions = [eq(sentEmails.userId, userId)]
  
  if (subjectQuery) {
    sentConditions.push(ilike(sentEmails.subject, `%${subjectQuery}%`))
  }
  
  if (bodyQuery) {
    sentConditions.push(
      or(
        ilike(sentEmails.textBody, `%${bodyQuery}%`),
        ilike(sentEmails.htmlBody, `%${bodyQuery}%`)
      )!
    )
  }

  if (subjectQuery || bodyQuery) {
    const outboundResults = await db
      .select({
        id: sentEmails.id,
        subject: sentEmails.subject,
        from: sentEmails.from,
        to: sentEmails.to,
        textBody: sentEmails.textBody,
        createdAt: sentEmails.createdAt,
      })
      .from(sentEmails)
      .where(and(...sentConditions))
      .orderBy(desc(sentEmails.createdAt))
      .limit(limit)

    for (const email of outboundResults) {
      // Parse to addresses from JSON
      let toAddresses = null
      try {
        if (email.to) {
          const toParsed = JSON.parse(email.to)
          toAddresses = Array.isArray(toParsed) ? toParsed.join(', ') : email.to
        }
      } catch {
        toAddresses = email.to
      }

      // Create snippet from body
      const snippet = email.textBody 
        ? email.textBody.substring(0, 200) + (email.textBody.length > 200 ? '...' : '')
        : null

      results.push({
        id: email.id,
        type: 'outbound',
        subject: email.subject,
        from: email.from,
        to: toAddresses,
        snippet,
        createdAt: email.createdAt,
      })
    }
  }

  // Sort by created date and limit
  return results
    .sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0
      return b.createdAt.getTime() - a.createdAt.getTime()
    })
    .slice(0, limit)
}

/**
 * Build evaluation prompt from email data
 */
function buildEvaluationPrompt(emailData: EmailEvaluationData): string {
  const toAddresses = Array.isArray(emailData.to) ? emailData.to : [emailData.to]
  const toList = toAddresses.join(', ')
  
  // Extract text content - prefer textBody, fall back to HTML stripped, then raw
  let bodyText = emailData.textBody || ''
  if (!bodyText && emailData.htmlBody) {
    bodyText = extractTextFromHtml(emailData.htmlBody)
  }
  if (!bodyText && emailData.rawContent) {
    // Try to extract text from raw content (basic attempt)
    bodyText = emailData.rawContent.substring(0, 5000) // Limit size
  }
  
  // Limit body text to reasonable size for evaluation (first 5000 chars)
  const truncatedBody = bodyText.substring(0, 5000)
  const hasMoreContent = bodyText.length > 5000
  
  return `Evaluate this outgoing email for malicious content, spam indicators, phishing attempts, or other bad intent.

Email Details:
- From: ${emailData.from}
- To: ${toList}
- Subject: ${emailData.subject}
- Body (${hasMoreContent ? 'first 5000 characters' : 'full content'}):
${truncatedBody}${hasMoreContent ? '\n[Content truncated for evaluation]' : ''}

Evaluate for:
1. Malicious content (viruses, malware, malicious links)
2. Spam characteristics (spammy language, suspicious patterns)
3. Phishing attempts (impersonation, credential theft attempts)
4. Other bad intent (scams, fraud, harmful content)

Return a comprehensive evaluation with:
- A risk score (0-100) where 0 is completely safe and 100 is extremely dangerous
- Specific boolean flags for malicious, spam, phishing, and overall bad intent
- An array of specific issue flags (e.g., "suspicious_links", "urgent_language", "impersonation", "malicious_attachments")
- Detailed reasoning explaining your evaluation
- A confidence score (0-1) indicating how confident you are in the evaluation

Be thorough but fair - legitimate business emails should have low risk scores.`
}

/**
 * Evaluate an email being sent for malicious/spammy/bad intent content
 * Uses AI SDK generateText with structured output to analyze email content
 * Allows for tool calling while still getting structured output
 * Stores results in database for fraud monitoring and analytics
 * 
 * @param emailId - The ID of the sent email (from sentEmails table)
 * @param userId - The ID of the user sending the email
 * @param emailData - The email content to evaluate
 */
export async function evaluateSending(
  emailId: string,
  userId: string,
  emailData: EmailEvaluationData
): Promise<void> {
  await evaluateEmailContent(emailId, userId, emailData)
}

/**
 * Internal function that performs the actual evaluation
 */
async function evaluateEmailContent(
  emailId: string,
  userId: string,
  emailData: EmailEvaluationData
): Promise<void> {
  const startTime = Date.now()
  const evaluationId = nanoid()
  
  try {
    console.log(`🔍 Evaluating email ${emailId} for security risks`)
    
    // Build evaluation prompt
    const prompt = buildEvaluationPrompt(emailData)
    
    // Create tool for searching related emails
    const searchRelatedEmailsTool = tool({
      description: 'Search for related emails by userId, subject (fuzzy match), and body (fuzzy match). Use this to identify patterns, similar emails, or related communications that might indicate spam campaigns or coordinated attacks.',
      inputSchema: z.object({
        subjectQuery: z.string().optional().describe('Search term to fuzzy match in email subject lines'),
        bodyQuery: z.string().optional().describe('Search term to fuzzy match in email body content'),
        limit: z.number().int().min(1).max(20).default(10).describe('Maximum number of results to return (1-20)'),
      }),
      execute: async ({ subjectQuery, bodyQuery, limit }) => {
        const results = await searchRelatedEmails(userId, subjectQuery, bodyQuery, limit)
        return {
          count: results.length,
          emails: results,
        }
      },
    })

    // Create tool for sending high-risk alert emails
    const sendAlertEmailTool = tool({
      description: 'Send an alert email to compliance team when a very high-risk email is detected. Only use this for emails with risk scores above 70 or when there is clear evidence of malicious intent, phishing, or coordinated spam campaigns.',
      inputSchema: z.object({
        subject: z.string().describe('Subject line for the alert email'),
        html: z.string().describe('Body html content for the alert email describing the threat and details, only use the HTML for formatting purposes, dont have any crazy styles and cards, just use for like tables, brs, and p tags. That way the information you present it clear. Also be generous with newlines via <br> tags.'),
      }),
      execute: async ({ subject, html }) => {
        try {
          // Initialize Inbound SDK with API key from environment
          const apiKey = process.env.INBOUND_API_KEY
          if (!apiKey) {
            console.error('❌ INBOUND_API_KEY not configured, cannot send alert email')
            return {
              success: false,
              error: 'Email service not configured',
            }
          }

          const inbound = new Inbound(apiKey)
          
          // Send alert email using Inbound SDK
          const { data: response, error: errorResponse } = await inbound.emails.send({
            from: 'Inbound Compliance <compliance@inbound.new>',
            to: 'ryan@inbound.new',
            subject,
            html,
            tags: [
              { name: 'type', value: 'email-evaluation' },
              { name: 'emailId', value: emailId },
              { name: 'userId', value: userId },
              { name: 'riskScore', value: evaluation.riskScore.toString() },
              { name: 'hasBadIntent', value: evaluation.hasBadIntent.toString() },
              { name: 'flags', value: evaluation.flags.join(',') },
            ],
          })

          if (errorResponse) {
            console.error('❌ Failed to send alert email:', errorResponse)
            return {
              success: false,
              error: typeof errorResponse === 'string' ? errorResponse : String(errorResponse),
            }
          }

          console.log('✅ Alert email sent successfully:', response?.id)
          return {
            success: true,
            emailId: response?.id,
            message: 'Alert email sent successfully',
          }
        } catch (error) {
          console.error('❌ Exception sending alert email:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        }
      },
    })

    // Use AI SDK's generateText with structured output and tools
    // This allows for tool calling while still getting structured output
    const { experimental_output: evaluation, usage } = await generateText({
      model: getModel(),
      prompt, 
      temperature: 0.2, // Lower temperature for more consistent evaluations
      tools: {
        searchRelatedEmails: searchRelatedEmailsTool,
        sendAlertEmail: sendAlertEmailTool,
      },
      experimental_output: Output.object({
        schema: emailEvaluationSchema,
      }),
    })
    
    const evaluationTime = Date.now() - startTime
    
    console.log(`✅ Email evaluation completed for ${emailId}:`, {
      riskScore: evaluation.riskScore,
      hasBadIntent: evaluation.hasBadIntent,
      flags: evaluation.flags,
      evaluationTime,
    })
    
    // Store evaluation results in database
    await db.insert(emailSendingEvaluations).values({
      id: evaluationId,
      emailId,
      userId,
      evaluationResult: JSON.stringify(evaluation),
      riskScore: evaluation.riskScore,
      flags: JSON.stringify(evaluation.flags),
      aiModel: getModelName(),
      evaluationTime,
      promptTokens: usage?.inputTokens ?? null,
      completionTokens: usage?.outputTokens ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    
    console.log(`💾 Stored evaluation ${evaluationId} for email ${emailId}`)
    
  } catch (error) {
    const evaluationTime = Date.now() - startTime
    console.error(`❌ Email evaluation failed for ${emailId}:`, error)
    
    // Store error in database for monitoring
    try {
      await db.insert(emailSendingEvaluations).values({
        id: evaluationId,
        emailId,
        userId,
        evaluationResult: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          failed: true,
        }),
        aiModel: getModelName(),
        evaluationTime,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    } catch (dbError) {
      console.error(`❌ Failed to store evaluation error in database:`, dbError)
    }
    
    // Don't throw - evaluation should never block email sending
  }
}

