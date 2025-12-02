import { Realtime, type InferRealtimeEvents } from "@upstash/realtime"
import { redis } from "./redis"
import { z } from "zod/v4"

/**
 * Realtime event schema for the application
 * 
 * Schema structure:
 * - First level: namespace (e.g., "inbox")
 * - Second level: event name with its zod schema
 * 
 * Events are emitted via: realtime.emit("inbox.emailReceived", data)
 * Events are subscribed via: events: ["inbox.emailReceived"], onData: (event) => {...}
 */
const schema = {
  inbox: {
    // Event fired when an email is received at a demo inbox address
    emailReceived: z.object({
      from: z.string(),
      subject: z.string(),
      preview: z.string(),
      timestamp: z.string(),
      emailId: z.string().optional(),
    }),
  },
}

/**
 * Realtime instance for server-side event emission
 */
export const realtime = new Realtime({ schema, redis })

/**
 * Type-safe event types inferred from the schema
 */
export type RealtimeEvents = InferRealtimeEvents<typeof realtime>

