/**
 * Shared TypeScript types for E2 API
 */

export interface AuthContext {
  userId: string
}

export interface ErrorResponse {
  error: string
  details?: string
}

export interface PaginationRequest {
  limit?: number
  offset?: number
}

export interface PaginationResponse {
  limit: number
  offset: number
  total: number
  hasMore: boolean
}

export interface AuthValidationResult {
  userId?: string
  error?: ErrorResponse & { status: number }
}
