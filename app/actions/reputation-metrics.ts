"use server"

/**
 * User Reputation Metrics Server Actions
 * 
 * Fetches SES reputation metrics (bounce rate, complaint rate) for the current user's tenant.
 */

import { getCurrentSession } from "@/lib/auth/auth-utils"
import { getTenantsByUserId } from "@/lib/db/tenants"
import {
  CloudWatchClient,
  GetMetricDataCommand,
  MetricDataQuery
} from "@aws-sdk/client-cloudwatch"

const awsRegion = process.env.AWS_REGION || "us-east-2"
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

// Initialize CloudWatch client
let cloudWatchClient: CloudWatchClient | null = null

if (awsAccessKeyId && awsSecretAccessKey) {
  cloudWatchClient = new CloudWatchClient({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
    },
  })
}

export interface ReputationMetrics {
  sends: number
  deliveries: number
  bounces: number
  complaints: number
  bounceRate: number
  complaintRate: number
  deliveryRate: number
}

export interface ReputationMetricsResult {
  success: boolean
  metrics?: ReputationMetrics
  error?: string
}

/**
 * Get reputation metrics for the current user's tenant
 * Fetches data from AWS CloudWatch for the last 24 hours
 */
export async function getUserReputationMetrics(): Promise<ReputationMetricsResult> {
  try {
    // Get current session
    const session = await getCurrentSession()
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" }
    }

    // Check if CloudWatch client is initialized
    if (!cloudWatchClient) {
      console.error("CloudWatch client not initialized - missing AWS credentials")
      return { success: false, error: "AWS not configured" }
    }

    // Get user's tenant
    const tenants = await getTenantsByUserId(session.user.id)
    if (!tenants || tenants.length === 0) {
      // No tenant found - return zeros (user hasn't set up sending yet)
      return {
        success: true,
        metrics: {
          sends: 0,
          deliveries: 0,
          bounces: 0,
          complaints: 0,
          bounceRate: 0,
          complaintRate: 0,
          deliveryRate: 100,
        }
      }
    }

    // Use the first tenant (users typically have one tenant)
    const tenant = tenants[0]
    
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
    ]

    const metricsResult = await cloudWatchClient.send(
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

    const bounceRate = sends > 0 ? (bounces / sends) * 100 : 0
    const complaintRate = sends > 0 ? (complaints / sends) * 100 : 0
    const deliveryRate = sends > 0 ? (deliveries / sends) * 100 : 100

    return {
      success: true,
      metrics: {
        sends,
        deliveries,
        bounces,
        complaints,
        bounceRate,
        complaintRate,
        deliveryRate,
      }
    }

  } catch (error) {
    console.error("Error fetching reputation metrics:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to fetch metrics" 
    }
  }
}

