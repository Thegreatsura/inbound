/**
 * E2 API - Email Addresses Endpoint Tests
 * Tests for the Elysia-powered email addresses API with RFC-compliant error handling
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

// Store IDs for tests
let testEmailAddressId: string | null = null
let createdEmailAddressId: string | null = null
let testDomainId: string | null = null

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

describe("E2 API - Email Addresses", () => {
  // ===================================================================
  // Authentication & Rate Limiting Tests
  // ===================================================================

  describe("Authentication & Rate Limiting", () => {
    it("should return 401 with WWW-Authenticate header when no auth provided", async () => {
      const response = await fetch(`${API_URL}/email-addresses`)

      expect(response.status).toBe(401)
      expect(response.headers.get("WWW-Authenticate")).toBeDefined()
      expect(response.headers.get("WWW-Authenticate")).toContain("Bearer")

      const data = await response.json()
      expect(data.error).toBe("Unauthorized")
      expect(data.message).toContain("Authentication required")
      expect(data.statusCode).toBe(401)
    })

    it("should return 401 with invalid API key", async () => {
      const response = await fetch(`${API_URL}/email-addresses`, {
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
      const response = await apiRequest("/email-addresses")

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
  // List Email Addresses (GET /email-addresses)
  // ===================================================================

  describe("GET /email-addresses - List Email Addresses", () => {
    it("should list email addresses with pagination", async () => {
      const response = await apiRequest("/email-addresses")

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

      // If we have email addresses, verify structure
      if (data.data.length > 0) {
        const emailAddress = data.data[0]
        testEmailAddressId = emailAddress.id // Store for other tests
        testDomainId = emailAddress.domainId // Store domain ID for create tests

        expect(emailAddress.id).toBeDefined()
        expect(emailAddress.address).toBeDefined()
        expect(emailAddress.domainId).toBeDefined()
        expect(typeof emailAddress.isActive).toBe("boolean")
        expect(typeof emailAddress.isReceiptRuleConfigured).toBe("boolean")
        expect(emailAddress.createdAt).toBeDefined()
        expect(emailAddress.updatedAt).toBeDefined()
        expect(emailAddress.userId).toBeDefined()

        // Verify domain object
        expect(emailAddress.domain).toBeDefined()
        expect(emailAddress.domain.id).toBeDefined()
        expect(emailAddress.domain.name).toBeDefined()
        expect(emailAddress.domain.status).toBeDefined()

        // Verify routing object
        expect(emailAddress.routing).toBeDefined()
        expect(["webhook", "endpoint", "none"]).toContain(emailAddress.routing.type)
        expect(typeof emailAddress.routing.isActive).toBe("boolean")

        console.log("✅ Found", data.data.length, "email address(es)")
        console.log("📊 First email address:", {
          id: emailAddress.id,
          address: emailAddress.address,
          domain: emailAddress.domain.name,
          isActive: emailAddress.isActive,
          routingType: emailAddress.routing.type,
        })
      } else {
        console.log("⚠️ No email addresses found in account")
      }
    })

    it("should respect limit parameter", async () => {
      const response = await apiRequest("/email-addresses?limit=2")

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.pagination.limit).toBe(2)
      expect(data.data.length).toBeLessThanOrEqual(2)

      console.log("✅ Limit parameter working:", data.data.length, "≤ 2")
    })

    it("should respect offset parameter", async () => {
      const response1 = await apiRequest("/email-addresses?limit=1&offset=0")
      const response2 = await apiRequest("/email-addresses?limit=1&offset=1")

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)

      const data1 = await response1.json()
      const data2 = await response2.json()

      // If we have enough email addresses, they should be different
      if (data1.data.length > 0 && data2.data.length > 0) {
        expect(data1.data[0].id).not.toBe(data2.data[0].id)
        console.log("✅ Offset parameter working - different email addresses returned")
      }
    })

    it("should filter by domainId parameter", async () => {
      if (!testDomainId) {
        console.log("⚠️ No domain ID available for filtering test")
        return
      }

      const response = await apiRequest(`/email-addresses?domainId=${testDomainId}`)

      expect(response.status).toBe(200)

      const data = await response.json()

      // All returned email addresses should belong to the domain
      data.data.forEach((emailAddress: any) => {
        expect(emailAddress.domainId).toBe(testDomainId)
      })

      console.log("✅ domainId filter working:", data.data.length, "email address(es)")
    })

    it("should filter by isActive parameter", async () => {
      const responseTrue = await apiRequest("/email-addresses?isActive=true")
      const responseFalse = await apiRequest("/email-addresses?isActive=false")

      expect(responseTrue.status).toBe(200)
      expect(responseFalse.status).toBe(200)

      const dataTrue = await responseTrue.json()
      const dataFalse = await responseFalse.json()

      // All returned email addresses should match the filter
      dataTrue.data.forEach((emailAddress: any) => {
        expect(emailAddress.isActive).toBe(true)
      })

      dataFalse.data.forEach((emailAddress: any) => {
        expect(emailAddress.isActive).toBe(false)
      })

      console.log("✅ isActive filter working:", {
        active: dataTrue.data.length,
        inactive: dataFalse.data.length,
      })
    })

    it("should filter by isReceiptRuleConfigured parameter", async () => {
      const responseTrue = await apiRequest("/email-addresses?isReceiptRuleConfigured=true")
      const responseFalse = await apiRequest("/email-addresses?isReceiptRuleConfigured=false")

      expect(responseTrue.status).toBe(200)
      expect(responseFalse.status).toBe(200)

      const dataTrue = await responseTrue.json()
      const dataFalse = await responseFalse.json()

      // All returned email addresses should match the filter
      dataTrue.data.forEach((emailAddress: any) => {
        expect(emailAddress.isReceiptRuleConfigured).toBe(true)
      })

      dataFalse.data.forEach((emailAddress: any) => {
        expect(emailAddress.isReceiptRuleConfigured).toBe(false)
      })

      console.log("✅ isReceiptRuleConfigured filter working:", {
        configured: dataTrue.data.length,
        notConfigured: dataFalse.data.length,
      })
    })

    it("should handle large offset values gracefully", async () => {
      const response = await apiRequest("/email-addresses?offset=9999&limit=10")

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data.data)).toBe(true)

      if (data.pagination.offset >= data.pagination.total) {
        expect(data.data.length).toBe(0)
      }

      console.log("✅ Large offset handled:", data.data.length, "results")
    })

    it("should use default pagination values when none provided", async () => {
      const response = await apiRequest("/email-addresses")
      expect(response.status).toBe(200)

      const data = await response.json()

      // Should use default limit (50) and offset (0)
      expect(data.pagination.limit).toBe(50)
      expect(data.pagination.offset).toBe(0)

      // Should return up to 50 items
      expect(data.data.length).toBeLessThanOrEqual(50)

      console.log("✅ Default pagination values:", {
        limit: data.pagination.limit,
        offset: data.pagination.offset,
        returned: data.data.length,
      })
    })

    it("should handle combined filters correctly", async () => {
      const response = await apiRequest(
        "/email-addresses?limit=5&offset=0&isActive=true&isReceiptRuleConfigured=true"
      )

      expect(response.status).toBe(200)

      const data = await response.json()

      // All email addresses should match ALL filters
      data.data.forEach((emailAddress: any) => {
        expect(emailAddress.isActive).toBe(true)
        expect(emailAddress.isReceiptRuleConfigured).toBe(true)
      })

      console.log("✅ Combined filters working:", data.data.length, "email address(es)")
    })
  })

  // ===================================================================
  // Get Email Address by ID (GET /email-addresses/:id)
  // ===================================================================

  describe("GET /email-addresses/:id - Get Email Address Details", () => {
    it("should return email address details", async () => {
      if (!testEmailAddressId) {
        // Try to get one from the list
        const listResponse = await apiRequest("/email-addresses?limit=1")
        const listData = await listResponse.json()

        if (listData.data.length === 0) {
          console.log("⚠️ No email addresses available for testing GET /email-addresses/:id")
          return
        }

        testEmailAddressId = listData.data[0].id
        testDomainId = listData.data[0].domainId
      }

      const response = await apiRequest(`/email-addresses/${testEmailAddressId}`)

      expect(response.status).toBe(200)

      const data = await response.json()

      expect(data.id).toBe(testEmailAddressId)
      expect(data.address).toBeDefined()
      expect(data.domainId).toBeDefined()
      expect(typeof data.isActive).toBe("boolean")
      expect(typeof data.isReceiptRuleConfigured).toBe("boolean")
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
      expect(data.userId).toBeDefined()

      // Verify domain object
      expect(data.domain).toBeDefined()
      expect(data.domain.id).toBeDefined()
      expect(data.domain.name).toBeDefined()
      expect(data.domain.status).toBeDefined()

      // Verify routing object
      expect(data.routing).toBeDefined()
      expect(["webhook", "endpoint", "none"]).toContain(data.routing.type)
      expect(typeof data.routing.isActive).toBe("boolean")

      console.log("✅ Email address details returned:", {
        id: data.id,
        address: data.address,
        domain: data.domain.name,
        routingType: data.routing.type,
      })
    })

    it("should return 404 for non-existent email address", async () => {
      const response = await apiRequest("/email-addresses/nonexistent-email-address-id-12345")

      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data.error).toBeDefined()

      console.log("✅ 404 returned for non-existent email address")
    })
  })

  // ===================================================================
  // Create Email Address (POST /email-addresses)
  // ===================================================================

  describe("POST /email-addresses - Create Email Address", () => {
    it("should require address field", async () => {
      const response = await apiRequest("/email-addresses", {
        method: "POST",
        body: JSON.stringify({
          domainId: testDomainId || "some-domain-id",
        }),
      })

      expect(response.status).toBe(400)
      console.log("✅ Missing address rejected")
    })

    it("should require domainId field", async () => {
      const response = await apiRequest("/email-addresses", {
        method: "POST",
        body: JSON.stringify({
          address: "test@example.com",
        }),
      })

      expect(response.status).toBe(400)
      console.log("✅ Missing domainId rejected")
    })

    it("should validate email format", async () => {
      const response = await apiRequest("/email-addresses", {
        method: "POST",
        body: JSON.stringify({
          address: "invalid-email-format",
          domainId: testDomainId || "some-domain-id",
        }),
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain("Invalid email")

      console.log("✅ Invalid email format rejected")
    })

    it("should return 404 for non-existent domain", async () => {
      const response = await apiRequest("/email-addresses", {
        method: "POST",
        body: JSON.stringify({
          address: "test@example.com",
          domainId: "nonexistent-domain-id-12345",
        }),
      })

      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data.error).toContain("Domain not found")

      console.log("✅ Non-existent domain rejected")
    })

    it("should validate email domain matches domainId", async () => {
      if (!testDomainId) {
        console.log("⚠️ No domain ID available for domain match test")
        return
      }

      // Get the domain to know its actual domain name
      const domainResponse = await apiRequest(`/domains/${testDomainId}`)
      if (domainResponse.status !== 200) {
        console.log("⚠️ Could not get domain details for match test")
        return
      }

      const domainData = await domainResponse.json()
      const domainName = domainData.domain

      // Try to create email with mismatched domain
      const response = await apiRequest("/email-addresses", {
        method: "POST",
        body: JSON.stringify({
          address: "test@completely-different-domain.com",
          domainId: testDomainId,
        }),
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain(`must belong to domain ${domainName}`)

      console.log("✅ Domain mismatch rejected")
    })

    it("should reject duplicate email addresses", async () => {
      // First get an existing email address
      const listResponse = await apiRequest("/email-addresses?limit=1")
      const listData = await listResponse.json()

      if (listData.data.length === 0) {
        console.log("⚠️ No email addresses available for duplicate test")
        return
      }

      const existingEmailAddress = listData.data[0]

      // Try to create with same address
      const response = await apiRequest("/email-addresses", {
        method: "POST",
        body: JSON.stringify({
          address: existingEmailAddress.address,
          domainId: existingEmailAddress.domainId,
        }),
      })

      expect(response.status).toBe(409)

      const data = await response.json()
      expect(data.error).toContain("already exists")

      console.log("✅ Duplicate email address rejected:", data.error)
    })

    // Note: We don't test actual email address creation in CI as it:
    // 1. Creates AWS SES receipt rules
    // 2. May hit plan limits
    // 3. Would need a valid domain
    // Instead, we test validation and error cases
  })

  // ===================================================================
  // Update Email Address (PUT /email-addresses/:id)
  // ===================================================================

  describe("PUT /email-addresses/:id - Update Email Address", () => {
    it("should update email address isActive status", async () => {
      if (!testEmailAddressId) {
        console.log("⚠️ No email address available for testing PUT /email-addresses/:id")
        return
      }

      // First get current status
      const getResponse = await apiRequest(`/email-addresses/${testEmailAddressId}`)
      const currentData = await getResponse.json()
      const currentIsActive = currentData.isActive

      // Toggle it
      const response = await apiRequest(`/email-addresses/${testEmailAddressId}`, {
        method: "PUT",
        body: JSON.stringify({
          isActive: !currentIsActive,
        }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.isActive).toBe(!currentIsActive)
      expect(data.updatedAt).toBeDefined()

      // Toggle back
      await apiRequest(`/email-addresses/${testEmailAddressId}`, {
        method: "PUT",
        body: JSON.stringify({
          isActive: currentIsActive,
        }),
      })

      console.log("✅ Email address isActive toggled and restored")
    })

    it("should return 404 for non-existent email address", async () => {
      const response = await apiRequest("/email-addresses/nonexistent-email-address-id-12345", {
        method: "PUT",
        body: JSON.stringify({
          isActive: false,
        }),
      })

      expect(response.status).toBe(404)
      console.log("✅ 404 returned for non-existent email address update")
    })

    it("should reject both endpointId and webhookId", async () => {
      if (!testEmailAddressId) {
        console.log("⚠️ No email address available for testing")
        return
      }

      const response = await apiRequest(`/email-addresses/${testEmailAddressId}`, {
        method: "PUT",
        body: JSON.stringify({
          endpointId: "some-endpoint-id",
          webhookId: "some-webhook-id",
        }),
      })

      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toContain("Cannot specify both")

      console.log("✅ Both endpointId and webhookId rejected")
    })

    it("should return 404 for non-existent endpointId", async () => {
      if (!testEmailAddressId) {
        console.log("⚠️ No email address available for testing")
        return
      }

      const response = await apiRequest(`/email-addresses/${testEmailAddressId}`, {
        method: "PUT",
        body: JSON.stringify({
          endpointId: "nonexistent-endpoint-id-12345",
        }),
      })

      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data.error).toContain("Endpoint not found")

      console.log("✅ Non-existent endpointId rejected")
    })

    it("should return 404 for non-existent webhookId", async () => {
      if (!testEmailAddressId) {
        console.log("⚠️ No email address available for testing")
        return
      }

      const response = await apiRequest(`/email-addresses/${testEmailAddressId}`, {
        method: "PUT",
        body: JSON.stringify({
          webhookId: "nonexistent-webhook-id-12345",
        }),
      })

      expect(response.status).toBe(404)

      const data = await response.json()
      expect(data.error).toContain("Webhook not found")

      console.log("✅ Non-existent webhookId rejected")
    })
  })

  // ===================================================================
  // Delete Email Address (DELETE /email-addresses/:id)
  // ===================================================================

  describe("DELETE /email-addresses/:id - Delete Email Address", () => {
    it("should return 404 for non-existent email address", async () => {
      const response = await apiRequest("/email-addresses/nonexistent-email-address-id-12345", {
        method: "DELETE",
      })

      expect(response.status).toBe(404)
      console.log("✅ 404 returned for non-existent email address deletion")
    })

    // Note: We don't test actual deletion in CI as it:
    // 1. Removes real email addresses
    // 2. Updates SES receipt rules
    // 3. Is destructive and irreversible
    // Instead, test would be done in a controlled environment with test email addresses
  })

  // ===================================================================
  // RFC Compliance & Error Handling
  // ===================================================================

  describe("RFC Compliance & Error Handling", () => {
    it("should return proper Content-Type headers", async () => {
      const response = await apiRequest("/email-addresses")

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toContain("application/json")
    })

    it("should return consistent error format", async () => {
      const response = await fetch(`${API_URL}/email-addresses`)

      const data = await response.json()
      expect(data).toHaveProperty("error")
      expect(data).toHaveProperty("message")
      expect(data).toHaveProperty("statusCode")
      expect(data.statusCode).toBe(401)

      console.log("✅ Error format consistent")
    })

    it("should handle OPTIONS request (CORS preflight)", async () => {
      const response = await fetch(`${API_URL}/email-addresses`, {
        method: "OPTIONS",
      })

      // Should not error
      expect(response.status).toBeLessThan(500)
      console.log("✅ OPTIONS request handled:", response.status)
    })
  })

  // ===================================================================
  // Type Safety & Data Integrity
  // ===================================================================

  describe("Type Safety & Data Integrity", () => {
    it("should return dates in ISO 8601 format", async () => {
      const response = await apiRequest("/email-addresses?limit=1")
      expect(response.status).toBe(200)

      const data = await response.json()

      if (data.data.length > 0) {
        const emailAddress = data.data[0]

        // createdAt should be a valid date string
        expect(new Date(emailAddress.createdAt).toISOString()).toBe(emailAddress.createdAt)

        // updatedAt should be a valid date string
        expect(new Date(emailAddress.updatedAt).toISOString()).toBe(emailAddress.updatedAt)

        console.log("✅ Date format correct:", {
          createdAt: emailAddress.createdAt,
          updatedAt: emailAddress.updatedAt,
        })
      }
    })

    it("should use null for nullable optional fields", async () => {
      const response = await apiRequest("/email-addresses")
      expect(response.status).toBe(200)

      const data = await response.json()

      if (data.data.length > 0) {
        const emailAddress = data.data[0]

        // webhookId uses t.Nullable - should be string or null
        if (!emailAddress.webhookId) {
          expect(emailAddress.webhookId).toBeNull()
        }

        // endpointId uses t.Nullable - should be string or null
        if (!emailAddress.endpointId) {
          expect(emailAddress.endpointId).toBeNull()
        }

        // receiptRuleName uses t.Nullable - should be string or null
        if (!emailAddress.receiptRuleName) {
          expect(emailAddress.receiptRuleName).toBeNull()
        }

        console.log("✅ Nullable fields handled correctly")
      }
    })

    it("should maintain type safety for boolean fields", async () => {
      const response = await apiRequest("/email-addresses")
      expect(response.status).toBe(200)

      const data = await response.json()

      if (data.data.length > 0) {
        const emailAddress = data.data[0]

        expect(typeof emailAddress.isActive).toBe("boolean")
        expect(typeof emailAddress.isReceiptRuleConfigured).toBe("boolean")
        expect(typeof emailAddress.routing.isActive).toBe("boolean")

        console.log("✅ Boolean types preserved")
      }
    })

    it("should maintain type safety for number fields", async () => {
      const response = await apiRequest("/email-addresses")
      expect(response.status).toBe(200)

      const data = await response.json()

      // Pagination numbers
      expect(typeof data.pagination.limit).toBe("number")
      expect(typeof data.pagination.offset).toBe("number")
      expect(typeof data.pagination.total).toBe("number")

      console.log("✅ Number types preserved")
    })
  })

  // ===================================================================
  // Performance & Edge Cases
  // ===================================================================

  describe("Performance & Edge Cases", () => {
    it("should respond within reasonable time (< 2 seconds)", async () => {
      const start = Date.now()
      const response = await apiRequest("/email-addresses")
      const duration = Date.now() - start

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(2000)

      console.log(`✅ Response time: ${duration}ms`)
    })

    it("should handle concurrent requests correctly", async () => {
      const requests = Array(5)
        .fill(null)
        .map(() => apiRequest("/email-addresses?limit=10"))

      const responses = await Promise.all(requests)

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200)
      })

      console.log("✅ Handled 5 concurrent requests successfully")
    })

    it("should maintain pagination consistency across concurrent requests", async () => {
      // Make multiple requests at the same time
      const requests = [
        apiRequest("/email-addresses?limit=10&offset=0"),
        apiRequest("/email-addresses?limit=10&offset=10"),
        apiRequest("/email-addresses?limit=10&offset=20"),
      ]

      const responses = await Promise.all(requests)
      const allData = await Promise.all(responses.map((r) => r.json()))

      // All should succeed
      responses.forEach((r) => expect(r.status).toBe(200))

      // Total should be consistent across all requests
      const totals = allData.map((d) => d.pagination.total)
      expect(new Set(totals).size).toBe(1) // All totals should be the same

      // No duplicate IDs across pages
      const allIds = new Set()
      let duplicatesFound = false

      allData.forEach((page) => {
        page.data.forEach((emailAddress: any) => {
          if (allIds.has(emailAddress.id)) {
            duplicatesFound = true
          }
          allIds.add(emailAddress.id)
        })
      })

      expect(duplicatesFound).toBe(false)

      console.log("✅ Concurrent pagination consistent:", {
        total: totals[0],
        uniqueIds: allIds.size,
        noDuplicates: !duplicatesFound,
      })
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

    it("should document the email-addresses endpoints", async () => {
      const response = await fetch(`${API_URL}/openapi.json`)
      const spec = await response.json()

      expect(spec.paths).toBeDefined()
      expect(spec.paths["/api/e2/email-addresses"]).toBeDefined()
      expect(spec.paths["/api/e2/email-addresses"].get).toBeDefined()
      expect(spec.paths["/api/e2/email-addresses"].post).toBeDefined()

      const emailAddressesGet = spec.paths["/api/e2/email-addresses"].get
      expect(emailAddressesGet.tags).toContain("Email Addresses")
      expect(emailAddressesGet.summary).toBeDefined()

      console.log("✅ Email addresses endpoints documented:", emailAddressesGet.summary)
    })

    it("should document email address path parameter routes", async () => {
      const response = await fetch(`${API_URL}/openapi.json`)
      const spec = await response.json()

      // Check for routes with :id parameter
      const idRoute = spec.paths["/api/e2/email-addresses/{id}"]
      expect(idRoute).toBeDefined()
      expect(idRoute.get).toBeDefined()
      expect(idRoute.put).toBeDefined()
      expect(idRoute.delete).toBeDefined()

      console.log("✅ Email address ID routes documented:", {
        get: !!idRoute.get,
        put: !!idRoute.put,
        delete: !!idRoute.delete,
      })
    })
  })

  // ===================================================================
  // Cleanup
  // ===================================================================

  afterAll(async () => {
    // Clean up any created test email addresses
    if (createdEmailAddressId) {
      console.log("🧹 Cleaning up test email address:", createdEmailAddressId)
      await apiRequest(`/email-addresses/${createdEmailAddressId}`, {
        method: "DELETE",
      })
    }
  })
})

// ===================================================================
// Summary
// ===================================================================

console.log("\n" + "=".repeat(60))
console.log("E2 API - Email Addresses Tests")
console.log("=".repeat(60))
console.log("✅ Test suite ready")
console.log("📚 Coverage:")
console.log("  - Authentication & Rate Limiting")
console.log("  - List Email Addresses with Pagination & Filtering")
console.log("  - Get Email Address by ID")
console.log("  - Create Email Address (validation)")
console.log("  - Update Email Address")
console.log("  - Delete Email Address")
console.log("  - RFC Compliance & Error Handling")
console.log("  - Type Safety & Data Integrity")
console.log("  - Performance & Edge Cases")
console.log("  - OpenAPI Documentation")
console.log("=".repeat(60) + "\n")

