/**
 * E2 API - Endpoints Endpoint Tests
 * Tests for the Elysia-powered endpoints API with RFC-compliant error handling
 */

// @ts-ignore - bun:test is a Bun-specific module not recognized by TypeScript
import { describe, it, expect, afterAll } from "bun:test"
import dotenv from "dotenv"

dotenv.config()

const API_URL = "https://dev.inbound.new/api/e2"
const API_KEY = process.env.INBOUND_API_KEY

if (!API_KEY) {
  console.error("❌ INBOUND_API_KEY not found in environment variables")
  process.exit(1)
}

// Store endpoint IDs for tests
let testEndpointId: string | null = null
let createdEndpointId: string | null = null

// Rate limit handling configuration
const RATE_LIMIT_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 150, // Base delay between requests to stay under 10 req/s
  retryDelayMs: 1000, // Delay when rate limited
}

// Track last request time to self-throttle
let lastRequestTime = 0

/**
 * Helper function to make authenticated requests with rate limit handling
 * - Self-throttles to stay under rate limit
 * - Retries on 429 responses with exponential backoff
 */
async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
  retryCount = 0
): Promise<Response> {
  // Self-throttle: ensure minimum delay between requests
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime
  if (timeSinceLastRequest < RATE_LIMIT_CONFIG.baseDelayMs) {
    await sleep(RATE_LIMIT_CONFIG.baseDelayMs - timeSinceLastRequest)
  }
  lastRequestTime = Date.now()

  const url = `${API_URL}${endpoint}`
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    ...options.headers,
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  // Handle rate limiting with retry
  if (response.status === 429 && retryCount < RATE_LIMIT_CONFIG.maxRetries) {
    const retryAfter = response.headers.get("Retry-After")
    const delayMs = retryAfter
      ? parseInt(retryAfter, 10) * 1000
      : RATE_LIMIT_CONFIG.retryDelayMs * Math.pow(2, retryCount) // Exponential backoff

    console.log(
      `⏳ Rate limited, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${RATE_LIMIT_CONFIG.maxRetries})`
    )
    await sleep(delayMs)
    return apiRequest(endpoint, options, retryCount + 1)
  }

  return response
}

/**
 * Sleep helper for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe("E2 API - Endpoints", () => {
  // ===================================================================
  // Authentication & Rate Limiting Tests
  // ===================================================================

  describe("Authentication & Rate Limiting", () => {
    it("should return 401 with WWW-Authenticate header when no auth provided", async () => {
      const response = await fetch(`${API_URL}/endpoints`)

      expect(response.status).toBe(401)
      expect(response.headers.get("WWW-Authenticate")).toBeDefined()
      expect(response.headers.get("WWW-Authenticate")).toContain("Bearer")

      const data = await response.json()
      expect(data.error).toBe("Unauthorized")
      expect(data.message).toContain("Authentication required")
      expect(data.statusCode).toBe(401)
    })

    it("should return 401 with invalid API key", async () => {
      const response = await fetch(`${API_URL}/endpoints`, {
        headers: {
          Authorization: "Bearer invalid_key_12345",
        },
      })

      expect(response.status).toBe(401)
      expect(response.headers.get("WWW-Authenticate")).toBeDefined()

      const data = await response.json()
      expect(data.error).toBe("Unauthorized")
      expect(data.statusCode).toBe(401)
    })

    it("should include rate limit headers on successful requests", async () => {
      const response = await apiRequest("/endpoints")

      expect(response.status).toBe(200)
      expect(response.headers.get("X-RateLimit-Limit")).toBeDefined()
      expect(response.headers.get("X-RateLimit-Remaining")).toBeDefined()
      expect(response.headers.get("X-RateLimit-Reset")).toBeDefined()

      const limit = response.headers.get("X-RateLimit-Limit")
      const remaining = response.headers.get("X-RateLimit-Remaining")

      expect(Number(limit)).toBeGreaterThan(0)
      expect(Number(remaining)).toBeLessThanOrEqual(Number(limit))

      console.log("✅ Rate limit headers:", {
        limit,
        remaining,
        reset: response.headers.get("X-RateLimit-Reset"),
      })
    })
  })

  // ===================================================================
  // List Endpoints (GET /endpoints)
  // ===================================================================

  describe("GET /endpoints - List Endpoints", () => {
    it("should list endpoints with pagination", async () => {
      const response = await apiRequest("/endpoints")

      expect(response.status).toBe(200)

      const data = await response.json()

      // Verify response structure
      expect(data.data).toBeDefined()
      expect(Array.isArray(data.data)).toBe(true)
      expect(data.pagination).toBeDefined()
      expect(data.pagination.limit).toBeDefined()
      expect(data.pagination.offset).toBeDefined()
      expect(data.pagination.total).toBeDefined()
      expect(data.pagination.hasMore).toBeDefined()

      // If we have endpoints, verify structure
      if (data.data.length > 0) {
        const endpoint = data.data[0]
        testEndpointId = endpoint.id // Store for other tests

        expect(endpoint.id).toBeDefined()
        expect(endpoint.name).toBeDefined()
        expect(endpoint.type).toBeDefined()
        expect(["webhook", "email", "email_group"]).toContain(endpoint.type)
        expect(typeof endpoint.isActive).toBe("boolean")
        expect(endpoint.config).toBeDefined()
        expect(endpoint.createdAt).toBeDefined()
        expect(endpoint.updatedAt).toBeDefined()
        expect(endpoint.userId).toBeDefined()

        // Verify deliveryStats object
        expect(endpoint.deliveryStats).toBeDefined()
        expect(typeof endpoint.deliveryStats.total).toBe("number")
        expect(typeof endpoint.deliveryStats.successful).toBe("number")
        expect(typeof endpoint.deliveryStats.failed).toBe("number")

        console.log("✅ Found", data.data.length, "endpoint(s)")
        console.log("📊 First endpoint:", {
          id: endpoint.id,
          name: endpoint.name,
          type: endpoint.type,
          isActive: endpoint.isActive,
        })
      } else {
        console.log("⚠️ No endpoints found in account")
      }
    })

    it("should respect limit parameter", async () => {
      const response = await apiRequest("/endpoints?limit=2")

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.pagination.limit).toBe(2)
      expect(data.data.length).toBeLessThanOrEqual(2)

      console.log("✅ Limit parameter working:", data.data.length, "≤ 2")
    })

    it("should respect offset parameter", async () => {
      const response1 = await apiRequest("/endpoints?limit=1&offset=0")
      const response2 = await apiRequest("/endpoints?limit=1&offset=1")

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)

      const data1 = await response1.json()
      const data2 = await response2.json()

      // If we have enough endpoints, they should be different
      if (data1.data.length > 0 && data2.data.length > 0) {
        expect(data1.data[0].id).not.toBe(data2.data[0].id)
        console.log("✅ Offset parameter working - different endpoints returned")
      }
    })

    it("should filter by type parameter", async () => {
      const validTypes = ["webhook", "email", "email_group"]

      for (const type of validTypes) {
        const response = await apiRequest(`/endpoints?type=${type}`)
        expect(response.status).toBe(200)

        const data = await response.json()

        // All returned endpoints should match the filter
        data.data.forEach((endpoint: any) => {
          expect(endpoint.type).toBe(type)
        })

        console.log(`✅ Type filter '${type}' working:`, data.data.length, "endpoint(s)")
      }
    })

    it("should filter by active parameter", async () => {
      const responseTrue = await apiRequest("/endpoints?active=true")
      const responseFalse = await apiRequest("/endpoints?active=false")

      expect(responseTrue.status).toBe(200)
      expect(responseFalse.status).toBe(200)

      const dataTrue = await responseTrue.json()
      const dataFalse = await responseFalse.json()

      // All returned endpoints should match the filter
      dataTrue.data.forEach((endpoint: any) => {
        expect(endpoint.isActive).toBe(true)
      })

      dataFalse.data.forEach((endpoint: any) => {
        expect(endpoint.isActive).toBe(false)
      })

      console.log("✅ Active filter working:", {
        active: dataTrue.data.length,
        inactive: dataFalse.data.length,
      })
    })

    it("should sort by sortBy parameter", async () => {
      const responseNewest = await apiRequest("/endpoints?sortBy=newest&limit=10")
      const responseOldest = await apiRequest("/endpoints?sortBy=oldest&limit=10")

      expect(responseNewest.status).toBe(200)
      expect(responseOldest.status).toBe(200)

      const dataNewest = await responseNewest.json()
      const dataOldest = await responseOldest.json()

      // Verify sorting (if we have enough data)
      if (dataNewest.data.length > 1) {
        const newestDates = dataNewest.data.map((e: any) => new Date(e.createdAt).getTime())
        for (let i = 0; i < newestDates.length - 1; i++) {
          expect(newestDates[i]).toBeGreaterThanOrEqual(newestDates[i + 1])
        }
        console.log("✅ sortBy=newest working")
      }

      if (dataOldest.data.length > 1) {
        const oldestDates = dataOldest.data.map((e: any) => new Date(e.createdAt).getTime())
        for (let i = 0; i < oldestDates.length - 1; i++) {
          expect(oldestDates[i]).toBeLessThanOrEqual(oldestDates[i + 1])
        }
        console.log("✅ sortBy=oldest working")
      }
    })

    it("should include groupEmails for email_group endpoints", async () => {
      const response = await apiRequest("/endpoints?type=email_group&limit=10")

      expect(response.status).toBe(200)

      const data = await response.json()

      data.data.forEach((endpoint: any) => {
        if (endpoint.type === "email_group") {
          expect(endpoint.groupEmails).toBeDefined()
          expect(Array.isArray(endpoint.groupEmails)).toBe(true)
        }
      })

      if (data.data.length > 0) {
        console.log("✅ groupEmails included for email_group endpoints")
      }
    })

    it("should handle large offset values gracefully", async () => {
      const response = await apiRequest("/endpoints?offset=9999&limit=10")

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data.data)).toBe(true)
      
      if (data.pagination.offset >= data.pagination.total) {
        expect(data.data.length).toBe(0)
      }

      console.log("✅ Large offset handled:", data.data.length, "results")
    })
  })

  // ===================================================================
  // Create Endpoint (POST /endpoints)
  // ===================================================================

  describe("POST /endpoints - Create Endpoint", () => {
    it("should create a webhook endpoint", async () => {
      const response = await apiRequest("/endpoints", {
        method: "POST",
        body: JSON.stringify({
          name: `Test Webhook ${Date.now()}`,
          type: "webhook",
          config: {
            url: "https://httpbin.org/post",
            timeout: 30,
            retryAttempts: 3,
          },
          description: "Test webhook endpoint for E2 API tests",
        }),
      })

      if (response.status === 201) {
        const data = await response.json()
        
        expect(data.id).toBeDefined()
        expect(data.name).toContain("Test Webhook")
        expect(data.type).toBe("webhook")
        expect(data.isActive).toBe(true)
        expect(data.config).toBeDefined()
        expect(data.config.url).toBe("https://httpbin.org/post")
        expect(data.createdAt).toBeDefined()
        expect(data.updatedAt).toBeDefined()
        expect(data.deliveryStats).toBeDefined()
        expect(data.deliveryStats.total).toBe(0)

        createdEndpointId = data.id
        console.log("✅ Created webhook endpoint:", data.id)
      } else {
        // Could be 403 (plan limit) or other
        const data = await response.json()
        console.log("⚠️ Could not create endpoint:", response.status, data.error)
      }
    })

    it("should require name field", async () => {
      const response = await apiRequest("/endpoints", {
        method: "POST",
        body: JSON.stringify({
          type: "webhook",
          config: {
            url: "https://httpbin.org/post",
          },
        }),
      })

      expect(response.status).toBe(400)
      console.log("✅ Missing name rejected")
    })

    it("should require type field", async () => {
      const response = await apiRequest("/endpoints", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Endpoint",
          config: {
            url: "https://httpbin.org/post",
          },
        }),
      })

      expect(response.status).toBe(400)
      console.log("✅ Missing type rejected")
    })

    it("should validate webhook URL format", async () => {
      const response = await apiRequest("/endpoints", {
        method: "POST",
        body: JSON.stringify({
          name: "Invalid URL Webhook",
          type: "webhook",
          config: {
            url: "not-a-valid-url",
          },
        }),
      })

      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.error).toContain("Invalid")
      console.log("✅ Invalid webhook URL rejected")
    })

    it("should validate email config for email type", async () => {
      const response = await apiRequest("/endpoints", {
        method: "POST",
        body: JSON.stringify({
          name: "Invalid Email Endpoint",
          type: "email",
          config: {
            // Missing forwardTo
          },
        }),
      })

      expect(response.status).toBe(400)
      console.log("✅ Missing forwardTo rejected for email type")
    })

    it("should validate email_group config", async () => {
      const response = await apiRequest("/endpoints", {
        method: "POST",
        body: JSON.stringify({
          name: "Invalid Email Group",
          type: "email_group",
          config: {
            emails: [], // Empty array
          },
        }),
      })

      expect(response.status).toBe(400)
      console.log("✅ Empty emails array rejected for email_group")
    })

    it("should reject duplicate emails in email_group", async () => {
      const response = await apiRequest("/endpoints", {
        method: "POST",
        body: JSON.stringify({
          name: "Duplicate Email Group",
          type: "email_group",
          config: {
            emails: ["test@example.com", "test@example.com"],
          },
        }),
      })

      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.details).toContain("duplicate")
      console.log("✅ Duplicate emails rejected for email_group")
    })
  })

  // ===================================================================
  // Get Endpoint by ID (GET /endpoints/:id)
  // ===================================================================

  describe("GET /endpoints/:id - Get Endpoint Details", () => {
    it("should return endpoint details", async () => {
      // Use created endpoint or find one
      const endpointId = createdEndpointId || testEndpointId
      
      if (!endpointId) {
        console.log("⚠️ No endpoint available for testing GET /endpoints/:id")
        return
      }

      const response = await apiRequest(`/endpoints/${endpointId}`)

      expect(response.status).toBe(200)

      const data = await response.json()

      expect(data.id).toBe(endpointId)
      expect(data.name).toBeDefined()
      expect(data.type).toBeDefined()
      expect(data.config).toBeDefined()
      expect(typeof data.isActive).toBe("boolean")
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
      expect(data.userId).toBeDefined()

      // Verify detailed response includes additional data
      expect(data.deliveryStats).toBeDefined()
      expect(data.recentDeliveries).toBeDefined()
      expect(Array.isArray(data.recentDeliveries)).toBe(true)
      expect(data.associatedEmails).toBeDefined()
      expect(Array.isArray(data.associatedEmails)).toBe(true)
      expect(data.catchAllDomains).toBeDefined()
      expect(Array.isArray(data.catchAllDomains)).toBe(true)

      console.log("✅ Endpoint details returned:", {
        id: data.id,
        name: data.name,
        type: data.type,
        recentDeliveries: data.recentDeliveries.length,
        associatedEmails: data.associatedEmails.length,
        catchAllDomains: data.catchAllDomains.length,
      })
    })

    it("should return 404 for non-existent endpoint", async () => {
      const response = await apiRequest("/endpoints/nonexistent-endpoint-id-12345")

      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data.error).toBeDefined()

      console.log("✅ 404 returned for non-existent endpoint")
    })
  })

  // ===================================================================
  // Update Endpoint (PUT /endpoints/:id)
  // ===================================================================

  describe("PUT /endpoints/:id - Update Endpoint", () => {
    it("should update endpoint name", async () => {
      const endpointId = createdEndpointId || testEndpointId

      if (!endpointId) {
        console.log("⚠️ No endpoint available for testing PUT /endpoints/:id")
        return
      }

      const newName = `Updated Endpoint ${Date.now()}`
      const response = await apiRequest(`/endpoints/${endpointId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: newName,
        }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.id).toBe(endpointId)
      expect(data.name).toBe(newName)
      expect(data.updatedAt).toBeDefined()

      console.log("✅ Endpoint name updated:", data.name)
    })

    it("should update endpoint description", async () => {
      const endpointId = createdEndpointId || testEndpointId

      if (!endpointId) {
        console.log("⚠️ No endpoint available for testing")
        return
      }

      const newDescription = `Updated description at ${new Date().toISOString()}`
      const response = await apiRequest(`/endpoints/${endpointId}`, {
        method: "PUT",
        body: JSON.stringify({
          description: newDescription,
        }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.description).toBe(newDescription)

      console.log("✅ Endpoint description updated")
    })

    it("should update endpoint isActive status", async () => {
      const endpointId = createdEndpointId || testEndpointId

      if (!endpointId) {
        console.log("⚠️ No endpoint available for testing")
        return
      }

      // First get current status
      const getResponse = await apiRequest(`/endpoints/${endpointId}`)
      const currentData = await getResponse.json()
      const currentIsActive = currentData.isActive

      // Toggle it
      const response = await apiRequest(`/endpoints/${endpointId}`, {
        method: "PUT",
        body: JSON.stringify({
          isActive: !currentIsActive,
        }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.isActive).toBe(!currentIsActive)

      // Toggle back
      await apiRequest(`/endpoints/${endpointId}`, {
        method: "PUT",
        body: JSON.stringify({
          isActive: currentIsActive,
        }),
      })

      console.log("✅ Endpoint isActive toggled and restored")
    })

    it("should return 404 for non-existent endpoint", async () => {
      const response = await apiRequest("/endpoints/nonexistent-endpoint-id-12345", {
        method: "PUT",
        body: JSON.stringify({
          name: "Test",
        }),
      })

      expect(response.status).toBe(404)
      console.log("✅ 404 returned for non-existent endpoint update")
    })

    it("should validate config when updating", async () => {
      const endpointId = createdEndpointId

      if (!endpointId) {
        console.log("⚠️ No webhook endpoint available for testing config validation")
        return
      }

      const response = await apiRequest(`/endpoints/${endpointId}`, {
        method: "PUT",
        body: JSON.stringify({
          config: {
            url: "not-a-valid-url",
          },
        }),
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain("Invalid")

      console.log("✅ Invalid config rejected during update")
    })
  })

  // ===================================================================
  // Test Endpoint (POST /endpoints/:id/test)
  // ===================================================================

  describe("POST /endpoints/:id/test - Test Endpoint", () => {
    it("should test a webhook endpoint with inbound format", async () => {
      const endpointId = createdEndpointId

      if (!endpointId) {
        console.log("⚠️ No webhook endpoint available for testing")
        return
      }

      // Use a faster endpoint for testing - httpbin can be slow
      // First update the endpoint to use a faster URL
      await apiRequest(`/endpoints/${endpointId}`, {
        method: "PUT",
        body: JSON.stringify({
          config: {
            url: "https://httpbin.org/status/200",
            timeout: 10,
            retryAttempts: 0,
          },
        }),
      })

      const response = await apiRequest(`/endpoints/${endpointId}/test`, {
        method: "POST",
        body: JSON.stringify({
          webhookFormat: "inbound",
        }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(typeof data.success).toBe("boolean")
      expect(data.message).toBeDefined()
      expect(typeof data.responseTime).toBe("number")
      expect(data.webhookFormat).toBe("inbound")

      console.log("✅ Webhook test completed:", {
        success: data.success,
        responseTime: data.responseTime,
        statusCode: data.statusCode,
      })
    })

    it("should test webhook with different formats", async () => {
      const endpointId = createdEndpointId

      if (!endpointId) {
        console.log("⚠️ No webhook endpoint available for testing")
        return
      }

      const formats = ["discord", "slack"]

      for (const format of formats) {
        const response = await apiRequest(`/endpoints/${endpointId}/test`, {
          method: "POST",
          body: JSON.stringify({
            webhookFormat: format,
          }),
        })

        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.webhookFormat).toBe(format)

        console.log(`✅ Webhook test with ${format} format completed`)
      }
    })

    it("should support override URL for testing", async () => {
      const endpointId = createdEndpointId

      if (!endpointId) {
        console.log("⚠️ No webhook endpoint available for testing")
        return
      }

      // Use discord format for faster payload
      const response = await apiRequest(`/endpoints/${endpointId}/test`, {
        method: "POST",
        body: JSON.stringify({
          webhookFormat: "discord",
          overrideUrl: "https://httpbin.org/status/200",
        }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.urlTested).toBe("https://httpbin.org/status/200")

      console.log("✅ Override URL test completed:", data.urlTested)
    })

    it("should return 404 for non-existent endpoint", async () => {
      const response = await apiRequest("/endpoints/nonexistent-endpoint-id-12345/test", {
        method: "POST",
        body: JSON.stringify({
          webhookFormat: "inbound",
        }),
      })

      expect(response.status).toBe(404)
      console.log("✅ 404 returned for non-existent endpoint test")
    })

    it("should reject invalid webhook format", async () => {
      const endpointId = createdEndpointId || testEndpointId

      if (!endpointId) {
        console.log("⚠️ No endpoint available for testing")
        return
      }

      const response = await apiRequest(`/endpoints/${endpointId}/test`, {
        method: "POST",
        body: JSON.stringify({
          webhookFormat: "invalid_format",
        }),
      })

      // Elysia validates webhookFormat at the schema level (TypeBox Union)
      // so it returns a 400 validation error before reaching our handler
      expect(response.status).toBe(400)

      const data = await response.json()
      // Elysia's validation error format
      expect(data.error).toBe("Bad Request")
      expect(data.message).toContain("Validation")

      console.log("✅ Invalid webhook format rejected by schema validation")
    })

    it("should reject test for disabled endpoint", async () => {
      const endpointId = createdEndpointId

      if (!endpointId) {
        console.log("⚠️ No endpoint available for testing")
        return
      }

      // First disable the endpoint and verify it worked
      const disableResponse = await apiRequest(`/endpoints/${endpointId}`, {
        method: "PUT",
        body: JSON.stringify({
          isActive: false,
        }),
      })

      expect(disableResponse.status).toBe(200)
      const disabledData = await disableResponse.json()
      expect(disabledData.isActive).toBe(false)

      // Try to test the disabled endpoint
      const response = await apiRequest(`/endpoints/${endpointId}/test`, {
        method: "POST",
        body: JSON.stringify({}), // Empty body is valid - webhookFormat is optional
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.message).toContain("disabled")

      // Re-enable the endpoint for cleanup
      const enableResponse = await apiRequest(`/endpoints/${endpointId}`, {
        method: "PUT",
        body: JSON.stringify({
          isActive: true,
        }),
      })
      expect(enableResponse.status).toBe(200)

      console.log("✅ Disabled endpoint test rejected")
    })
  })

  // ===================================================================
  // RFC Compliance & Error Handling
  // ===================================================================

  describe("RFC Compliance & Error Handling", () => {
    it("should return proper Content-Type headers", async () => {
      const response = await apiRequest("/endpoints")

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toContain("application/json")
    })

    it("should return consistent error format", async () => {
      const response = await fetch(`${API_URL}/endpoints`)

      const data = await response.json()
      expect(data).toHaveProperty("error")
      expect(data).toHaveProperty("message")
      expect(data).toHaveProperty("statusCode")
      expect(data.statusCode).toBe(401)

      console.log("✅ Error format consistent")
    })
  })

  // ===================================================================
  // Type Safety & Data Integrity
  // ===================================================================

  describe("Type Safety & Data Integrity", () => {
    it("should return dates in ISO 8601 format", async () => {
      const response = await apiRequest("/endpoints?limit=1")
      expect(response.status).toBe(200)

      const data = await response.json()

      if (data.data.length > 0) {
        const endpoint = data.data[0]

        // createdAt should be a valid date string
        expect(new Date(endpoint.createdAt).toISOString()).toBe(endpoint.createdAt)

        // updatedAt should be a valid date string
        expect(new Date(endpoint.updatedAt).toISOString()).toBe(endpoint.updatedAt)

        console.log("✅ Date format correct:", {
          createdAt: endpoint.createdAt,
          updatedAt: endpoint.updatedAt,
        })
      }
    })

    it("should maintain type safety for boolean fields", async () => {
      const response = await apiRequest("/endpoints")
      expect(response.status).toBe(200)

      const data = await response.json()

      if (data.data.length > 0) {
        const endpoint = data.data[0]

        expect(typeof endpoint.isActive).toBe("boolean")

        console.log("✅ Boolean types preserved")
      }
    })

    it("should maintain type safety for number fields", async () => {
      const response = await apiRequest("/endpoints")
      expect(response.status).toBe(200)

      const data = await response.json()

      // Pagination numbers
      expect(typeof data.pagination.limit).toBe("number")
      expect(typeof data.pagination.offset).toBe("number")
      expect(typeof data.pagination.total).toBe("number")

      if (data.data.length > 0) {
        const endpoint = data.data[0]

        expect(typeof endpoint.deliveryStats.total).toBe("number")
        expect(typeof endpoint.deliveryStats.successful).toBe("number")
        expect(typeof endpoint.deliveryStats.failed).toBe("number")

        console.log("✅ Number types preserved")
      }
    })
  })

  // ===================================================================
  // Performance & Edge Cases
  // ===================================================================

  describe("Performance & Edge Cases", () => {
    it("should respond within reasonable time (< 2 seconds)", async () => {
      const start = Date.now()
      const response = await apiRequest("/endpoints")
      const duration = Date.now() - start

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(2000)

      console.log(`✅ Response time: ${duration}ms`)
    })

    it("should handle concurrent requests correctly", async () => {
      const requests = Array(5)
        .fill(null)
        .map(() => apiRequest("/endpoints?limit=10"))

      const responses = await Promise.all(requests)

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200)
      })

      console.log("✅ Handled 5 concurrent requests successfully")
    })

    it("should handle combined filters correctly", async () => {
      const response = await apiRequest(
        "/endpoints?limit=5&offset=0&type=webhook&active=true&sortBy=newest"
      )

      expect(response.status).toBe(200)

      const data = await response.json()

      // All endpoints should match ALL filters
      data.data.forEach((endpoint: any) => {
        expect(endpoint.type).toBe("webhook")
        expect(endpoint.isActive).toBe(true)
      })

      console.log("✅ Combined filters working:", data.data.length, "endpoint(s)")
    })
  })

  // ===================================================================
  // Delete Endpoint (DELETE /endpoints/:id)
  // ===================================================================

  describe("DELETE /endpoints/:id - Delete Endpoint", () => {
    it("should return 404 for non-existent endpoint", async () => {
      const response = await apiRequest("/endpoints/nonexistent-endpoint-id-12345", {
        method: "DELETE",
      })

      expect(response.status).toBe(404)
      console.log("✅ 404 returned for non-existent endpoint deletion")
    })

    it("should delete the test endpoint and clean up", async () => {
      if (!createdEndpointId) {
        console.log("⚠️ No test endpoint to delete")
        return
      }

      const response = await apiRequest(`/endpoints/${createdEndpointId}`, {
        method: "DELETE",
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.message).toContain("deleted")
      expect(data.cleanup).toBeDefined()
      expect(typeof data.cleanup.emailAddressesUpdated).toBe("number")
      expect(typeof data.cleanup.domainsUpdated).toBe("number")
      expect(typeof data.cleanup.groupEmailsDeleted).toBe("number")
      expect(typeof data.cleanup.deliveriesDeleted).toBe("number")

      console.log("✅ Test endpoint deleted:", {
        message: data.message,
        cleanup: data.cleanup,
      })

      createdEndpointId = null
    })
  })

  // ===================================================================
  // OpenAPI Documentation
  // ===================================================================

  describe("OpenAPI Documentation", () => {
    it("should have OpenAPI spec available", async () => {
      const response = await fetch(`${API_URL}/openapi.json`)

      expect(response.status).toBe(200)

      const spec = await response.json()
      expect(spec.openapi).toBeDefined()
      expect(spec.info).toBeDefined()

      console.log("✅ OpenAPI spec available:", spec.info.version)
    })

    it("should document the endpoints routes", async () => {
      const response = await fetch(`${API_URL}/openapi.json`)
      const spec = await response.json()

      expect(spec.paths).toBeDefined()
      expect(spec.paths["/api/e2/endpoints"]).toBeDefined()
      expect(spec.paths["/api/e2/endpoints"].get).toBeDefined()
      expect(spec.paths["/api/e2/endpoints"].post).toBeDefined()

      const endpointsGet = spec.paths["/api/e2/endpoints"].get
      expect(endpointsGet.tags).toContain("Endpoints")
      expect(endpointsGet.summary).toBeDefined()

      console.log("✅ Endpoints routes documented")
    })
  })

  // ===================================================================
  // Cleanup
  // ===================================================================

  afterAll(async () => {
    // Clean up any remaining test endpoints
    if (createdEndpointId) {
      console.log("🧹 Cleaning up test endpoint:", createdEndpointId)
      await apiRequest(`/endpoints/${createdEndpointId}`, {
        method: "DELETE",
      })
    }
  })
})

// ===================================================================
// Summary
// ===================================================================

console.log("\n" + "=".repeat(60))
console.log("E2 API - Endpoints Tests")
console.log("=".repeat(60))
console.log("✅ Test suite ready")
console.log("📚 Coverage:")
console.log("  - Authentication & Rate Limiting")
console.log("  - List Endpoints with Pagination & Filtering")
console.log("  - Create Endpoint (webhook, email, email_group)")
console.log("  - Get Endpoint by ID")
console.log("  - Update Endpoint")
console.log("  - Test Endpoint (webhook formats)")
console.log("  - Delete Endpoint with Cleanup")
console.log("  - RFC Compliance & Error Handling")
console.log("  - Type Safety & Data Integrity")
console.log("  - Performance & Edge Cases")
console.log("  - OpenAPI Documentation")
console.log("=".repeat(60) + "\n")
