import { endpoints, emailGroups, endpointDeliveries, WEBHOOK_FORMATS } from '@/lib/db/schema'
import type { WebhookFormat } from '@/lib/db/schema'

// Database types using Drizzle inference (following project patterns)
export type Endpoint = typeof endpoints.$inferSelect
export type NewEndpoint = typeof endpoints.$inferInsert
export type EmailGroup = typeof emailGroups.$inferSelect
export type NewEmailGroup = typeof emailGroups.$inferInsert
export type EndpointDelivery = typeof endpointDeliveries.$inferSelect
export type NewEndpointDelivery = typeof endpointDeliveries.$inferInsert

// Base API response type (shared fields across API responses)
export type ApiEndpointBase = {
  id: string
  name: string
  type: 'webhook' | 'email' | 'email_group'
  config: EndpointConfig
  isActive: boolean
  description: string | null
  userId: string
  createdAt: string | null
  updatedAt: string | null
  groupEmails: string[] | null
}

// API response type - matches what the POST API returns for creating endpoints
export type ApiEndpointResponse = ApiEndpointBase & {
  createdAt: string
  updatedAt: string
  deliveryStats: {
    total: number
    successful: number
    failed: number
    lastDelivery: string | null
  }
}

// API response type for PUT (update) endpoint - simpler response without deliveryStats
export type ApiEndpointUpdateResponse = ApiEndpointBase

// API response type for GET endpoint detail - includes additional fields
export type ApiEndpointDetailResponse = {
  id: string
  name: string
  type: 'webhook' | 'email' | 'email_group'
  config: EndpointConfig
  isActive: boolean
  description: string | null
  userId: string
  createdAt: string | null
  updatedAt: string | null
  groupEmails: string[] | null
  deliveryStats: {
    total: number
    successful: number
    failed: number
    lastDelivery: string | null
  }
  recentDeliveries: Array<{
    id: string
    emailId: string | null
    deliveryType: string
    status: string
    attempts: number
    lastAttemptAt: string | null
    responseData: unknown
    createdAt: string | null
  }>
  associatedEmails: Array<{
    id: string
    address: string
    isActive: boolean
    createdAt: string | null
  }>
  catchAllDomains: Array<{
    id: string
    domain: string
    status: string
  }>
}

// Enhanced endpoint type with API-only properties (legacy, prefer ApiEndpointResponse)
export type EndpointWithStats = Endpoint & {
  groupEmails?: string[] | null
  deliveryStats?: {
    total: number
    successful: number
    failed: number
    lastDelivery: string | null
  }
}

// Endpoint configuration types
export type WebhookConfig = {
  url: string
  secret?: string
  headers?: Record<string, string>
  timeout?: number
  retryAttempts?: number
  verificationToken?: string // Token for verifying webhook requests (auto-generated)
}

export type EmailForwardConfig = {
  forwardTo: string
  includeAttachments?: boolean
  subjectPrefix?: string
  fromAddress?: string // Which verified domain email to send from
  senderName?: string // Display name to show in the from field (e.g., "Support Team")
}

export type EmailGroupConfig = {
  emails: string[]
  includeAttachments?: boolean
  subjectPrefix?: string
  fromAddress?: string // Which verified domain email to send from
  senderName?: string // Display name to show in the from field (e.g., "Support Team")
}

// Union type for all config types
export type EndpointConfig = WebhookConfig | EmailForwardConfig | EmailGroupConfig

// Action types for server actions
export type CreateEndpointData = {
  name: string
  type: 'webhook' | 'email' | 'email_group'
  webhookFormat?: WebhookFormat // Only relevant for webhook type
  description?: string
  config: EndpointConfig
}

export type UpdateEndpointData = {
  name?: string
  description?: string
  isActive?: boolean
  webhookFormat?: WebhookFormat // Only relevant for webhook type
  config?: EndpointConfig
}

// Component props types
export type EndpointListProps = {
  endpoints: Endpoint[]
  onSelect?: (endpoint: Endpoint) => void
}

export type EndpointFormProps = {
  endpoint?: Endpoint
  onSubmit: (data: CreateEndpointData | UpdateEndpointData) => void
  onCancel: () => void
}

// Delivery history types
export type EndpointDeliveryHistory = {
  endpoint: Endpoint
  deliveries: EndpointDelivery[]
  totalCount: number
  successCount: number
  failureCount: number
} 