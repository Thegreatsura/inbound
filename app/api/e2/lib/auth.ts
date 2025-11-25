import { auth } from "@/lib/auth/auth"
import { headers } from "next/headers"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Initialize Upstash Redis client for rate limiting
// Only initialize if env vars are present
let redis: Redis | null = null
let ratelimit: Ratelimit | null = null

if (
  process.env.UPSTASH_REDIS_REST_URL &&
  process.env.UPSTASH_REDIS_REST_TOKEN
) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })

  // Rate limiter: 10 requests per second per account
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "1 s"),
    analytics: true,
    prefix: "e2:ratelimit",
  })
} else {
  console.warn(
    "⚠️ Upstash Redis not configured. Rate limiting will be disabled."
  )
}

/**
 * RFC-compliant error response structure
 * Follows RFC 7807: Problem Details for HTTP APIs
 */
export interface RFCErrorResponse {
  error: string
  message: string
  statusCode: number
}

/**
 * Custom error class for authentication failures with RFC-compliant headers
 */
export class AuthError extends Error {
  constructor(
    public readonly response: RFCErrorResponse,
    public readonly headers: Record<string, string>
  ) {
    super(response.message)
    this.name = "AuthError"
  }
}

/**
 * Validates authentication (session or API key) and checks rate limits
 * Throws AuthError with RFC-compliant headers on failure
 *
 * RFC Compliance:
 * - RFC 7235: WWW-Authenticate header for 401 responses
 * - RFC 6585: Retry-After header for 429 responses
 * - RFC 7231: Standard HTTP status codes
 * - RFC 7807: Problem Details for HTTP APIs (error format)
 *
 * @param request - Standard Request object (from Elysia context)
 * @param set - Elysia's set object for setting response status and headers
 * @returns userId on success
 * @throws AuthError with appropriate status code and RFC-compliant headers on failure
 */
export async function validateAndRateLimit(
  request: Request,
  set: {
    status?: number | string
    headers?: Record<string, string> | any
  }
): Promise<string> {
  try {
    console.log("🔐 Validating request authentication and rate limit")

    // Get session from Better Auth using Next.js headers()
    // This works because we're still in a Next.js route handler context
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    // Get API key from Authorization header
    const apiKey =
      request.headers.get("Authorization")?.replace("Bearer ", "") || ""

    // Verify API key if provided
    const apiSession = apiKey
      ? await auth.api.verifyApiKey({
          body: {
            key: apiKey,
          },
        })
      : null

    // Determine userId from either session or API key
    let userId: string

    if (session?.user?.id) {
      userId = session.user.id
      console.log("✅ Session authentication successful for userId:", userId)
    } else if (apiSession?.valid && !apiSession?.error && apiSession?.key?.userId) {
      userId = apiSession.key.userId
      console.log("✅ API key authentication successful for userId:", userId)
    } else {
      console.log("❌ Authentication failed: No valid session or API key")
      // RFC 7235: 401 responses MUST include WWW-Authenticate header
      set.status = 401
      set.headers = {
        "WWW-Authenticate": 'Bearer realm="API", charset="UTF-8"',
        "Content-Type": "application/json; charset=utf-8",
      }
      throw new AuthError(
        {
          error: "Unauthorized",
          message: "Authentication required. Provide a valid session cookie or Bearer token.",
          statusCode: 401,
        },
        set.headers
      )
    }

    // Check rate limit for this userId (if configured)
    if (ratelimit) {
      const {
        success: rateLimitSuccess,
        limit,
        remaining,
        reset,
      } = await ratelimit.limit(userId)

      console.log("📊 Rate limit check:", {
        success: rateLimitSuccess,
        limit,
        remaining,
        reset: new Date(reset).toISOString(),
      })

      // Set rate limit headers on all requests (RFC 6585 recommendation)
      set.headers = {
        ...set.headers,
        "X-RateLimit-Limit": limit.toString(),
        "X-RateLimit-Remaining": remaining.toString(),
        "X-RateLimit-Reset": reset.toString(),
      }

      if (!rateLimitSuccess) {
        console.log("⚠️ Rate limit exceeded for userId:", userId)
        // RFC 6585: 429 responses SHOULD include Retry-After header
        const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000)
        set.status = 429
        set.headers = {
          ...set.headers,
          "Retry-After": retryAfterSeconds.toString(),
          "Content-Type": "application/json; charset=utf-8",
        }
        throw new AuthError(
          {
            error: "Too Many Requests",
            message: `Rate limit exceeded. Maximum ${limit} requests per second. Retry after ${retryAfterSeconds} seconds.`,
            statusCode: 429,
          },
          set.headers
        )
      }
    } else {
      console.log("⚠️ Rate limiting disabled (Upstash not configured)")
    }

    return userId
  } catch (error) {
    console.error("❌ Error validating request:", error)
    // Re-throw AuthError as-is (already has proper headers)
    if (error instanceof AuthError) {
      throw error
    }
    // For unexpected errors, set unauthorized status with proper headers
    set.status = 401
    set.headers = {
      "WWW-Authenticate": 'Bearer realm="API", charset="UTF-8"',
      "Content-Type": "application/json; charset=utf-8",
    }
    throw new AuthError(
      {
        error: "Unauthorized",
        message: "An error occurred during authentication.",
        statusCode: 401,
      },
      set.headers
    )
  }
}
