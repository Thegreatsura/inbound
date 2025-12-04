/**
 * SVIX User Management
 * 
 * Handles creating and managing SVIX applications for users.
 * Each user gets their own SVIX "application" which groups their webhook endpoints.
 */

import { db } from '@/lib/db'
import { user } from '@/lib/db/auth-schema'
import { eq } from 'drizzle-orm'
import { 
  getSvixClient, 
  isSvixEnabled, 
  getOrCreateUserApplication,
  createUserEndpoint,
  deleteUserEndpoint,
  updateUserEndpoint,
  listUserEndpoints,
  getAppPortalUrl,
} from './index'
import { SVIX_EVENT_TYPE_DEFINITIONS } from './event-types'

// ============================================================================
// User Application Management
// ============================================================================

export interface EnableSvixResult {
  success: boolean
  svixAppId?: string
  error?: string
}

/**
 * Enable SVIX for a user
 * Creates their SVIX application and stores the app ID
 */
export async function enableSvixForUser(userId: string): Promise<EnableSvixResult> {
  if (!isSvixEnabled()) {
    return { success: false, error: 'SVIX is not configured' }
  }
  
  try {
    // Get user details
    const userRecord = await db
      .select({
        id: user.id,
        email: user.email,
        svixAppId: user.svixAppId,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    
    if (!userRecord[0]) {
      return { success: false, error: 'User not found' }
    }
    
    // Check if already enabled
    if (userRecord[0].svixAppId) {
      return { 
        success: true, 
        svixAppId: userRecord[0].svixAppId,
      }
    }
    
    // Create SVIX application
    const svixAppId = await getOrCreateUserApplication(userId, userRecord[0].email)
    
    if (!svixAppId) {
      return { success: false, error: 'Failed to create SVIX application' }
    }
    
    // Store the app ID in the user record
    await db
      .update(user)
      .set({
        svixAppId,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))
    
    console.log(`[SVIX User Management] Enabled SVIX for user ${userId} with app ${svixAppId}`)
    
    return { success: true, svixAppId }
  } catch (error) {
    console.error(`[SVIX User Management] Error enabling SVIX for user ${userId}:`, error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }
  }
}

/**
 * Check if SVIX is enabled for a user
 */
export async function isUserSvixEnabled(userId: string): Promise<boolean> {
  try {
    const userRecord = await db
      .select({ svixAppId: user.svixAppId })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    
    return !!userRecord[0]?.svixAppId
  } catch {
    return false
  }
}

/**
 * Get or enable SVIX for a user
 * If not already enabled, enables it automatically
 */
export async function ensureUserSvixEnabled(userId: string): Promise<string | null> {
  try {
    const userRecord = await db
      .select({
        email: user.email,
        svixAppId: user.svixAppId,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    
    if (!userRecord[0]) {
      return null
    }
    
    // Already enabled
    if (userRecord[0].svixAppId) {
      return userRecord[0].svixAppId
    }
    
    // Enable now
    const result = await enableSvixForUser(userId)
    return result.svixAppId || null
  } catch (error) {
    console.error(`[SVIX User Management] Error ensuring SVIX enabled for ${userId}:`, error)
    return null
  }
}

// ============================================================================
// Endpoint Management for Users
// ============================================================================

export interface CreateEndpointResult {
  success: boolean
  endpointId?: string
  secret?: string
  error?: string
}

/**
 * Create a webhook endpoint for a user
 * Automatically enables SVIX if not already enabled
 */
export async function createUserWebhookEndpoint(
  userId: string,
  url: string,
  description?: string,
  filterTypes?: string[]
): Promise<CreateEndpointResult> {
  if (!isSvixEnabled()) {
    return { success: false, error: 'SVIX is not configured' }
  }
  
  try {
    // Ensure user has SVIX enabled
    const svixAppId = await ensureUserSvixEnabled(userId)
    if (!svixAppId) {
      return { success: false, error: 'Failed to enable SVIX for user' }
    }
    
    // Create the endpoint
    const endpoint = await createUserEndpoint(userId, url, description, filterTypes)
    
    if (!endpoint) {
      return { success: false, error: 'Failed to create endpoint. Check server logs for details.' }
    }
    
    return { 
      success: true, 
      endpointId: endpoint.id,
      secret: endpoint.secret,
    }
  } catch (error: any) {
    console.error(`[SVIX User Management] Error creating endpoint for ${userId}:`, error)
    
    // Try to extract a meaningful error message
    let errorMessage = 'Unknown error'
    if (error?.body?.detail) {
      errorMessage = error.body.detail
    } else if (error?.body?.message) {
      errorMessage = error.body.message
    } else if (error instanceof Error) {
      errorMessage = error.message
    }
    
    return { 
      success: false, 
      error: errorMessage
    }
  }
}

/**
 * Delete a webhook endpoint for a user
 */
export async function deleteUserWebhookEndpoint(
  userId: string,
  endpointId: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSvixEnabled()) {
    return { success: false, error: 'SVIX is not configured' }
  }
  
  const success = await deleteUserEndpoint(userId, endpointId)
  return { success }
}

/**
 * Update a webhook endpoint for a user
 * Note: url is required by SVIX for updates
 */
export async function updateUserWebhookEndpoint(
  userId: string,
  endpointId: string,
  updates: {
    url: string
    description?: string
    filterTypes?: string[]
    disabled?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  if (!isSvixEnabled()) {
    return { success: false, error: 'SVIX is not configured' }
  }
  
  const success = await updateUserEndpoint(userId, endpointId, updates)
  if (!success) {
    return { success: false, error: 'Failed to update webhook' }
  }
  return { success: true }
}

/**
 * List all webhook endpoints for a user
 */
export async function listUserWebhookEndpoints(userId: string) {
  if (!isSvixEnabled()) {
    return []
  }
  
  // Check if user has SVIX enabled
  const enabled = await isUserSvixEnabled(userId)
  if (!enabled) {
    return []
  }
  
  return listUserEndpoints(userId)
}

/**
 * Get the App Portal URL for a user to manage webhooks
 */
export async function getUserWebhookPortalUrl(userId: string): Promise<string | null> {
  if (!isSvixEnabled()) {
    return null
  }
  
  // Ensure user has SVIX enabled
  const svixAppId = await ensureUserSvixEnabled(userId)
  if (!svixAppId) {
    return null
  }
  
  return getAppPortalUrl(userId)
}

// ============================================================================
// Event Type Registration
// ============================================================================

/**
 * Register all event types with SVIX
 * Call this on application startup or when updating schemas
 */
export async function registerEventTypes(): Promise<boolean> {
  const client = getSvixClient()
  if (!client) {
    console.log('[SVIX User Management] Skipping event type registration - SVIX not configured')
    return false
  }
  
  try {
    for (const eventType of SVIX_EVENT_TYPE_DEFINITIONS) {
      try {
        // Try to update first (in case it exists and we want to update the schema)
        await client.eventType.update(eventType.name, {
          description: eventType.description,
          schemas: eventType.schemas as any,
        })
        console.log(`[SVIX] Updated event type: ${eventType.name}`)
      } catch (updateError: any) {
        // If update fails (not found), try to create
        if (updateError?.code === 404 || updateError?.message?.includes('not found')) {
          try {
            await client.eventType.create({
              name: eventType.name,
              description: eventType.description,
              schemas: eventType.schemas as any,
            })
            console.log(`[SVIX] Registered event type: ${eventType.name}`)
          } catch (createError: any) {
            // Ignore "already exists" errors
            if (createError?.code !== 'conflict' && !createError?.message?.includes('already exists')) {
              console.error(`[SVIX] Failed to register event type ${eventType.name}:`, createError)
            }
          }
        } else {
          console.error(`[SVIX] Failed to update event type ${eventType.name}:`, updateError)
        }
      }
    }
    
    return true
  } catch (error) {
    console.error('[SVIX User Management] Error registering event types:', error)
    return false
  }
}

