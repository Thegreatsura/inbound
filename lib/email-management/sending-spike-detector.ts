/**
 * Email Sending Spike Detector
 * 
 * Detects unusual spikes in email sending volume compared to historical patterns.
 * When a user's current sending volume significantly exceeds their historical average,
 * an alert is sent to the admin Slack channel.
 * 
 * This helps identify:
 * - Compromised accounts
 * - Sudden spam campaigns
 * - Unusual user behavior that may need investigation
 */

import { db } from "@/lib/db"
import { sentEmails } from "@/lib/db/schema"
import { user } from "@/lib/db/auth-schema"
import { eq, and, gte, lt, sql, count } from "drizzle-orm"

const SLACK_ADMIN_WEBHOOK_URL = process.env.SLACK_ADMIN_WEBHOOK_URL

/**
 * Configuration for spike detection
 */
const SPIKE_DETECTION_CONFIG = {
  /** Number of days to look back for historical baseline */
  HISTORICAL_DAYS: 7,
  /** Multiplier threshold - alert if current > average * threshold */
  SPIKE_THRESHOLD_MULTIPLIER: 3,
  /** Minimum emails in historical period to establish a baseline */
  MIN_HISTORICAL_EMAILS: 5,
  /** Minimum emails in current period to trigger spike alert (prevent alerts for low-volume users) */
  MIN_CURRENT_EMAILS_FOR_ALERT: 10,
  /** Cooldown period in hours - don't alert again for same user within this time */
  ALERT_COOLDOWN_HOURS: 4,
}

/** In-memory cache for recent alerts to prevent spam */
const recentAlerts: Map<string, number> = new Map()

/**
 * Get email count for a user in the last N hours
 */
async function getEmailsSentInLastHours(userId: string, hours: number): Promise<number> {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000)

  const result = await db
    .select({ count: count() })
    .from(sentEmails)
    .where(
      and(
        eq(sentEmails.userId, userId),
        gte(sentEmails.createdAt, cutoffTime)
      )
    )

  return result[0]?.count || 0
}

/**
 * Get daily average email count for a user over a historical period
 * Excludes the most recent 24 hours to avoid contamination
 */
async function getHistoricalDailyAverage(userId: string, days: number): Promise<number> {
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const historicalStart = new Date(now.getTime() - (days + 1) * 24 * 60 * 60 * 1000)

  const result = await db
    .select({ count: count() })
    .from(sentEmails)
    .where(
      and(
        eq(sentEmails.userId, userId),
        gte(sentEmails.createdAt, historicalStart),
        lt(sentEmails.createdAt, oneDayAgo)
      )
    )

  const totalEmails = result[0]?.count || 0
  
  // Return daily average (total emails divided by number of days)
  return days > 0 ? totalEmails / days : 0
}

/**
 * Get user information for the alert
 */
async function getUserInfo(userId: string): Promise<{ email: string; name: string | null } | null> {
  const result = await db
    .select({ 
      email: user.email, 
      name: user.name 
    })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  return result[0] || null
}

/**
 * Check if we recently sent an alert for this user (cooldown)
 */
function isInCooldown(userId: string): boolean {
  const lastAlertTime = recentAlerts.get(userId)
  if (!lastAlertTime) return false
  
  const cooldownMs = SPIKE_DETECTION_CONFIG.ALERT_COOLDOWN_HOURS * 60 * 60 * 1000
  return Date.now() - lastAlertTime < cooldownMs
}

/**
 * Mark that we sent an alert for this user
 */
function markAlertSent(userId: string): void {
  recentAlerts.set(userId, Date.now())
  
  // Cleanup old entries to prevent memory leak
  const cooldownMs = SPIKE_DETECTION_CONFIG.ALERT_COOLDOWN_HOURS * 60 * 60 * 1000
  for (const [id, time] of recentAlerts.entries()) {
    if (Date.now() - time > cooldownMs * 2) {
      recentAlerts.delete(id)
    }
  }
}

/**
 * Send Slack alert for a sending spike
 */
async function sendSpikeAlert(
  userId: string,
  userEmail: string,
  userName: string | null,
  currentCount: number,
  historicalAverage: number,
  spikeMultiplier: number
): Promise<void> {
  if (!SLACK_ADMIN_WEBHOOK_URL) {
    console.log('⚠️ SLACK_ADMIN_WEBHOOK_URL not configured, skipping spike alert')
    return
  }

  try {
    const slackMessage = {
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🚨 Email Sending Spike Detected',
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*User sending significantly more emails than usual*`
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*User:*\n${userName || 'N/A'} (${userEmail})`
            },
            {
              type: 'mrkdwn',
              text: `*User ID:*\n\`${userId}\``
            },
            {
              type: 'mrkdwn',
              text: `*Emails (Last 24h):*\n${currentCount}`
            },
            {
              type: 'mrkdwn',
              text: `*Historical Daily Avg:*\n${historicalAverage.toFixed(1)}`
            },
            {
              type: 'mrkdwn',
              text: `*Spike Multiplier:*\n${spikeMultiplier.toFixed(1)}x`
            },
            {
              type: 'mrkdwn',
              text: `*Detected At:*\n${new Date().toLocaleString()}`
            }
          ]
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `⚠️ This user is sending *${spikeMultiplier.toFixed(1)}x* more emails than their ${SPIKE_DETECTION_CONFIG.HISTORICAL_DAYS}-day average. Consider reviewing their activity.`
            }
          ]
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'View in Admin',
                emoji: true
              },
              url: `https://inbound.new/admin`,
              action_id: 'view_admin'
            }
          ]
        }
      ]
    }

    const response = await fetch(SLACK_ADMIN_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage)
    })

    if (!response.ok) {
      console.error(`❌ Slack spike alert failed: ${response.status} ${response.statusText}`)
    } else {
      console.log(`✅ Slack spike alert sent for user: ${userEmail}`)
      markAlertSent(userId)
    }
  } catch (error) {
    console.error('❌ Failed to send Slack spike alert:', error)
  }
}

export interface SpikeDetectionResult {
  isSpike: boolean
  currentCount: number
  historicalAverage: number
  spikeMultiplier: number | null
  alertSent: boolean
  reason?: string
}

/**
 * Check for email sending spike and send alert if detected
 * 
 * This function should be called non-blocking (via waitUntil) after emails are sent.
 * It compares the user's current 24h sending volume against their historical average
 * and sends a Slack alert if a significant spike is detected.
 * 
 * @param userId - The user ID to check
 * @returns SpikeDetectionResult with spike status and metrics
 */
export async function checkSendingSpike(userId: string): Promise<SpikeDetectionResult> {
  try {
    console.log(`📊 Checking sending spike for user ${userId}`)

    // Check cooldown first
    if (isInCooldown(userId)) {
      console.log(`⏳ User ${userId} is in cooldown, skipping spike check`)
      return {
        isSpike: false,
        currentCount: 0,
        historicalAverage: 0,
        spikeMultiplier: null,
        alertSent: false,
        reason: 'User in cooldown period'
      }
    }

    // Get current 24h count
    const currentCount = await getEmailsSentInLastHours(userId, 24)
    
    // Skip if current count is too low to be concerning
    if (currentCount < SPIKE_DETECTION_CONFIG.MIN_CURRENT_EMAILS_FOR_ALERT) {
      return {
        isSpike: false,
        currentCount,
        historicalAverage: 0,
        spikeMultiplier: null,
        alertSent: false,
        reason: `Current count (${currentCount}) below minimum threshold`
      }
    }

    // Get historical average
    const historicalAverage = await getHistoricalDailyAverage(
      userId, 
      SPIKE_DETECTION_CONFIG.HISTORICAL_DAYS
    )

    // If no historical data, can't establish baseline
    if (historicalAverage < SPIKE_DETECTION_CONFIG.MIN_HISTORICAL_EMAILS / SPIKE_DETECTION_CONFIG.HISTORICAL_DAYS) {
      console.log(`📊 User ${userId} has insufficient historical data for spike detection`)
      return {
        isSpike: false,
        currentCount,
        historicalAverage,
        spikeMultiplier: null,
        alertSent: false,
        reason: 'Insufficient historical data'
      }
    }

    // Calculate spike multiplier
    const spikeMultiplier = currentCount / historicalAverage

    // Check if this is a spike
    const isSpike = spikeMultiplier >= SPIKE_DETECTION_CONFIG.SPIKE_THRESHOLD_MULTIPLIER

    console.log(`📊 Spike check for user ${userId}: current=${currentCount}, avg=${historicalAverage.toFixed(1)}, multiplier=${spikeMultiplier.toFixed(1)}x, isSpike=${isSpike}`)

    if (isSpike) {
      // Get user info for the alert
      const userInfo = await getUserInfo(userId)
      
      if (userInfo) {
        await sendSpikeAlert(
          userId,
          userInfo.email,
          userInfo.name,
          currentCount,
          historicalAverage,
          spikeMultiplier
        )

        return {
          isSpike: true,
          currentCount,
          historicalAverage,
          spikeMultiplier,
          alertSent: true
        }
      }
    }

    return {
      isSpike,
      currentCount,
      historicalAverage,
      spikeMultiplier,
      alertSent: false
    }
  } catch (error) {
    console.error(`❌ Error checking sending spike for user ${userId}:`, error)
    // Fail silently - don't block email sending
    return {
      isSpike: false,
      currentCount: 0,
      historicalAverage: 0,
      spikeMultiplier: null,
      alertSent: false,
      reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

