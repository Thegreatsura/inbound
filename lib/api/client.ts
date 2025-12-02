import { treaty } from "@elysiajs/eden"
import type { App } from "@/app/api/e2/[[...slugs]]/route"

/**
 * Get the base URL for API requests.
 * - Server-side: Uses BETTER_AUTH_URL or defaults to localhost
 * - Client-side: Uses current window origin
 */
const getBaseUrl = () => {
  if (typeof window === "undefined") {
    // Server-side
    return process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000"
  }
  // Client-side - use current origin
  return process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000"
}

/**
 * Eden treaty client for type-safe API calls to the Elysia e2 API.
 * 
 * Usage:
 * ```typescript
 * import { client } from "@/lib/api/client"
 * 
 * // Type-safe domain creation
 * const { data, error } = await client.api.e2.domains.post({ domain: "example.com" })
 * ```
 */
export const client = treaty<App>(getBaseUrl(), {
  fetch: {
    credentials: "include",
  },
})
