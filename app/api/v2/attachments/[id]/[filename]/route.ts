import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/app/api/v1/lib/auth'
import { db } from '@/lib/db'
import { structuredEmails, sesEvents } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * GET /api/v2/attachments/:id/:filename
 * Download an email attachment by email ID and filename
 * 
 * @param id - The structured email ID
 * @param filename - The attachment filename
 * @returns The attachment file with appropriate content-type headers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  try {
    // Get and validate route parameters
    const { id: emailId, filename: attachmentFilename } = await params
    console.log(`📥 Attachment download - Request started`)
    console.log(`   Email ID: ${emailId}`)
    console.log(`   Filename (raw): ${attachmentFilename}`)
    console.log(`   Filename (decoded): ${decodeURIComponent(attachmentFilename)}`)

    if (!emailId || !attachmentFilename) {
      return NextResponse.json(
        { error: 'Email ID and attachment filename are required' },
        { status: 400 }
      )
    }

    // Validate API key
    const validation = await validateApiKey(request)
    if ('error' in validation) {
      console.error(`❌ Attachment download - API validation failed: ${validation.error}`)
      return NextResponse.json({ error: validation.error }, { status: 401 })
    }

    const userId = validation.user?.id
    if (!userId) {
      console.error(`❌ Attachment download - User ID not found after validation`)
      return NextResponse.json({ error: 'User not found' }, { status: 401 })
    }

    // Get the structured email to verify ownership and find SES event
    console.log(`🔐 Attachment download - Authenticated userId: ${userId}`)
    console.log(`🔎 Attachment download - Querying for structured email with: emailId=${emailId}, userId=${userId}`)
    const structuredEmail = await db
      .select({
        sesEventId: structuredEmails.sesEventId,
        userId: structuredEmails.userId,
      })
      .from(structuredEmails)
      .where(
        and(
          eq(structuredEmails.id, emailId),
          eq(structuredEmails.userId, userId)
        )
      )
      .limit(1)

    if (!structuredEmail.length) {
      console.error(`❌ Attachment download - Structured email not found: emailId=${emailId}, userId=${userId}`)
      return NextResponse.json(
        { error: 'Email not found or access denied' },
        { status: 404 }
      )
    }
    
    console.log(`✅ Attachment download - Found structured email: ${emailId}`)

    const sesEventId = structuredEmail[0].sesEventId
    if (!sesEventId) {
      console.error(`❌ Attachment download - No SES event ID for email: ${emailId}`)
      return NextResponse.json(
        { error: 'Email event information not found' },
        { status: 404 }
      )
    }

    // Get the SES event to find email content
    const sesEvent = await db
      .select({
        s3BucketName: sesEvents.s3BucketName,
        s3ObjectKey: sesEvents.s3ObjectKey,
        emailContent: sesEvents.emailContent,
      })
      .from(sesEvents)
      .where(eq(sesEvents.id, sesEventId))
      .limit(1)

    if (!sesEvent.length) {
      return NextResponse.json(
        { error: 'Email content not found' },
        { status: 404 }
      )
    }
    
    console.log(`✅ Attachment download - Found SES event: ${sesEventId}`)

    const { s3BucketName, s3ObjectKey, emailContent } = sesEvent[0]
    
    console.log(`📦 Attachment download - SES event data: s3Bucket=${s3BucketName}, s3Key=${s3ObjectKey ? 'yes' : 'no'}, hasEmailContent=${!!emailContent}`)

    // Parse email to extract attachments
    let rawEmailContent: string | null = null

    // Try S3 first, then fallback to direct email content
    if (s3BucketName && s3ObjectKey) {
      try {
        console.log(`📦 Attachment download - Fetching email from S3: ${s3BucketName}/${s3ObjectKey}`)
        // Import S3 client to fetch raw email content
        const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
        
        const s3Client = new S3Client({
          region: process.env.AWS_REGION || 'us-east-1',
        })
        
        const command = new GetObjectCommand({
          Bucket: s3BucketName,
          Key: s3ObjectKey,
        })
        
        const response = await s3Client.send(command)
        
        if (response.Body) {
          // Convert stream to string
          const chunks: Uint8Array[] = []
          const reader = response.Body.transformToWebStream().getReader()
          
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(value)
          }
          
          const buffer = Buffer.concat(chunks)
          rawEmailContent = buffer.toString('utf-8')
          console.log(`✅ Attachment download - S3 fetch successful. Content size: ${rawEmailContent.length} bytes.`)
        } else {
          throw new Error('No email content in S3')
        }
      } catch (s3Error) {
        console.error(`Failed to fetch from S3:`, s3Error)
        // Fallback to direct content
        rawEmailContent = emailContent
        console.log(`🔄 Attachment download - S3 fetch failed, falling back to direct content (${rawEmailContent?.length || 0} bytes)`)
      }
    } else {
      rawEmailContent = emailContent
      console.log(`📄 Attachment download - No S3 info, using direct email content (${rawEmailContent?.length || 0} bytes)`)
    }

    if (!rawEmailContent) {
      console.error(`❌ Attachment download - No email content available: s3BucketName=${s3BucketName}, s3ObjectKey=${s3ObjectKey}, emailContent=${emailContent ? 'present' : 'null'}`)
      return NextResponse.json(
        { error: 'Email content not available' },
        { status: 404 }
      )
    }
    
    console.log(`✅ Attachment download - Email content ready (${rawEmailContent.length} bytes)`)

    // Parse the email to find the attachment
    const { simpleParser } = await import('mailparser')
    const parsed = await simpleParser(rawEmailContent)

    if (!parsed.attachments || parsed.attachments.length === 0) {
      console.warn(`⚠️ Attachment download - No attachments found in email ${emailId}`)
      return NextResponse.json(
        { error: 'No attachments found in this email' },
        { status: 404 }
      )
    }
    
    const decodedFilename = decodeURIComponent(attachmentFilename)
    console.log(`🔍 Attachment download - Looking for: "${decodedFilename}"`)
    console.log(`📋 Attachment download - Available attachments (${parsed.attachments.length}): ${parsed.attachments.map(a => a.filename).join(', ')}`)

    // Find the specific attachment by filename
    const attachment = parsed.attachments.find(
      (att) => att.filename === decodedFilename
    )

    if (!attachment) {
      console.error(`❌ Attachment download - Attachment not found`)
      console.error(`   Looking for: "${decodedFilename}"`)
      console.error(`   Available: ${parsed.attachments.map(a => `"${a.filename}"`).join(', ')}`)
      return NextResponse.json(
        { error: 'Attachment not found' },
        { status: 404 }
      )
    }

    console.log(`✅ Attachment download - Found: ${attachment.filename} (${attachment.size} bytes)`)

    // Return the attachment with appropriate headers
    // Convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(attachment.content), {
      status: 200,
      headers: {
        'Content-Type': attachment.contentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${attachment.filename}"`,
        'Content-Length': attachment.size?.toString() || '0',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    console.error('❌ Error downloading attachment:', error)
    return NextResponse.json(
      {
        error: 'Failed to download attachment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
