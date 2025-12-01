"use server"

/**
 * Admin Tenant Management Server Actions
 * 
 * Provides admin-only functions to view and manage SES tenants,
 * including fetching metrics from AWS CloudWatch.
 */

import { getCurrentSession, isAdminRole } from "@/lib/auth/auth-utils"
import { db } from "@/lib/db"
import { sesTenants, emailDomains, user } from "@/lib/db/schema"
import { eq, desc, sql, like, or } from "drizzle-orm"
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
  // Metrics (from CloudWatch - 24h)
  metrics?: {
    sends: number
    deliveries: number
    bounces: number
    complaints: number
    rejects: number
    bounceRate: number
    complaintRate: number
  }
}

export interface AdminTenantListResult {
  success: boolean
  tenants?: TenantWithMetrics[]
  total?: number
  error?: string
}

/**
 * Get all tenants with their AWS status and metrics
 * Admin-only function
 */
export async function getAdminTenantList(
  options?: {
    search?: string
    sortBy?: "tenantName" | "bounceRate" | "complaintRate" | "sends" | "createdAt"
    sortOrder?: "asc" | "desc"
  }
): Promise<AdminTenantListResult> {
  try {
    // Verify admin access
    const session = await getCurrentSession()
    if (!session || !isAdminRole(session.user.role)) {
      return { success: false, error: "Unauthorized - Admin access required" }
    }

    // Check AWS clients
    if (!sesv2Client || !cloudWatchClient) {
      return { success: false, error: "AWS clients not configured" }
    }

    // Get all tenants from database with user info and domains
    const tenantsWithUsers = await db
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
      .orderBy(desc(sesTenants.createdAt))

    // Get domains for each tenant
    const allDomains = await db
      .select({
        domain: emailDomains.domain,
        status: emailDomains.status,
        canReceiveEmails: emailDomains.canReceiveEmails,
        tenantId: emailDomains.tenantId,
      })
      .from(emailDomains)

    // Group domains by tenant
    const domainsByTenant = allDomains.reduce((acc, domain) => {
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

    // Fetch AWS tenant status and metrics for each tenant
    const tenantsWithMetrics: TenantWithMetrics[] = await Promise.all(
      tenantsWithUsers.map(async (tenant) => {
        let awsSendingStatus: "ENABLED" | "REINSTATED" | "DISABLED" | null = null
        let metrics: TenantWithMetrics["metrics"] = undefined

        try {
          // Get AWS tenant status
          const getTenantCommand = new GetTenantCommand({
            TenantName: tenant.tenantName,
          })
          const awsTenantResult = await sesv2Client!.send(getTenantCommand)
          awsSendingStatus = awsTenantResult.Tenant?.SendingStatus as any

          // Get CloudWatch metrics for this tenant (last 24 hours)
          const endTime = new Date()
          const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000)

          const metricQueries: MetricDataQuery[] = [
            {
              Id: "sends",
              MetricStat: {
                Metric: {
                  Namespace: "AWS/SES",
                  MetricName: "Send",
                  Dimensions: [
                    { Name: "TenantName", Value: tenant.tenantName },
                  ],
                },
                Period: 86400, // 24 hours
                Stat: "Sum",
              },
            },
            {
              Id: "deliveries",
              MetricStat: {
                Metric: {
                  Namespace: "AWS/SES",
                  MetricName: "Delivery",
                  Dimensions: [
                    { Name: "TenantName", Value: tenant.tenantName },
                  ],
                },
                Period: 86400,
                Stat: "Sum",
              },
            },
            {
              Id: "bounces",
              MetricStat: {
                Metric: {
                  Namespace: "AWS/SES",
                  MetricName: "Bounce",
                  Dimensions: [
                    { Name: "TenantName", Value: tenant.tenantName },
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
                    { Name: "TenantName", Value: tenant.tenantName },
                  ],
                },
                Period: 86400,
                Stat: "Sum",
              },
            },
            {
              Id: "rejects",
              MetricStat: {
                Metric: {
                  Namespace: "AWS/SES",
                  MetricName: "Reject",
                  Dimensions: [
                    { Name: "TenantName", Value: tenant.tenantName },
                  ],
                },
                Period: 86400,
                Stat: "Sum",
              },
            },
          ]

          const metricsResult = await cloudWatchClient!.send(
            new GetMetricDataCommand({
              StartTime: startTime,
              EndTime: endTime,
              MetricDataQueries: metricQueries,
            })
          )

          // Parse metrics
          const sends = metricsResult.MetricDataResults?.find(r => r.Id === "sends")?.Values?.[0] || 0
          const deliveries = metricsResult.MetricDataResults?.find(r => r.Id === "deliveries")?.Values?.[0] || 0
          const bounces = metricsResult.MetricDataResults?.find(r => r.Id === "bounces")?.Values?.[0] || 0
          const complaints = metricsResult.MetricDataResults?.find(r => r.Id === "complaints")?.Values?.[0] || 0
          const rejects = metricsResult.MetricDataResults?.find(r => r.Id === "rejects")?.Values?.[0] || 0

          metrics = {
            sends,
            deliveries,
            bounces,
            complaints,
            rejects,
            bounceRate: sends > 0 ? (bounces / sends) * 100 : 0,
            complaintRate: sends > 0 ? (complaints / sends) * 100 : 0,
          }
        } catch (awsError) {
          console.error(`Failed to get AWS data for tenant ${tenant.tenantName}:`, awsError)
          // Continue without AWS data
        }

        return {
          ...tenant,
          awsSendingStatus,
          domains: domainsByTenant[tenant.id] || [],
          metrics,
        }
      })
    )

    // Apply search filter
    let filteredTenants = tenantsWithMetrics
    if (options?.search) {
      const searchLower = options.search.toLowerCase()
      filteredTenants = tenantsWithMetrics.filter(t => 
        t.tenantName.toLowerCase().includes(searchLower) ||
        t.userEmail?.toLowerCase().includes(searchLower) ||
        t.userName?.toLowerCase().includes(searchLower) ||
        t.domains.some(d => d.domain.toLowerCase().includes(searchLower))
      )
    }

    // Apply sorting
    if (options?.sortBy) {
      filteredTenants.sort((a, b) => {
        let aVal: any, bVal: any
        switch (options.sortBy) {
          case "tenantName":
            aVal = a.tenantName
            bVal = b.tenantName
            break
          case "bounceRate":
            aVal = a.metrics?.bounceRate || 0
            bVal = b.metrics?.bounceRate || 0
            break
          case "complaintRate":
            aVal = a.metrics?.complaintRate || 0
            bVal = b.metrics?.complaintRate || 0
            break
          case "sends":
            aVal = a.metrics?.sends || 0
            bVal = b.metrics?.sends || 0
            break
          case "createdAt":
            aVal = a.createdAt?.getTime() || 0
            bVal = b.createdAt?.getTime() || 0
            break
          default:
            return 0
        }
        
        if (typeof aVal === "string") {
          return options.sortOrder === "desc" 
            ? bVal.localeCompare(aVal) 
            : aVal.localeCompare(bVal)
        }
        return options.sortOrder === "desc" ? bVal - aVal : aVal - bVal
      })
    }

    return {
      success: true,
      tenants: filteredTenants,
      total: filteredTenants.length,
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

    const accountResult = await sesv2Client.send(new GetAccountCommand({}))

    return {
      success: true,
      stats: {
        sendingEnabled: accountResult.SendingEnabled || false,
        enforcementStatus: accountResult.EnforcementStatus || "UNKNOWN",
        maxSendRate: accountResult.SendQuota?.MaxSendRate || 0,
        max24HourSend: accountResult.SendQuota?.Max24HourSend || 0,
        sentLast24Hours: accountResult.SendQuota?.SentLast24Hours || 0,
        remainingQuota: (accountResult.SendQuota?.Max24HourSend || 0) - (accountResult.SendQuota?.SentLast24Hours || 0),
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

