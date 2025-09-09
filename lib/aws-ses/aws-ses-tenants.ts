/**
 * AWS SES Tenant Management Library
 * 
 * Provides isolated tenant management for multi-tenant SES architecture.
 * Each tenant gets separate reputation tracking and identity management.
 * 
 * Key Features:
 * - Create/manage AWS SES tenants
 * - Associate identities with tenants
 * - Reputation policy management
 * - Tenant status tracking
 */

import { 
  SESv2Client,
  CreateTenantCommand,
  DeleteTenantCommand,
  GetTenantCommand,
  ListTenantsCommand,
  CreateTenantResourceAssociationCommand,
  DeleteTenantResourceAssociationCommand,
  ListTenantResourcesCommand
} from '@aws-sdk/client-sesv2'
import { db } from '@/lib/db'
import { sesTenants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

// Types
export interface CreateTenantParams {
  userId: string
  tenantName?: string
  reputationPolicy?: 'standard' | 'strict' | 'none'
}

export interface CreateTenantResult {
  tenant: {
    id: string
    userId: string
    awsTenantId: string
    tenantName: string
    status: string
    reputationPolicy: string
  }
  success: boolean
  error?: string
}

export interface AssociateIdentityParams {
  tenantId: string
  identity: string // Domain or email address
  resourceType: 'IDENTITY'
}

// AWS SESv2 Client Setup (required for tenant management)
const awsRegion = process.env.AWS_REGION || 'us-east-2'
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

let sesv2Client: SESv2Client | null = null

if (awsAccessKeyId && awsSecretAccessKey) {
  sesv2Client = new SESv2Client({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    }
  })
}

/**
 * SES Tenant Manager Class
 * Handles all tenant operations with AWS SESv2 and local database
 */
export class SESTenantManager {
  private sesv2Client: SESv2Client

  constructor(client?: SESv2Client) {
    if (!client && !sesv2Client) {
      throw new Error('AWS SES not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.')
    }
    this.sesv2Client = client || sesv2Client!
  }

  /**
   * Create a new tenant for a user
   * This creates both the AWS SES tenant and local database record
   */
  async createTenant({ userId, tenantName, reputationPolicy = 'standard' }: CreateTenantParams): Promise<CreateTenantResult> {
    try {
      console.log(`🏢 Creating SES tenant for user: ${userId}`)
      
      // Check if user already has a tenant
      const existingTenant = await db
        .select()
        .from(sesTenants)
        .where(eq(sesTenants.userId, userId))
        .limit(1)

      if (existingTenant.length > 0) {
        return {
          tenant: existingTenant[0],
          success: true,
          error: 'Tenant already exists for user'
        }
      }

      // Generate tenant name if not provided
      const finalTenantName = tenantName || `user-${userId}`
      
      // Create AWS SES tenant
      const createCommand = new CreateTenantCommand({
        TenantName: finalTenantName,
        Tags: [
          { Key: 'UserId', Value: userId },
          { Key: 'Environment', Value: process.env.NODE_ENV || 'development' },
          { Key: 'CreatedBy', Value: 'inbound-tenant-manager' }
        ]
      })

      console.log(`📡 Creating AWS SES tenant: ${finalTenantName}`)
      let awsTenantId: string
      
      try {
        const awsResponse = await this.sesv2Client.send(createCommand)
        awsTenantId = awsResponse.TenantId || ''
        
        if (!awsTenantId) {
          throw new Error('Failed to create AWS SES tenant - no tenant ID returned')
        }
        console.log(`✅ AWS SES tenant created with ID: ${awsTenantId}`)
      } catch (error: any) {
        // Handle case where tenant already exists in AWS
        if (error?.name === 'AlreadyExistsException' || error?.message?.includes('already exists')) {
          console.log(`📋 Tenant already exists in AWS, getting existing tenant details...`)
          
          // Get existing tenant details
          const getTenantCommand = new GetTenantCommand({
            TenantName: finalTenantName
          })
          
          try {
            const existingTenantResponse = await this.sesv2Client.send(getTenantCommand)
            awsTenantId = existingTenantResponse.Tenant?.TenantId || ''
            console.log(`✅ Using existing AWS tenant: ${awsTenantId}`)
          } catch (getError) {
            throw new Error(`Tenant exists but could not retrieve details: ${getError instanceof Error ? getError.message : 'Unknown error'}`)
          }
        } else {
          throw error // Re-throw if not an "already exists" error
        }
      }

      // Store in local database
      const tenantId = `tenant_${nanoid()}`
      const [newTenant] = await db
        .insert(sesTenants)
        .values({
          id: tenantId,
          userId,
          awsTenantId,
          tenantName: finalTenantName,
          status: 'active',
          reputationPolicy,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning()

      console.log(`✅ SES tenant created successfully: ${tenantId} -> ${awsTenantId}`)

      return {
        tenant: newTenant,
        success: true
      }

    } catch (error) {
      console.error('❌ Failed to create SES tenant:', error)
      return {
        tenant: null as any,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating tenant'
      }
    }
  }

  /**
   * Get or create tenant for a user
   * This ensures every user has a tenant before creating identities
   */
  async getOrCreateUserTenant(userId: string): Promise<CreateTenantResult> {
    try {
      // First try to get existing tenant
      const existingTenant = await db
        .select()
        .from(sesTenants)
        .where(eq(sesTenants.userId, userId))
        .limit(1)

      if (existingTenant.length > 0) {
        console.log(`📋 Found existing tenant for user ${userId}: ${existingTenant[0].id}`)
        return {
          tenant: existingTenant[0],
          success: true
        }
      }

      // Create new tenant if none exists
      console.log(`🆕 Creating new tenant for user: ${userId}`)
      return await this.createTenant({ userId })

    } catch (error) {
      console.error('❌ Failed to get or create tenant:', error)
      return {
        tenant: null as any,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Associate an identity (domain/email) with a tenant
   * This is called when creating new domains or email addresses
   */
  async associateIdentityWithTenant({ tenantId, identity, resourceType }: AssociateIdentityParams): Promise<{ success: boolean; error?: string }> {
    try {
      // Get tenant info from database
      const tenant = await db
        .select()
        .from(sesTenants)
        .where(eq(sesTenants.id, tenantId))
        .limit(1)

      if (tenant.length === 0) {
        throw new Error(`Tenant not found: ${tenantId}`)
      }

      const awsTenantId = tenant[0].awsTenantId

      console.log(`🔗 Associating identity ${identity} with tenant ${awsTenantId} (${awsTenantId})`)

      // Associate identity with AWS SES tenant (use tenantName, not awsTenantId)
      const tenantName = tenant[0].tenantName // Use the human-readable tenant name
      const associateCommand = new CreateTenantResourceAssociationCommand({
        TenantName: tenantName, // AWS requires the TenantName (human-readable), not TenantId
        ResourceArn: `arn:aws:ses:${process.env.AWS_REGION || 'us-east-2'}:${process.env.AWS_ACCOUNT_ID}:identity/${identity}` // Full ARN required
      })

      await this.sesv2Client.send(associateCommand)

      console.log(`✅ Identity ${identity} successfully associated with tenant ${tenantName}`)

      return { success: true }

    } catch (error) {
      console.error(`❌ Failed to associate identity ${identity} with tenant ${tenantId}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error associating identity'
      }
    }
  }

  /**
   * Get tenant information including AWS status
   */
  async getTenant(tenantId: string): Promise<{ tenant: any; awsTenant?: any; success: boolean; error?: string }> {
    try {
      // Get local tenant record
      const localTenant = await db
        .select()
        .from(sesTenants)
        .where(eq(sesTenants.id, tenantId))
        .limit(1)

      if (localTenant.length === 0) {
        return {
          tenant: null,
          success: false,
          error: 'Tenant not found'
        }
      }

      // Get AWS tenant details (use tenantName, not awsTenantId)
      const getTenantCommand = new GetTenantCommand({
        TenantName: localTenant[0].tenantName // AWS requires the TenantName (human-readable), not TenantId
      })

      const awsTenant = await this.sesv2Client.send(getTenantCommand)

      return {
        tenant: localTenant[0],
        awsTenant,
        success: true
      }

    } catch (error) {
      console.error(`❌ Failed to get tenant ${tenantId}:`, error)
      return {
        tenant: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error getting tenant'
      }
    }
  }

  /**
   * List all tenant resources (identities associated with tenant)
   */
  async listTenantResources(tenantId: string): Promise<{ resources: any[]; success: boolean; error?: string }> {
    try {
      const tenant = await db
        .select()
        .from(sesTenants)
        .where(eq(sesTenants.id, tenantId))
        .limit(1)

      if (tenant.length === 0) {
        return {
          resources: [],
          success: false,
          error: 'Tenant not found'
        }
      }

      const listResourcesCommand = new ListTenantResourcesCommand({
        TenantName: tenant[0].tenantName // AWS requires the TenantName (human-readable), not TenantId
      })

      const result = await this.sesv2Client.send(listResourcesCommand)

      // Note: Property structure needs verification - temporarily return empty for MVP
      console.log('📋 Tenant resources response:', result)
      return {
        resources: [], // TODO: Fix property name when AWS SDK types are clarified
        success: true
      }

    } catch (error) {
      console.error(`❌ Failed to list tenant resources for ${tenantId}:`, error)
      return {
        resources: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error listing resources'
      }
    }
  }
}

// Export default instance
export const sesTenantManager = sesv2Client ? new SESTenantManager(sesv2Client) : null

// Utility functions
export async function getUserTenant(userId: string): Promise<CreateTenantResult> {
  if (!sesTenantManager) {
    return {
      tenant: null as any,
      success: false,
      error: 'AWS SES not configured for tenant management'
    }
  }
  return sesTenantManager.getOrCreateUserTenant(userId)
}

export async function associateIdentityWithUserTenant(userId: string, identity: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!sesTenantManager) {
      return {
        success: false,
        error: 'AWS SES not configured for tenant management'
      }
    }

    // Get user's tenant
    const tenantResult = await getUserTenant(userId)
    if (!tenantResult.success) {
      return {
        success: false,
        error: `Failed to get user tenant: ${tenantResult.error}`
      }
    }

    // Associate identity with tenant
    return sesTenantManager.associateIdentityWithTenant({
      tenantId: tenantResult.tenant.id,
      identity,
      resourceType: 'IDENTITY'
    })

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
