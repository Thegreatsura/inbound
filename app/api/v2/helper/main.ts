"use server"

import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import { eq } from "drizzle-orm";


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