"use client"

import { RealtimeProvider as UpstashRealtimeProvider } from "@upstash/realtime/client"

interface RealtimeProviderProps {
  children: React.ReactNode
}

/**
 * Provider for Upstash Realtime
 * Wraps the application to enable real-time event subscriptions
 */
export function RealtimeProvider({ children }: RealtimeProviderProps) {
  return <UpstashRealtimeProvider>{children}</UpstashRealtimeProvider>
}

