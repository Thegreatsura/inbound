"use server"

/**
 * Admin Tenant Management Server Actions
 * 
 * Provides admin-only functions to view and manage SES tenants,
 * including fetching metrics from AWS CloudWatch and database.
 */

import { getCurrentSession, isAdminRole } from "@/lib/auth/auth-utils"
import { db } from "@/lib/db"
import { sesTenants, emailDomains, user, sentEmails, structuredEmails } from "@/lib/db/schema"
import { eq, desc, asc, sql, ilike, or, count } from "drizzle-orm"
import { 
  SESv2Client, 
  GetTenantCommand, 
  ListTenantsCommand,
  GetAccountCommand
} from "@aws-sdk/client-sesv2"
import {
  CloudWatchClient,
  GetMetricDataCommand,
  MetricDataQuery
} from "@aws-sdk/client-cloudwatch"

const awsRegion = process.env.AWS_REGION || "us-east-2"
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

// Initialize clients
let sesv2Client: SESv2Client | null = null
let cloudWatchClient: CloudWatchClient | null = null

if (awsAccessKeyId && awsSecretAccessKey) {
  sesv2Client = new SESv2Client({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    },
  })
  cloudWatchClient = new CloudWatchClient({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    },
  })
}

// Types
export interface TenantWithMetrics {
  id: string
  userId: string
  userName: string | null
  userEmail: string | null
  awsTenantId: string
  tenantName: string
  configurationSetName: string | null
  status: string
  reputationPolicy: string
  createdAt: Date | null
  updatedAt: Date | null
  // AWS Status
  awsSendingStatus?: "ENABLED" | "REINSTATED" | "DISABLED" | null
  // Domain info
  domains: {
    domain: string
    status: string
    canReceiveEmails: boolean | null
  }[]
  // Metrics - sends/receives from DB, bounces/complaints from CloudWatch
  metrics: {
    sends: number        // From database
    receives: number     // From database  
    bounces: number      // From CloudWatch
    complaints: number   // From CloudWatch
    bounceRate: number
    complaintRate: number
  }
}

export interface AdminTenantListResult {
  success: boolean
  tenants?: TenantWithMetrics[]
  total?: number
  pagination?: {
    limit: number
    offset: number
    hasMore: boolean
  }
  error?: string
}

// Helper to add delay between requests
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Cache for account-level metrics (shared across all tenants)
let accountMetricsCache: {
  bounces: number
  complaints: number
  sends: number
  timestamp: number
} | null = null

// Fetch account-level bounce/complaint metrics from CloudWatch (no dimensions)
async function fetchAccountLevelMetrics(): Promise<{ bounces: number; complaints: number; sends: number }> {
  // Return cached data if less than 5 minutes old
  if (accountMetricsCache && Date.now() - accountMetricsCache.timestamp < 5 * 60 * 1000) {
    return {
      bounces: accountMetricsCache.bounces,
      complaints: accountMetricsCache.complaints,
      sends: accountMetricsCache.sends,
    }
  }

  if (!cloudWatchClient) {
    return { bounces: 0, complaints: 0, sends: 0 }
  }

  try {
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Query account-level metrics (no dimensions)
    const metricQueries: MetricDataQuery[] = [
      {
        Id: "bounces",
        MetricStat: {
          Metric: {
            Namespace: "AWS/SES",
            MetricName: "Bounce",
            Dimensions: [], // No dimensions = account level
          },
          Period: 86400,
          Stat: "Sum",
        },
      },
      {
        Id: "complaints",
        MetricStat: {
          Metric: {
            Namespace: "AWS/SES",
            MetricName: "Complaint",
            Dimensions: [],
          },
          Period: 86400,
          Stat: "Sum",
        },
      },
      {
        Id: "sends",
        MetricStat: {
          Metric: {
            Namespace: "AWS/SES",
            MetricName: "Send",
            Dimensions: [],
          },
          Period: 86400,
          Stat: "Sum",
        },
      },
    ]

    const metricsResult = await cloudWatchClient.send(
      new GetMetricDataCommand({
        StartTime: startTime,
        EndTime: endTime,
        MetricDataQueries: metricQueries,
      })
    )

    // Sum up all values across the time period
    const bounces = metricsResult.MetricDataResults?.find(r => r.Id === "bounces")?.Values?.reduce((a, b) => a + b, 0) || 0
    const complaints = metricsResult.MetricDataResults?.find(r => r.Id === "complaints")?.Values?.reduce((a, b) => a + b, 0) || 0
    const sends = metricsResult.MetricDataResults?.find(r => r.Id === "sends")?.Values?.reduce((a, b) => a + b, 0) || 0

    // Cache the results
    accountMetricsCache = {
      bounces,
      complaints,
      sends,
      timestamp: Date.now(),
    }

    console.log(`Account-level metrics (7d): bounces=${bounces}, complaints=${complaints}, sends=${sends}`)

    return { bounces, complaints, sends }
  } catch (error) {
    console.error("Failed to get account-level CloudWatch metrics:", error)
    return { bounces: 0, complaints: 0, sends: 0 }
  }
}

// Fetch per-tenant CloudWatch metrics using custom ConfigurationSet dimension
// The event destination in add-cloudwatch-to-config-sets.ts uses 'ConfigurationSet' as the dimension name
async function fetchTenantCloudWatchMetrics(
  configurationSetName: string | null
): Promise<{ bounces: number; complaints: number; sends: number }> {
  if (!cloudWatchClient || !configurationSetName) {
    return { bounces: 0, complaints: 0, sends: 0 }
  }

  try {
    const endTime = new Date()
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Query metrics with 'ConfigurationSet' dimension (custom name from event destination)
    const metricQueries: MetricDataQuery[] = [
      {
        Id: "bounces",
        MetricStat: {
          Metric: {
            Namespace: "AWS/SES",
            MetricName: "Bounce",
            Dimensions: [
              { Name: "ConfigurationSet", Value: configurationSetName },
            ],
          },
          Period: 86400,
          Stat: "Sum",
        },
      },
      {
        Id: "complaints",
        MetricStat: {
          Metric: {
            Namespace: "AWS/SES",
            MetricName: "Complaint",
            Dimensions: [
              { Name: "ConfigurationSet", Value: configurationSetName },
            ],
          },
          Period: 86400,
          Stat: "Sum",
        },
      },
      {
        Id: "sends",
        MetricStat: {
          Metric: {
            Namespace: "AWS/SES",
            MetricName: "Send",
            Dimensions: [
              { Name: "ConfigurationSet", Value: configurationSetName },
            ],
          },
          Period: 86400,
          Stat: "Sum",
        },
      },
    ]

    const metricsResult = await cloudWatchClient.send(
      new GetMetricDataCommand({
        StartTime: startTime,
        EndTime: endTime,
        MetricDataQueries: metricQueries,
      })
    )

    // Sum up all values across the time period
    const bounces = metricsResult.MetricDataResults?.find(r => r.Id === "bounces")?.Values?.reduce((a, b) => a + b, 0) || 0
    const complaints = metricsResult.MetricDataResults?.find(r => r.Id === "complaints")?.Values?.reduce((a, b) => a + b, 0) || 0
    const sends = metricsResult.MetricDataResults?.find(r => r.Id === "sends")?.Values?.reduce((a, b) => a + b, 0) || 0

    return { bounces, complaints, sends }
  } catch (error) {
    // Silently fail - metrics might not be available yet
    return { bounces: 0, complaints: 0, sends: 0 }
  }
}

// Fetch AWS tenant status
async function fetchTenantStatus(
  tenantName: string
): Promise<"ENABLED" | "REINSTATED" | "DISABLED" | null> {
  if (!sesv2Client) {
    return null
  }

  try {
    const getTenantCommand = new GetTenantCommand({
      TenantName: tenantName,
    })
    const awsTenantResult = await sesv2Client.send(getTenantCommand)
    return awsTenantResult.Tenant?.SendingStatus as any
  } catch (tenantError) {
    // Tenant might not exist in AWS yet
    return null
  }
}

/**
 * Get paginated tenants with their AWS status and metrics
 * Admin-only function with server-side pagination and filtering
 * 
 * Sends/Receives: Pulled from database (accurate)
 * Bounces/Complaints: Pulled from AWS CloudWatch
 */
export async function getAdminTenantList(
  options?: {
    search?: string
    sortBy?: "tenantName" | "createdAt" | "sends" | "receives"
    sortOrder?: "asc" | "desc"
    limit?: number
    offset?: number
  }
): Promise<AdminTenantListResult> {
  try {
    // Verify admin access
    const session = await getCurrentSession()
    if (!session || !isAdminRole(session.user.role)) {
      return { success: false, error: "Unauthorized - Admin access required" }
    }

    const limit = options?.limit || 50
    const offset = options?.offset || 0

    // Build where clause for search
    const searchConditions = options?.search
      ? or(
          ilike(sesTenants.tenantName, `%${options.search}%`),
          ilike(user.email, `%${options.search}%`),
          ilike(user.name, `%${options.search}%`)
        )
      : undefined

    // Get total count for pagination
    const [totalResult] = await db
      .select({ count: count() })
      .from(sesTenants)
      .leftJoin(user, eq(sesTenants.userId, user.id))
      .where(searchConditions)

    const total = totalResult?.count || 0

    // Get all user IDs for tenants that match search (for counting emails)
    // We need this for sorting by sends/receives
    const allTenantUserIds = await db
      .select({ userId: sesTenants.userId })
      .from(sesTenants)
      .leftJoin(user, eq(sesTenants.userId, user.id))
      .where(searchConditions)

    const userIds = allTenantUserIds.map(t => t.userId)

    // Fetch send counts per user (last 24 hours)
    const sendCounts = userIds.length > 0
      ? await db
          .select({
            userId: sentEmails.userId,
            count: count(),
          })
          .from(sentEmails)
          .where(sql`${sentEmails.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)}) AND ${sentEmails.createdAt} >= NOW() - INTERVAL '24 hours'`)
          .groupBy(sentEmails.userId)
      : []

    // Fetch receive counts per user (last 24 hours)
    const receiveCounts = userIds.length > 0
      ? await db
          .select({
            userId: structuredEmails.userId,
            count: count(),
          })
          .from(structuredEmails)
          .where(sql`${structuredEmails.userId} IN (${sql.join(userIds.map(id => sql`${id}`), sql`, `)}) AND ${structuredEmails.createdAt} >= NOW() - INTERVAL '24 hours'`)
          .groupBy(structuredEmails.userId)
      : []

    // Create lookup maps for counts
    const sendCountMap = new Map(sendCounts.map(s => [s.userId, Number(s.count)]))
    const receiveCountMap = new Map(receiveCounts.map(r => [r.userId, Number(r.count)]))

    // Get base tenants from database with user info
    let tenantsQuery = db
      .select({
        id: sesTenants.id,
        userId: sesTenants.userId,
        awsTenantId: sesTenants.awsTenantId,
        tenantName: sesTenants.tenantName,
        configurationSetName: sesTenants.configurationSetName,
        status: sesTenants.status,
        reputationPolicy: sesTenants.reputationPolicy,
        createdAt: sesTenants.createdAt,
        updatedAt: sesTenants.updatedAt,
        userName: user.name,
        userEmail: user.email,
      })
      .from(sesTenants)
      .leftJoin(user, eq(sesTenants.userId, user.id))
      .where(searchConditions)

    // Apply database-level sorting for tenant fields
    const sortOrder = options?.sortOrder || 'desc'
    const sortByMetric = options?.sortBy === 'sends' || options?.sortBy === 'receives'
    
    if (!sortByMetric) {
      // Sort at database level for non-metric fields
      switch (options?.sortBy) {
        case 'tenantName':
          // @ts-ignore
          tenantsQuery = tenantsQuery.orderBy(sortOrder === 'asc' ? asc(sesTenants.tenantName) : desc(sesTenants.tenantName))
          break
        case 'createdAt':
        default:
          // @ts-ignore
          tenantsQuery = tenantsQuery.orderBy(sortOrder === 'asc' ? asc(sesTenants.createdAt) : desc(sesTenants.createdAt))
      }
    }

    // For metric sorting, we need all matching tenants first, then sort in memory
    let allTenants = await tenantsQuery

    // Add counts to tenants
    let tenantsWithCounts = allTenants.map(tenant => ({
      ...tenant,
      sends: sendCountMap.get(tenant.userId) || 0,
      receives: receiveCountMap.get(tenant.userId) || 0,
    }))

    // Sort by metric if needed
    if (sortByMetric) {
      const sortField = options?.sortBy as 'sends' | 'receives'
      tenantsWithCounts.sort((a, b) => {
        const aVal = a[sortField]
        const bVal = b[sortField]
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      })
    }

    // Apply pagination after sorting
    tenantsWithCounts = tenantsWithCounts.slice(offset, offset + limit)

    // Get domains for the current page of tenants only
    const tenantIds = tenantsWithCounts.map(t => t.id)
    
    const domainsForPage = tenantIds.length > 0
      ? await db
          .select({
            domain: emailDomains.domain,
            status: emailDomains.status,
            canReceiveEmails: emailDomains.canReceiveEmails,
            tenantId: emailDomains.tenantId,
          })
          .from(emailDomains)
          .where(sql`${emailDomains.tenantId} IN (${sql.join(tenantIds.map(id => sql`${id}`), sql`, `)})`)
      : []

    // Group domains by tenant
    const domainsByTenant = domainsForPage.reduce((acc, domain) => {
      if (domain.tenantId) {
        if (!acc[domain.tenantId]) {
          acc[domain.tenantId] = []
        }
        acc[domain.tenantId].push({
          domain: domain.domain,
          status: domain.status,
          canReceiveEmails: domain.canReceiveEmails,
        })
      }
      return acc
    }, {} as Record<string, { domain: string; status: string; canReceiveEmails: boolean | null }[]>)

    // Fetch AWS tenant statuses and CloudWatch metrics with rate limiting
    // Process in small batches with delays to avoid rate limits
    const BATCH_SIZE = 5
    const BATCH_DELAY_MS = 200

    const tenantsWithMetrics: TenantWithMetrics[] = []

    for (let i = 0; i < tenantsWithCounts.length; i += BATCH_SIZE) {
      const batch = tenantsWithCounts.slice(i, i + BATCH_SIZE)
      
      const batchResults = await Promise.all(
        batch.map(async (tenant) => {
          // Fetch AWS tenant status and CloudWatch metrics in parallel
          const [awsSendingStatus, cwMetrics] = await Promise.all([
            fetchTenantStatus(tenant.tenantName),
            fetchTenantCloudWatchMetrics(tenant.configurationSetName)
          ])
          
          // Database counts (24h)
          const dbSends = Number(tenant.sends) || 0
          const receives = Number(tenant.receives) || 0
          
          // CloudWatch metrics (7d) - will be 0 until reputation metrics are enabled
          // Run: bun run scripts/enable-reputation-metrics.ts to enable
          const bounces = cwMetrics.bounces
          const complaints = cwMetrics.complaints
          const cwSends = cwMetrics.sends
          
          // Use CloudWatch sends if available, otherwise fall back to database
          const totalSends = cwSends > 0 ? cwSends : dbSends
          
          return {
            id: tenant.id,
            userId: tenant.userId,
            userName: tenant.userName,
            userEmail: tenant.userEmail,
            awsTenantId: tenant.awsTenantId,
            tenantName: tenant.tenantName,
            configurationSetName: tenant.configurationSetName,
            status: tenant.status,
            reputationPolicy: tenant.reputationPolicy,
            createdAt: tenant.createdAt,
            updatedAt: tenant.updatedAt,
            awsSendingStatus,
            domains: domainsByTenant[tenant.id] || [],
            metrics: {
              sends: dbSends,       // Database count (24h)
              receives,             // Database count (24h)
              bounces,              // CloudWatch (7d)
              complaints,           // CloudWatch (7d)
              bounceRate: totalSends > 0 ? (bounces / totalSends) * 100 : 0,
              complaintRate: totalSends > 0 ? (complaints / totalSends) * 100 : 0,
            },
          }
        })
      )

      tenantsWithMetrics.push(...batchResults)

      // Add delay between batches if not the last batch
      if (i + BATCH_SIZE < tenantsWithCounts.length) {
        await delay(BATCH_DELAY_MS)
      }
    }

    return {
      success: true,
      tenants: tenantsWithMetrics,
      total,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    }
  } catch (error) {
    console.error("Failed to get admin tenant list:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load tenants",
    }
  }
}

/**
 * Get SES account-level statistics
 * Admin-only function
 */
export async function getAdminSESAccountStats(): Promise<{
  success: boolean
  stats?: {
    sendingEnabled: boolean
    enforcementStatus: string
    maxSendRate: number
    max24HourSend: number
    sentLast24Hours: number
    remainingQuota: number
    // CloudWatch metrics (7 day totals)
    bounces7d: number
    complaints7d: number
    sends7d: number
    bounceRate7d: number
    complaintRate7d: number
  }
  error?: string
}> {
  try {
    // Verify admin access
    const session = await getCurrentSession()
    if (!session || !isAdminRole(session.user.role)) {
      return { success: false, error: "Unauthorized - Admin access required" }
    }

    if (!sesv2Client) {
      return { success: false, error: "AWS SES client not configured" }
    }

    // Get account info from SES
    const accountResult = await sesv2Client.send(new GetAccountCommand({}))

    // Get CloudWatch metrics for bounces/complaints (7 days)
    const cloudWatchMetrics = await fetchAccountLevelMetrics()

    const bounceRate7d = cloudWatchMetrics.sends > 0 
      ? (cloudWatchMetrics.bounces / cloudWatchMetrics.sends) * 100 
      : 0
    const complaintRate7d = cloudWatchMetrics.sends > 0 
      ? (cloudWatchMetrics.complaints / cloudWatchMetrics.sends) * 100 
      : 0

    return {
      success: true,
      stats: {
        sendingEnabled: accountResult.SendingEnabled || false,
        enforcementStatus: accountResult.EnforcementStatus || "UNKNOWN",
        maxSendRate: accountResult.SendQuota?.MaxSendRate || 0,
        max24HourSend: accountResult.SendQuota?.Max24HourSend || 0,
        sentLast24Hours: accountResult.SendQuota?.SentLast24Hours || 0,
        remainingQuota: (accountResult.SendQuota?.Max24HourSend || 0) - (accountResult.SendQuota?.SentLast24Hours || 0),
        // CloudWatch metrics
        bounces7d: cloudWatchMetrics.bounces,
        complaints7d: cloudWatchMetrics.complaints,
        sends7d: cloudWatchMetrics.sends,
        bounceRate7d,
        complaintRate7d,
      },
    }
  } catch (error) {
    console.error("Failed to get SES account stats:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to load SES account stats",
    }
  }
}
