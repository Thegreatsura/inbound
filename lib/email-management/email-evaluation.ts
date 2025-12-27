/**
 * Email Sending Evaluation - AI-powered evaluation of outgoing emails
 * Evaluates emails for malicious, spammy, or bad intent content using AI SDK
 * Results are stored in database for fraud monitoring and analytics
 */

import { generateObject } from 'ai'
import { z } from 'zod'
import { db } from '@/lib/db'
import { emailSendingEvaluations } from '@/lib/db/schema'
import { nanoid } from 'nanoid'
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
    
    // Use generateObject for reliable structured output
    const { object: evaluation, usage } = await generateObject({
      model: getModel(),
      schema: emailEvaluationSchema,
      prompt,
      temperature: 0.2, // Lower temperature for more consistent evaluations
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

