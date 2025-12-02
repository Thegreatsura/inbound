import { handle } from "@upstash/realtime"
import { realtime } from "@/lib/realtime"

/**
 * Realtime SSE endpoint
 * Handles client connections for real-time event streaming
 */
export const GET = handle({ realtime })

