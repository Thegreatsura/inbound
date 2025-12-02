"use server"

/**
 * User Warmup Status Server Action
 * 
 * Checks if a user is in the new account warmup period (first 7 days)
 * and returns their daily sending limits.
 */

const isDev = process.env.NODE_ENV === "development";

import { getCurrentSession } from "@/lib/auth/auth-utils"
import { db } from "@/lib/db"
import { user, sentEmails } from "@/lib/db/schema"
import { eq, and, gte, sql } from "drizzle-orm"

// Warmup limits for new accounts (first 7 days)
const NEW_ACCOUNT_WARMUP_DAYS = 7
const NEW_ACCOUNT_DAILY_LIMIT = 100

export interface WarmupStatus {
  isInWarmup: boolean
  emailsSentToday: number
  dailyLimit: number
  daysRemaining: number
  accountAgeDays: number
}

export interface WarmupStatusResult {
  success: boolean
  status?: WarmupStatus
  error?: string
}

/**
 * Get warmup status for the current user
 */
export async function getUserWarmupStatus(): Promise<WarmupStatusResult> {
  try {
    // Get current session
    const session = await getCurrentSession()
    if (!session?.user?.id) {
      return { success: false, error: "Not authenticated" }
    }

    const userId = session.user.id

    // Get user's created_at date
    const [userRecord] = await db
      .select({
        createdAt: user.createdAt
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    if (!userRecord) {
      return { success: false, error: "User not found" }
    }

    if (isDev) {
      return {
        success: true,
        status: {
          daysRemaining: 0,
          accountAgeDays: 0,
          isInWarmup: true,
          emailsSentToday: 0,
          dailyLimit: NEW_ACCOUNT_DAILY_LIMIT,
        }
      }
    }

    const accountAgeMs = Date.now() - new Date(userRecord.createdAt).getTime()
    const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24)

    // If account is older than warmup period, no limits apply
    if (accountAgeDays >= NEW_ACCOUNT_WARMUP_DAYS) {
      return {
        success: true,
        status: {
          isInWarmup: false,
          emailsSentToday: 0,
          dailyLimit: Infinity,
          daysRemaining: 0,
          accountAgeDays: Math.floor(accountAgeDays)
        }
      }
    }

    // Account is in warmup period - check today's email count (UTC)
    const todayStart = new Date()
    todayStart.setUTCHours(0, 0, 0, 0)

    const [emailCount] = await db
      .select({
        count: sql<number>`count(*)::int`
      })
      .from(sentEmails)
      .where(
        and(
          eq(sentEmails.userId, userId),
          gte(sentEmails.createdAt, todayStart)
        )
      )

    const emailsSentToday = emailCount?.count || 0
    const daysRemaining = Math.ceil(NEW_ACCOUNT_WARMUP_DAYS - accountAgeDays)

    return {
      success: true,
      status: {
        isInWarmup: true,
        emailsSentToday,
        dailyLimit: NEW_ACCOUNT_DAILY_LIMIT,
        daysRemaining,
        accountAgeDays: Math.floor(accountAgeDays)
      }
    }

  } catch (error) {
    console.error("Error fetching warmup status:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to fetch warmup status" 
    }
  }
}

