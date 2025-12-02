import { NextRequest, NextResponse } from 'next/server'
import { validateRequest } from '../../../helper/main'
import { db } from '@/lib/db'
import { emailThreads, structuredEmails } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * POST /api/v2/threads/[id]/actions
 * Perform actions on a thread (mark as read, archive, etc.)
 * Supports both session-based auth and API key auth
 * Has tests? ❌
 * Has logging? ✅
 * Has types? ✅
 */

export interface ThreadActionRequest {
  action: 'mark_as_read' | 'mark_as_unread' | 'archive' | 'unarchive'
}

export interface ThreadActionResponse {
  success: boolean
  action: string
  threadId: string
  affectedMessages?: number
  message?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('🧵 POST /api/v2/threads/[id]/actions - Starting request')

  try {
    console.log('🔐 Validating request authentication')
    const { userId, error } = await validateRequest(request)
    if (!userId) {
      console.log('❌ Authentication failed:', error)
      return NextResponse.json({ error: error }, { status: 401 })
    }
    console.log('✅ Authentication successful for userId:', userId)

    const { id: threadId } = await params
    console.log('🧵 Thread ID:', threadId)

    // Validate thread ID
    if (!threadId || typeof threadId !== 'string') {
      console.log('⚠️ Invalid thread ID provided:', threadId)
      return NextResponse.json(
        { error: 'Valid thread ID is required' },
        { status: 400 }
      )
    }

    // Parse request body
    const body: ThreadActionRequest = await request.json()
    console.log('📋 Action requested:', body.action)

    // Validate action
    const validActions = ['mark_as_read', 'mark_as_unread', 'archive', 'unarchive']
    if (!body.action || !validActions.includes(body.action)) {
      return NextResponse.json(
        { error: 'Valid action is required. Supported actions: ' + validActions.join(', ') },
        { status: 400 }
      )
    }

    // Verify thread exists and belongs to user
    const thread = await db
      .select({ id: emailThreads.id })
      .from(emailThreads)
      .where(
        and(
          eq(emailThreads.id, threadId),
          eq(emailThreads.userId, userId)
        )
      )
      .limit(1)

    if (thread.length === 0) {
      console.log('📭 Thread not found')
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    let affectedMessages = 0
    let message = ''

    // Perform the requested action
    switch (body.action) {
      case 'mark_as_read':
        console.log('📖 Marking thread as read')
        const readResult = await db
          .update(structuredEmails)
          .set({
            isRead: true,
            readAt: new Date(),
            updatedAt: new Date()
          })
          .where(
            and(
              eq(structuredEmails.threadId, threadId),
              eq(structuredEmails.userId, userId),
              eq(structuredEmails.isRead, false)
            )
          )
        
        // Note: Drizzle doesn't return affected rows count directly
        // We could do a separate count query if needed
        message = 'Thread marked as read'
        break

      case 'mark_as_unread':
        console.log('📩 Marking thread as unread')
        await db
          .update(structuredEmails)
          .set({
            isRead: false,
            readAt: null,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(structuredEmails.threadId, threadId),
              eq(structuredEmails.userId, userId)
            )
          )
        
        message = 'Thread marked as unread'
        break

      case 'archive':
        console.log('🗄️ Archiving thread')
        await db
          .update(structuredEmails)
          .set({
            isArchived: true,
            archivedAt: new Date(),
            updatedAt: new Date()
          })
          .where(
            and(
              eq(structuredEmails.threadId, threadId),
              eq(structuredEmails.userId, userId)
            )
          )
        
        message = 'Thread archived'
        break

      case 'unarchive':
        console.log('📂 Unarchiving thread')
        await db
          .update(structuredEmails)
          .set({
            isArchived: false,
            archivedAt: null,
            updatedAt: new Date()
          })
          .where(
            and(
              eq(structuredEmails.threadId, threadId),
              eq(structuredEmails.userId, userId)
            )
          )
        
        message = 'Thread unarchived'
        break

      default:
        return NextResponse.json(
          { error: 'Unsupported action' },
          { status: 400 }
        )
    }

    console.log(`✅ Action ${body.action} completed successfully`)

    const response: ThreadActionResponse = {
      success: true,
      action: body.action,
      threadId,
      affectedMessages,
      message
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('💥 Unexpected error in POST /api/v2/threads/[id]/actions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
