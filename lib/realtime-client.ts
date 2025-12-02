"use client"

import { createRealtime } from "@upstash/realtime/client"
import type { RealtimeEvents } from "./realtime"

/**
 * Typed realtime hook for client components
 * Created via createRealtime for full type safety
 */
export const { useRealtime } = createRealtime<RealtimeEvents>()

