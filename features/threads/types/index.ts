/**
 * Email Threading Types
 * Unified types for the new thread-based email system
 */

import { emailThreads, structuredEmails, sentEmails } from '@/lib/db/schema'

// Infer types from database schema
export type EmailThread = typeof emailThreads.$inferSelect
export type NewEmailThread = typeof emailThreads.$inferInsert

// Thread-related types for API responses
export interface ThreadSummary {
  id: string
  rootMessageId: string
  normalizedSubject: string | null
  participantEmails: string[]
  messageCount: number
  lastMessageAt: Date
  createdAt: Date
  hasUnread: boolean
  isArchived: boolean
  
  // Latest message preview
  latestMessage: {
    id: string
    type: 'inbound' | 'outbound'
    subject: string | null
    fromText: string
    textPreview: string | null
    isRead: boolean
    hasAttachments: boolean
    date: Date | null
  } | null
}

export interface ThreadMessage {
  id: string
  messageId: string | null
  type: 'inbound' | 'outbound'
  threadPosition: number
  
  // Message content
  subject: string | null
  textBody: string | null
  htmlBody: string | null
  
  // Sender/recipient info
  from: string
  fromName: string | null
  fromAddress: string | null
  to: string[]
  cc: string[]
  bcc: string[]
  
  // Timestamps
  date: Date | null
  receivedAt: Date | null
  sentAt: Date | null
  
  // Message metadata
  isRead: boolean
  readAt: Date | null
  hasAttachments: boolean
  attachments: Array<{
    filename?: string
    contentType?: string
    size?: number
    contentId?: string
    contentDisposition?: string
  }>
  
  // Threading metadata
  inReplyTo: string | null
  references: string[]
  
  // Headers and tags
  headers: Record<string, any>
  tags: Array<{ name: string; value: string }>
  
  // Status (for sent emails)
  status?: 'pending' | 'sent' | 'failed'
  failureReason?: string | null
}

export interface ThreadDetails {
  id: string
  rootMessageId: string
  normalizedSubject: string | null
  participantEmails: string[]
  messageCount: number
  lastMessageAt: Date
  createdAt: Date
  updatedAt: Date
}

// API Request/Response types
export interface ThreadsListRequest {
  page?: number
  limit?: number
  search?: string
  unread?: boolean
  archived?: boolean
}

export interface ThreadsListResponse {
  threads: ThreadSummary[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
  filters: {
    search?: string
    unreadOnly?: boolean
    archivedOnly?: boolean
  }
}

export interface GetThreadResponse {
  thread: ThreadDetails
  messages: ThreadMessage[]
  totalCount: number
}

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

// Threading processing types
export interface ThreadingResult {
  threadId: string
  threadPosition: number
  isNewThread: boolean
}

export interface EmailData {
  id: string
  messageId: string | null
  inReplyTo: string | null
  references: string | null
  subject: string | null
  date: Date | null
  fromData: string | null
  toData: string | null
  ccData: string | null
  userId: string
}

// Thread statistics for analytics
export interface ThreadStats {
  totalThreads: number
  totalMessages: number
  averageMessagesPerThread: number
  mostActiveThread: {
    threadId: string
    messageCount: number
    subject: string | null
  } | null
  recentActivity: {
    threadsToday: number
    messagesToday: number
  }
}
