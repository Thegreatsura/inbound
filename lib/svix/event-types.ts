/**
 * SVIX Event Types for Sent Email Events
 * 
 * These event types are used for webhook notifications about
 * emails that users send through the API.
 */

// ============================================================================
// Event Type Constants
// ============================================================================

export const SVIX_EVENT_TYPES = {
  // Email lifecycle events
  EMAIL_SENT: 'email.sent',
  EMAIL_DELIVERED: 'email.delivered',
  EMAIL_BOUNCED: 'email.bounced',
  EMAIL_BOUNCED_HARD: 'email.bounced.hard',
  EMAIL_BOUNCED_SOFT: 'email.bounced.soft',
  EMAIL_COMPLAINED: 'email.complained',
  EMAIL_DELAYED: 'email.delayed',
} as const

export type SvixEventType = typeof SVIX_EVENT_TYPES[keyof typeof SVIX_EVENT_TYPES]

// ============================================================================
// Event Payload Types
// ============================================================================

/**
 * Base payload included in all email events
 */
export interface EmailEventBase {
  /** The sent email ID (snt_xxx) */
  emailId: string
  /** Message-ID header from the email */
  messageId?: string
  /** Sender address */
  from: string
  /** Recipient addresses */
  to: string[]
  /** Email subject */
  subject?: string
  /** When the event occurred */
  timestamp: string
}

/**
 * Payload for email.sent event
 * Fired immediately after an email is sent via the API
 */
export interface EmailSentPayload extends EmailEventBase {
  /** CC recipients if any */
  cc?: string[]
  /** BCC recipients if any */
  bcc?: string[]
}

/**
 * Payload for email.delivered event
 * Fired when SES confirms delivery to recipient's mail server
 */
export interface EmailDeliveredPayload extends EmailEventBase {
  /** The specific recipient that received the email */
  recipient: string
  /** SMTP response from receiving server */
  smtpResponse?: string
  /** Processing time in milliseconds */
  processingTimeMs?: number
}

/**
 * Payload for email.bounced events
 * Fired when a bounce notification (DSN) is received
 */
export interface EmailBouncedPayload extends EmailEventBase {
  /** The specific recipient that bounced */
  recipient: string
  /** Type of bounce */
  bounceType: 'hard' | 'soft' | 'transient'
  /** More specific bounce reason */
  bounceSubType: string
  /** RFC 3463 enhanced status code (e.g., 5.1.1, 5.4.4) */
  statusCode?: string
  /** Human-readable bounce reason */
  reason: string
  /** Full diagnostic message from the receiving server */
  diagnosticCode?: string
  /** Whether this recipient was added to the blocklist */
  addedToBlocklist: boolean
}

/**
 * Payload for email.complained event
 * Fired when a recipient marks the email as spam
 */
export interface EmailComplaintPayload extends EmailEventBase {
  /** The specific recipient who complained */
  recipient: string
  /** Type of complaint feedback */
  complaintType?: string
  /** User agent/email client that reported the complaint */
  userAgent?: string
}

/**
 * Payload for email.delayed event
 * Fired when email delivery is temporarily delayed
 */
export interface EmailDelayedPayload extends EmailEventBase {
  /** The specific recipient experiencing delay */
  recipient: string
  /** Reason for the delay */
  reason?: string
  /** When the next retry will be attempted */
  nextRetryAt?: string
  /** Number of retry attempts so far */
  retryCount?: number
}

// ============================================================================
// JSON Schemas for SVIX Event Types
// ============================================================================

const baseEmailProperties = {
  emailId: { type: 'string', description: 'The sent email ID (snt_xxx)' },
  messageId: { type: 'string', description: 'Message-ID header from the email' },
  from: { type: 'string', description: 'Sender address' },
  to: { type: 'array', items: { type: 'string' }, description: 'Recipient addresses' },
  subject: { type: 'string', description: 'Email subject' },
  timestamp: { type: 'string', format: 'date-time', description: 'When the event occurred' },
}

const baseRequired = ['emailId', 'from', 'to', 'timestamp']

const emailSentSchema = {
  type: 'object',
  properties: {
    ...baseEmailProperties,
    cc: { type: 'array', items: { type: 'string' }, description: 'CC recipients' },
    bcc: { type: 'array', items: { type: 'string' }, description: 'BCC recipients' },
  },
  required: baseRequired,
  example: {
    emailId: 'snt_abc123xyz789',
    messageId: '010f019aea18747d-e526d664-a9bb-450e-8552-da82a88197ae-000000',
    from: 'sender@example.com',
    to: ['recipient@example.com'],
    subject: 'Welcome to our service!',
    timestamp: '2024-01-15T10:30:00.000Z',
    cc: [],
    bcc: [],
  },
}

const emailDeliveredSchema = {
  type: 'object',
  properties: {
    ...baseEmailProperties,
    recipient: { type: 'string', description: 'The specific recipient that received the email' },
    smtpResponse: { type: 'string', description: 'SMTP response from receiving server' },
    processingTimeMs: { type: 'number', description: 'Processing time in milliseconds' },
  },
  required: [...baseRequired, 'recipient'],
  example: {
    emailId: 'snt_abc123xyz789',
    messageId: '010f019aea18747d-e526d664-a9bb-450e-8552-da82a88197ae-000000',
    from: 'sender@example.com',
    to: ['recipient@example.com'],
    subject: 'Welcome to our service!',
    timestamp: '2024-01-15T10:30:00.000Z',
    recipient: 'recipient@example.com',
    smtpResponse: '250 2.0.0 OK',
    processingTimeMs: 1250,
  },
}

const emailBouncedHardSchema = {
  type: 'object',
  properties: {
    ...baseEmailProperties,
    recipient: { type: 'string', description: 'The specific recipient that bounced' },
    bounceType: { type: 'string', enum: ['hard', 'soft', 'transient'], description: 'Type of bounce' },
    bounceSubType: { type: 'string', description: 'More specific bounce reason (e.g., user_unknown, mailbox_full)' },
    statusCode: { type: 'string', description: 'RFC 3463 enhanced status code (e.g., 5.1.1, 5.4.4)' },
    reason: { type: 'string', description: 'Human-readable bounce reason' },
    diagnosticCode: { type: 'string', description: 'Full diagnostic message from the receiving server' },
    addedToBlocklist: { type: 'boolean', description: 'Whether this recipient was added to the blocklist' },
  },
  required: [...baseRequired, 'recipient', 'bounceType', 'bounceSubType', 'reason', 'addedToBlocklist'],
  example: {
    emailId: 'snt_abc123xyz789',
    messageId: '010f019aea18747d-e526d664-a9bb-450e-8552-da82a88197ae-000000',
    from: 'sender@example.com',
    to: ['invalid@nonexistent-domain.com'],
    subject: 'Welcome to our service!',
    timestamp: '2024-01-15T10:30:00.000Z',
    recipient: 'invalid@nonexistent-domain.com',
    bounceType: 'hard',
    bounceSubType: 'user_unknown',
    statusCode: '5.1.1',
    reason: 'The email address does not exist',
    diagnosticCode: 'smtp; 550 5.1.1 The email account does not exist',
    addedToBlocklist: true,
  },
}

const emailBouncedSoftSchema = {
  type: 'object',
  properties: {
    ...baseEmailProperties,
    recipient: { type: 'string', description: 'The specific recipient that bounced' },
    bounceType: { type: 'string', enum: ['hard', 'soft', 'transient'], description: 'Type of bounce' },
    bounceSubType: { type: 'string', description: 'More specific bounce reason (e.g., user_unknown, mailbox_full)' },
    statusCode: { type: 'string', description: 'RFC 3463 enhanced status code (e.g., 5.1.1, 5.4.4)' },
    reason: { type: 'string', description: 'Human-readable bounce reason' },
    diagnosticCode: { type: 'string', description: 'Full diagnostic message from the receiving server' },
    addedToBlocklist: { type: 'boolean', description: 'Whether this recipient was added to the blocklist' },
  },
  required: [...baseRequired, 'recipient', 'bounceType', 'bounceSubType', 'reason', 'addedToBlocklist'],
  example: {
    emailId: 'snt_abc123xyz789',
    messageId: '010f019aea18747d-e526d664-a9bb-450e-8552-da82a88197ae-000000',
    from: 'sender@example.com',
    to: ['user@example.com'],
    subject: 'Welcome to our service!',
    timestamp: '2024-01-15T10:30:00.000Z',
    recipient: 'user@example.com',
    bounceType: 'soft',
    bounceSubType: 'mailbox_full',
    statusCode: '4.2.2',
    reason: 'Mailbox is full',
    diagnosticCode: 'smtp; 452 4.2.2 Mailbox full',
    addedToBlocklist: false,
  },
}

const emailComplainedSchema = {
  type: 'object',
  properties: {
    ...baseEmailProperties,
    recipient: { type: 'string', description: 'The specific recipient who complained' },
    complaintType: { type: 'string', description: 'Type of complaint feedback' },
    userAgent: { type: 'string', description: 'User agent/email client that reported the complaint' },
  },
  required: [...baseRequired, 'recipient'],
  example: {
    emailId: 'snt_abc123xyz789',
    messageId: '010f019aea18747d-e526d664-a9bb-450e-8552-da82a88197ae-000000',
    from: 'sender@example.com',
    to: ['recipient@example.com'],
    subject: 'Marketing Newsletter',
    timestamp: '2024-01-15T10:30:00.000Z',
    recipient: 'recipient@example.com',
    complaintType: 'abuse',
    userAgent: 'Yahoo Mail',
  },
}

const emailDelayedSchema = {
  type: 'object',
  properties: {
    ...baseEmailProperties,
    recipient: { type: 'string', description: 'The specific recipient experiencing delay' },
    reason: { type: 'string', description: 'Reason for the delay' },
    nextRetryAt: { type: 'string', format: 'date-time', description: 'When the next retry will be attempted' },
    retryCount: { type: 'number', description: 'Number of retry attempts so far' },
  },
  required: [...baseRequired, 'recipient'],
  example: {
    emailId: 'snt_abc123xyz789',
    messageId: '010f019aea18747d-e526d664-a9bb-450e-8552-da82a88197ae-000000',
    from: 'sender@example.com',
    to: ['recipient@example.com'],
    subject: 'Welcome to our service!',
    timestamp: '2024-01-15T10:30:00.000Z',
    recipient: 'recipient@example.com',
    reason: 'Remote server temporarily unavailable',
    nextRetryAt: '2024-01-15T11:30:00.000Z',
    retryCount: 2,
  },
}

// ============================================================================
// Event Type Definitions for SVIX Registration
// ============================================================================

/**
 * Event type definitions to register with SVIX
 * These provide descriptions, schemas, and examples for the SVIX dashboard
 */
export const SVIX_EVENT_TYPE_DEFINITIONS = [
  {
    name: SVIX_EVENT_TYPES.EMAIL_SENT,
    description: 'Triggered when an email is successfully sent via the API',
    schemas: {
      1: emailSentSchema,
    },
  },
  {
    name: SVIX_EVENT_TYPES.EMAIL_DELIVERED,
    description: 'Triggered when an email is successfully delivered to the recipient\'s mail server',
    schemas: {
      1: emailDeliveredSchema,
    },
  },
  {
    name: SVIX_EVENT_TYPES.EMAIL_BOUNCED,
    description: 'Triggered when an email bounces (hard or soft bounce)',
    schemas: {
      1: emailBouncedHardSchema,
    },
  },
  {
    name: SVIX_EVENT_TYPES.EMAIL_BOUNCED_HARD,
    description: 'Triggered when an email hard bounces (permanent failure - invalid address, domain doesn\'t exist)',
    schemas: {
      1: emailBouncedHardSchema,
    },
  },
  {
    name: SVIX_EVENT_TYPES.EMAIL_BOUNCED_SOFT,
    description: 'Triggered when an email soft bounces (temporary failure - mailbox full, server issues)',
    schemas: {
      1: emailBouncedSoftSchema,
    },
  },
  {
    name: SVIX_EVENT_TYPES.EMAIL_COMPLAINED,
    description: 'Triggered when a recipient marks the email as spam',
    schemas: {
      1: emailComplainedSchema,
    },
  },
  {
    name: SVIX_EVENT_TYPES.EMAIL_DELAYED,
    description: 'Triggered when email delivery is temporarily delayed',
    schemas: {
      1: emailDelayedSchema,
    },
  },
]

/**
 * Get example payload for an event type
 */
export function getExamplePayload(eventType: SvixEventType): Record<string, unknown> {
  switch (eventType) {
    case SVIX_EVENT_TYPES.EMAIL_SENT:
      return emailSentSchema.example
    case SVIX_EVENT_TYPES.EMAIL_DELIVERED:
      return emailDeliveredSchema.example
    case SVIX_EVENT_TYPES.EMAIL_BOUNCED:
    case SVIX_EVENT_TYPES.EMAIL_BOUNCED_HARD:
      return emailBouncedHardSchema.example
    case SVIX_EVENT_TYPES.EMAIL_BOUNCED_SOFT:
      return emailBouncedSoftSchema.example
    case SVIX_EVENT_TYPES.EMAIL_COMPLAINED:
      return emailComplainedSchema.example
    case SVIX_EVENT_TYPES.EMAIL_DELAYED:
      return emailDelayedSchema.example
    default:
      return emailSentSchema.example
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the specific bounce event type based on bounce classification
 */
export function getBounceEventType(bounceType: 'hard' | 'soft' | 'transient'): SvixEventType {
  switch (bounceType) {
    case 'hard':
      return SVIX_EVENT_TYPES.EMAIL_BOUNCED_HARD
    case 'soft':
    case 'transient':
      return SVIX_EVENT_TYPES.EMAIL_BOUNCED_SOFT
    default:
      return SVIX_EVENT_TYPES.EMAIL_BOUNCED
  }
}

/**
 * Create a standardized timestamp for events
 */
export function createEventTimestamp(): string {
  return new Date().toISOString()
}

