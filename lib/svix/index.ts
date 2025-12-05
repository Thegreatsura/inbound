/**
 * SVIX Webhook Service Client
 * 
 * Provides webhook delivery infrastructure for sent email events.
 * Events include: email.sent, email.delivered, email.bounced, email.complained
 * 
 * SVIX handles:
 * - Reliable webhook delivery with retries
 * - Signature verification
 * - Delivery logs and debugging
 * - Rate limiting and backoff
 */

import { Svix } from 'svix'

// Singleton SVIX client instance
let svixClient: Svix | null = null

/**
 * Get or create the SVIX client singleton
 */
export function getSvixClient(): Svix | null {
  if (!process.env.SVIX_API_KEY) {
    console.warn('[SVIX] SVIX_API_KEY not configured - webhook events will not be delivered')
    return null
  }
  
  if (!svixClient) {
    svixClient = new Svix(process.env.SVIX_API_KEY)
  }
  
  return svixClient
}

/**
 * Check if SVIX is configured and available
 */
export function isSvixEnabled(): boolean {
  return !!process.env.SVIX_API_KEY
}

/**
 * Get or create a SVIX application for a user
 * Each user gets their own SVIX "application" which groups their endpoints
 */
export async function getOrCreateUserApplication(userId: string, userEmail: string): Promise<string | null> {
  const client = getSvixClient()
  if (!client) return null
  
  try {
    // Try to get existing application
    const app = await client.application.getOrCreate({
      name: userEmail,
      uid: userId,
    })
    
    return app.id
  } catch (error) {
    console.error(`[SVIX] Failed to get/create application for user ${userId}:`, error)
    return null
  }
}

/**
 * Create an endpoint (webhook URL) for a user's application
 */
export async function createUserEndpoint(
  userId: string,
  url: string,
  description?: string,
  filterTypes?: string[]
): Promise<{ id: string; secret: string } | null> {
  const client = getSvixClient()
  if (!client) return null
  
  // Build endpoint config - only include filterTypes if provided and non-empty
  const endpointConfig: {
    url: string
    description: string
    filterTypes?: string[]
  } = {
    url,
    description: description || 'Sent email events webhook',
  }
  
  // Only add filterTypes if we have some selected
  // Note: Svix may reject filter types that haven't been registered
  if (filterTypes && filterTypes.length > 0) {
    endpointConfig.filterTypes = filterTypes
  }
  
  console.log(`[SVIX] Creating endpoint for user ${userId}:`, endpointConfig)
  
  try {
    const endpoint = await client.endpoint.create(userId, endpointConfig)
    
    // Get the endpoint secret for signature verification
    const secret = await client.endpoint.getSecret(userId, endpoint.id)
    
    return {
      id: endpoint.id,
      secret: secret.key,
    }
  } catch (error: any) {
    // Log the full error details for debugging
    console.error(`[SVIX] Failed to create endpoint for user ${userId}:`, error)
    if (error?.body) {
      console.error(`[SVIX] Error body:`, JSON.stringify(error.body, null, 2))
    }
    
    // If we had filterTypes and got a 422, try again without them
    // (event types might not be registered in SVIX yet)
    if (filterTypes && filterTypes.length > 0 && error?.code === 422) {
      console.log(`[SVIX] Retrying without filterTypes...`)
      try {
        const endpoint = await client.endpoint.create(userId, {
          url,
          description: description || 'Sent email events webhook',
        })
        
        const secret = await client.endpoint.getSecret(userId, endpoint.id)
        
        console.log(`[SVIX] Created endpoint without filterTypes successfully`)
        return {
          id: endpoint.id,
          secret: secret.key,
        }
      } catch (retryError: any) {
        console.error(`[SVIX] Retry also failed:`, retryError)
        if (retryError?.body) {
          console.error(`[SVIX] Retry error body:`, JSON.stringify(retryError.body, null, 2))
        }
      }
    }
    
    return null
  }
}

/**
 * List all endpoints for a user
 */
export async function listUserEndpoints(userId: string) {
  const client = getSvixClient()
  if (!client) return []
  
  try {
    const endpoints = await client.endpoint.list(userId)
    return endpoints.data
  } catch (error) {
    console.error(`[SVIX] Failed to list endpoints for user ${userId}:`, error)
    return []
  }
}

/**
 * Update an endpoint for a user
 * Note: url is required by SVIX for updates
 */
export async function updateUserEndpoint(
  userId: string,
  endpointId: string,
  updates: {
    url: string
    description?: string
    filterTypes?: string[]
    disabled?: boolean
  }
): Promise<boolean> {
  const client = getSvixClient()
  if (!client) return false
  
  try {
    await client.endpoint.update(userId, endpointId, {
      url: updates.url,
      description: updates.description,
      filterTypes: updates.filterTypes,
      disabled: updates.disabled,
    })
    return true
  } catch (error: any) {
    console.error(`[SVIX] Failed to update endpoint ${endpointId} for user ${userId}:`, error)
    if (error?.body) {
      console.error(`[SVIX] Error body:`, JSON.stringify(error.body, null, 2))
    }
    return false
  }
}

/**
 * Delete an endpoint
 */
export async function deleteUserEndpoint(userId: string, endpointId: string): Promise<boolean> {
  const client = getSvixClient()
  if (!client) return false
  
  try {
    await client.endpoint.delete(userId, endpointId)
    return true
  } catch (error) {
    console.error(`[SVIX] Failed to delete endpoint ${endpointId} for user ${userId}:`, error)
    return false
  }
}

/**
 * Get the App Portal URL for a user to manage their webhooks
 * This provides a hosted UI for users to configure endpoints
 */
export async function getAppPortalUrl(userId: string): Promise<string | null> {
  const client = getSvixClient()
  if (!client) return null
  
  try {
    const dashboard = await client.authentication.appPortalAccess(userId, {})
    return dashboard.url
  } catch (error) {
    console.error(`[SVIX] Failed to get app portal URL for user ${userId}:`, error)
    return null
  }
}

/**
 * Send a webhook message to all of a user's endpoints
 */
export async function sendMessage<T extends object>(
  userId: string,
  eventType: string,
  payload: T,
  idempotencyKey?: string
): Promise<{ messageId: string } | null> {
  const client = getSvixClient()
  if (!client) {
    console.log(`[SVIX] Skipping message (not configured): ${eventType} for user ${userId}`)
    return null
  }
  
  try {
    const message = await client.message.create(
      userId,
      {
        eventType,
        payload,
        ...(idempotencyKey && { eventId: idempotencyKey }),
      }
    )
    
    console.log(`[SVIX] Message sent: ${message.id} (${eventType}) for user ${userId}`)
    return { messageId: message.id }
  } catch (error: any) {
    // Check if the error is because the user has no application yet
    if (error?.code === 'not_found' || error?.message?.includes('not found')) {
      console.log(`[SVIX] No application found for user ${userId}, skipping message`)
      return null
    }
    
    console.error(`[SVIX] Failed to send message for user ${userId}:`, error)
    return null
  }
}

// Re-export types that consumers might need
export { Svix }

