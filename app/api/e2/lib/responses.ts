import { ErrorResponse } from './types'

/**
 * Standardized response helpers for E2 API
 */

export function unauthorized(message = 'Unauthorized'): Response {
  return Response.json(
    { error: message },
    { status: 401 }
  )
}

export function badRequest(message: string, details?: string): Response {
  return Response.json(
    { error: message, ...(details && { details }) },
    { status: 400 }
  )
}

export function notFound(message = 'Not found'): Response {
  return Response.json(
    { error: message },
    { status: 404 }
  )
}

export function forbidden(message = 'Forbidden'): Response {
  return Response.json(
    { error: message },
    { status: 403 }
  )
}

export function rateLimitExceeded(message = 'Rate limit exceeded'): Response {
  return Response.json(
    { error: message },
    { status: 429 }
  )
}

export function success<T>(data: T, status = 200): Response {
  return Response.json(data, { status })
}
