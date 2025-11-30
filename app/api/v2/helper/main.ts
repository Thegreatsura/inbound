"use server"

import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import { sentEmails } from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

// Warmup limits for new accounts (first 7 days)
const NEW_ACCOUNT_WARMUP_DAYS = 7;
const NEW_ACCOUNT_DAILY_LIMIT = 100;


export async function validateRequest(request: NextRequest) {
    try {
        const session = await auth.api.getSession({
            headers: await headers()
        })

        const apiKey = request.headers.get('Authorization')?.replace('Bearer ', '') || ""

        const apiSession = await auth.api.verifyApiKey({
            body: {
                key: apiKey
            }
        })

        // Check if either session or API key provides a valid userId
        let userId: string | undefined;
        
        if (session?.user?.id) {
            userId = session.user.id
        } else if (apiSession?.key?.userId) {
            userId = apiSession.key.userId
        }
        
        if (!userId) {
            return { error: "Unauthorized" }
        }

        // Check if user is banned
        const [userRecord] = await db
            .select({
                banned: user.banned,
                banReason: user.banReason,
                banExpires: user.banExpires
            })
            .from(user)
            .where(eq(user.id, userId))
            .limit(1)

        if (userRecord?.banned) {
            // Check if ban has expired
            if (userRecord.banExpires && new Date(userRecord.banExpires) < new Date()) {
                // Ban has expired, allow through (could also auto-unban here)
                console.log(`🔓 User ${userId} ban has expired, allowing request`)
            } else {
                console.log(`🚫 Blocked banned user ${userId} from API access. Reason: ${userRecord.banReason}`)
                return { 
                    error: "Account suspended", 
                    banReason: userRecord.banReason || "Your account has been suspended. Please contact support."
                }
            }
        }

        return { userId }
    } catch (error) {
        console.error("Error validating request: " + error)
        return { error: "Unauthorized" }
    }
}

/**
 * Check if a new account has exceeded their warmup period daily limits
 * New accounts (< 7 days old) are limited to 100 emails/day
 * 
 * @param userId - The user ID to check
 * @returns Object with allowed status and details
 */
export async function checkNewAccountWarmupLimits(userId: string): Promise<{
    allowed: boolean;
    error?: string;
    isInWarmup: boolean;
    emailsSentToday: number;
    dailyLimit: number;
    daysRemaining?: number;
}> {
    try {
        // Get user's created_at date
        const [userRecord] = await db
            .select({
                createdAt: user.createdAt
            })
            .from(user)
            .where(eq(user.id, userId))
            .limit(1)

        if (!userRecord) {
            return {
                allowed: false,
                error: "User not found",
                isInWarmup: false,
                emailsSentToday: 0,
                dailyLimit: NEW_ACCOUNT_DAILY_LIMIT
            }
        }

        const accountAgeMs = Date.now() - new Date(userRecord.createdAt).getTime()
        const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24)

        // If account is older than warmup period, no limits apply
        if (accountAgeDays >= NEW_ACCOUNT_WARMUP_DAYS) {
            return {
                allowed: true,
                isInWarmup: false,
                emailsSentToday: 0,
                dailyLimit: Infinity
            }
        }

        // Account is in warmup period - check today's email count
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

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

        if (emailsSentToday >= NEW_ACCOUNT_DAILY_LIMIT) {
            console.log(`🚫 New account warmup limit reached: User ${userId} has sent ${emailsSentToday}/${NEW_ACCOUNT_DAILY_LIMIT} emails today (${daysRemaining} days remaining in warmup)`)
            return {
                allowed: false,
                error: `New account limit reached. You can send up to ${NEW_ACCOUNT_DAILY_LIMIT} emails per day during your first ${NEW_ACCOUNT_WARMUP_DAYS} days. Your limit resets at midnight UTC. ${daysRemaining} day(s) remaining in warmup period.`,
                isInWarmup: true,
                emailsSentToday,
                dailyLimit: NEW_ACCOUNT_DAILY_LIMIT,
                daysRemaining
            }
        }

        console.log(`✅ New account warmup check passed: User ${userId} has sent ${emailsSentToday}/${NEW_ACCOUNT_DAILY_LIMIT} emails today (${daysRemaining} days remaining in warmup)`)
        return {
            allowed: true,
            isInWarmup: true,
            emailsSentToday,
            dailyLimit: NEW_ACCOUNT_DAILY_LIMIT,
            daysRemaining
        }

    } catch (error) {
        console.error("Error checking warmup limits:", error)
        // On error, allow the request (fail open) but log it
        return {
            allowed: true,
            isInWarmup: false,
            emailsSentToday: 0,
            dailyLimit: NEW_ACCOUNT_DAILY_LIMIT
        }
    }
}