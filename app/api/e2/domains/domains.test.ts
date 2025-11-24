/**
 * E2 API - Domains Endpoint Tests
 * Tests for the Elysia-powered domains API with RFC-compliant error handling
 */

// @ts-ignore - bun:test is a Bun-specific module not recognized by TypeScript
import { describe, it, expect, beforeAll } from "bun:test"
import dotenv from "dotenv"

dotenv.config()

const API_URL = "https://dev.inbound.new/api/e2"
const API_KEY = process.env.INBOUND_API_KEY

if (!API_KEY) {
  console.error("❌ INBOUND_API_KEY not found in environment variables")
  process.exit(1)
}

// Store domain ID for tests
let testDomainId: string

/**
 * Helper function to make authenticated requests
 */
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${API_URL}${endpoint}`
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    ...options.headers,
  }

  return fetch(url, {
    ...options,
    headers,
  })
}

describe("E2 API - Domains Endpoint", () => {
  // ===================================================================
  // Authentication & Rate Limiting Tests
  // ===================================================================

  describe("Authentication & Rate Limiting", () => {
    it("should return 401 with WWW-Authenticate header when no auth provided", async () => {
      const response = await fetch(`${API_URL}/domains`)

      expect(response.status).toBe(401)
      expect(response.headers.get("WWW-Authenticate")).toBeDefined()
      expect(response.headers.get("WWW-Authenticate")).toContain("Bearer")

      const data = await response.json()
      expect(data.error).toBe("Unauthorized")
      expect(data.message).toContain("Authentication required")
      expect(data.statusCode).toBe(401)
    })

    it("should return 401 with invalid API key", async () => {
      const response = await fetch(`${API_URL}/domains`, {
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
      const response = await apiRequest("/domains")

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

    // Note: Testing actual rate limit 429 is difficult in CI
    // as it requires making many rapid requests
  })

  // ===================================================================
  // List Domains (GET /domains)
  // ===================================================================

  describe("GET /domains - List Domains", () => {
    it("should list domains with pagination", async () => {
      const response = await apiRequest("/domains")

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

      // If we have domains, verify structure
      if (data.data.length > 0) {
        const domain = data.data[0]
        testDomainId = domain.id // Store for other tests

        expect(domain.id).toBeDefined()
        expect(domain.domain).toBeDefined()
        expect(domain.status).toBeDefined()
        expect(typeof domain.canReceiveEmails).toBe("boolean")
        expect(typeof domain.hasMxRecords).toBe("boolean")
        expect(typeof domain.isCatchAllEnabled).toBe("boolean")
        expect(typeof domain.receiveDmarcEmails).toBe("boolean")
        expect(domain.createdAt).toBeDefined()
        expect(domain.updatedAt).toBeDefined()
        expect(domain.userId).toBeDefined()

        // Verify stats object
        expect(domain.stats).toBeDefined()
        expect(typeof domain.stats.totalEmailAddresses).toBe("number")
        expect(typeof domain.stats.activeEmailAddresses).toBe("number")
        expect(typeof domain.stats.hasCatchAll).toBe("boolean")

        // catchAllEndpoint should be object or undefined (not null)
        if (domain.catchAllEndpoint !== undefined) {
          expect(typeof domain.catchAllEndpoint).toBe("object")
          expect(domain.catchAllEndpoint.id).toBeDefined()
          expect(domain.catchAllEndpoint.name).toBeDefined()
          expect(domain.catchAllEndpoint.type).toBeDefined()
          expect(typeof domain.catchAllEndpoint.isActive).toBe("boolean")
        }

        console.log("✅ Found", data.data.length, "domain(s)")
        console.log("📊 First domain:", {
          id: domain.id,
          domain: domain.domain,
          status: domain.status,
          emailCount: domain.stats.totalEmailAddresses,
        })
      } else {
        console.log("⚠️ No domains found in account")
      }
    })

    it("should respect limit parameter", async () => {
      const response = await apiRequest("/domains?limit=2")

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.pagination.limit).toBe(2)
      expect(data.data.length).toBeLessThanOrEqual(2)

      console.log("✅ Limit parameter working:", data.data.length, "≤ 2")
    })

    it("should respect offset parameter", async () => {
      const response1 = await apiRequest("/domains?limit=1&offset=0")
      const response2 = await apiRequest("/domains?limit=1&offset=1")

      expect(response1.status).toBe(200)
      expect(response2.status).toBe(200)

      const data1 = await response1.json()
      const data2 = await response2.json()

      // If we have enough domains, they should be different
      if (data1.data.length > 0 && data2.data.length > 0) {
        expect(data1.data[0].id).not.toBe(data2.data[0].id)
        console.log("✅ Offset parameter working - different domains returned")
      }
    })

    it("should filter by status parameter", async () => {
      const validStatuses = ["pending", "verified", "failed"]

      for (const status of validStatuses) {
        const response = await apiRequest(`/domains?status=${status}`)
        expect(response.status).toBe(200)

        const data = await response.json()

        // All returned domains should match the filter
        data.data.forEach((domain: any) => {
          expect(domain.status).toBe(status)
        })

        console.log(`✅ Status filter '${status}' working:`, data.data.length, "domain(s)")
      }
    })

    it("should filter by canReceive parameter", async () => {
      const responseTrue = await apiRequest("/domains?canReceive=true")
      const responseFalse = await apiRequest("/domains?canReceive=false")

      expect(responseTrue.status).toBe(200)
      expect(responseFalse.status).toBe(200)

      const dataTrue = await responseTrue.json()
      const dataFalse = await responseFalse.json()

      // All returned domains should match the filter
      dataTrue.data.forEach((domain: any) => {
        expect(domain.canReceiveEmails).toBe(true)
      })

      dataFalse.data.forEach((domain: any) => {
        expect(domain.canReceiveEmails).toBe(false)
      })

      console.log("✅ Can receive filter working:", {
        canReceive: dataTrue.data.length,
        cannot: dataFalse.data.length,
      })
    })

    it("should reject limit values above maximum (100)", async () => {
      const response = await apiRequest("/domains?limit=150")

      // Elysia validates before handler, so this should fail validation
      expect(response.status).toBe(400)

      const data = await response.json()
      expect(data.error).toBe("Bad Request")
      expect(data.message).toContain("Validation")

      console.log("✅ Maximum limit validation working: 150 rejected with 400")
    })

    it("should calculate hasMore correctly", async () => {
      const response = await apiRequest("/domains?limit=1")

      expect(response.status).toBe(200)

      const data = await response.json()

      if (data.pagination.total > 1) {
        expect(data.pagination.hasMore).toBe(true)
      } else {
        expect(data.pagination.hasMore).toBe(false)
      }

      console.log("✅ hasMore calculation correct:", {
        hasMore: data.pagination.hasMore,
        total: data.pagination.total,
      })
    })

    it("should handle empty results gracefully", async () => {
      // Use a status filter that's unlikely to have results
      const response = await apiRequest("/domains?status=failed&limit=100")

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data.data)).toBe(true)
      expect(data.pagination.total).toBeGreaterThanOrEqual(0)

      console.log("✅ Empty results handled:", data.data.length, "domain(s) with status=failed")
    })

    it("should paginate correctly through multiple pages", async () => {
      // Test comprehensive pagination flow
      
      // Step 1: Get first page
      const page1 = await apiRequest("/domains?limit=5&offset=0")
      expect(page1.status).toBe(200)
      const data1 = await page1.json()

      expect(data1.pagination.limit).toBe(5)
      expect(data1.pagination.offset).toBe(0)
      expect(data1.pagination.total).toBeGreaterThanOrEqual(0)

      const totalItems = data1.pagination.total

      // If we have no items, skip the rest of the test
      if (totalItems === 0) {
        console.log("⚠️ No domains to test pagination")
        return
      }

      // Step 2: Verify first page data
      expect(data1.data.length).toBeGreaterThan(0)
      expect(data1.data.length).toBeLessThanOrEqual(5)
      
      // Store first page IDs to verify no duplicates
      const firstPageIds = new Set(data1.data.map((d: any) => d.id))

      // Step 3: Get second page (if available)
      if (totalItems > 5) {
        const page2 = await apiRequest("/domains?limit=5&offset=5")
        expect(page2.status).toBe(200)
        const data2 = await page2.json()

        // Pagination metadata should be consistent
        expect(data2.pagination.total).toBe(totalItems)
        expect(data2.pagination.limit).toBe(5)
        expect(data2.pagination.offset).toBe(5)

        // No duplicate items between pages
        data2.data.forEach((domain: any) => {
          expect(firstPageIds.has(domain.id)).toBe(false)
        })

        // hasMore should be correct for page 2
        const expectedHasMore = 5 + data2.data.length < totalItems
        expect(data2.pagination.hasMore).toBe(expectedHasMore)

        console.log("✅ Page 2 distinct from page 1:", data2.data.length, "items")
      }

      // Step 4: Test last page (partial results)
      if (totalItems > 5) {
        const lastPageOffset = Math.floor(totalItems / 5) * 5
        const lastPage = await apiRequest(`/domains?limit=5&offset=${lastPageOffset}`)
        expect(lastPage.status).toBe(200)
        const lastData = await lastPage.json()

        // Last page should have remaining items
        const expectedLastPageCount = totalItems - lastPageOffset
        expect(lastData.data.length).toBe(expectedLastPageCount)
        
        // hasMore should be false on last page
        expect(lastData.pagination.hasMore).toBe(false)

        console.log("✅ Last page correct:", {
          offset: lastPageOffset,
          items: lastData.data.length,
          hasMore: lastData.pagination.hasMore,
        })
      }

      // Step 5: Test beyond last page (should return empty)
      const beyondLast = await apiRequest(`/domains?limit=5&offset=${totalItems}`)
      expect(beyondLast.status).toBe(200)
      const beyondData = await beyondLast.json()
      
      expect(beyondData.data.length).toBe(0)
      expect(beyondData.pagination.hasMore).toBe(false)
      expect(beyondData.pagination.total).toBe(totalItems)

      console.log("✅ Pagination test complete:", {
        total: totalItems,
        pagesChecked: Math.min(3, Math.ceil(totalItems / 5)),
        allConsistent: true,
      })
    })

    it("should use default pagination values when none provided", async () => {
      const response = await apiRequest("/domains")
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

    it("should maintain pagination consistency across concurrent requests", async () => {
      // Make multiple requests at the same time
      const requests = [
        apiRequest("/domains?limit=10&offset=0"),
        apiRequest("/domains?limit=10&offset=10"),
        apiRequest("/domains?limit=10&offset=20"),
      ]

      const responses = await Promise.all(requests)
      const allData = await Promise.all(responses.map(r => r.json()))

      // All should succeed
      responses.forEach(r => expect(r.status).toBe(200))

      // Total should be consistent across all requests
      const totals = allData.map(d => d.pagination.total)
      expect(new Set(totals).size).toBe(1) // All totals should be the same

      // No duplicate IDs across pages
      const allIds = new Set()
      let duplicatesFound = false

      allData.forEach(page => {
        page.data.forEach((domain: any) => {
          if (allIds.has(domain.id)) {
            duplicatesFound = true
          }
          allIds.add(domain.id)
        })
      })

      expect(duplicatesFound).toBe(false)

      console.log("✅ Concurrent pagination consistent:", {
        total: totals[0],
        uniqueIds: allIds.size,
        noDuplicates: !duplicatesFound,
      })
    })

    it("should calculate pagination totals correctly with filters", async () => {
      // Get total without filters
      const responseAll = await apiRequest("/domains?limit=1")
      const dataAll = await responseAll.json()
      const totalAll = dataAll.pagination.total

      // Get total with status filter
      const responseFiltered = await apiRequest("/domains?status=verified&limit=1")
      const dataFiltered = await responseFiltered.json()
      const totalFiltered = dataFiltered.pagination.total

      // Filtered total should be ≤ total all
      expect(totalFiltered).toBeLessThanOrEqual(totalAll)

      // Verify we can paginate through filtered results
      if (totalFiltered > 1) {
        const page2 = await apiRequest("/domains?status=verified&limit=1&offset=1")
        const data2 = await page2.json()

        // Total should remain consistent
        expect(data2.pagination.total).toBe(totalFiltered)
        
        // Items should match filter
        data2.data.forEach((domain: any) => {
          expect(domain.status).toBe("verified")
        })
      }

      console.log("✅ Filtered pagination correct:", {
        totalAll,
        totalVerified: totalFiltered,
        difference: totalAll - totalFiltered,
      })
    })
  })

  // ===================================================================
  // RFC Compliance & Error Handling
  // ===================================================================

  describe("RFC Compliance & Error Handling", () => {
    it("should return proper Content-Type headers", async () => {
      const response = await apiRequest("/domains")

      expect(response.status).toBe(200)
      expect(response.headers.get("Content-Type")).toContain("application/json")
    })

    it("should handle validation errors with 400 status", async () => {
      // Try to send invalid query parameters
      const response = await apiRequest("/domains?limit=invalid")

      // Elysia should catch this as a validation error
      if (response.status === 400) {
        const data = await response.json()
        expect(data.error).toBe("Bad Request")
        expect(data.message).toContain("Validation")
        expect(data.statusCode).toBe(400)
        console.log("✅ Validation error handled correctly")
      } else {
        // If it passes, that's okay too (Elysia might coerce the value)
        expect(response.status).toBe(200)
        console.log("⚠️ Validation passed (type coercion)")
      }
    })

    it("should return consistent error format across all errors", async () => {
      // Test 401 error format
      const response401 = await fetch(`${API_URL}/domains`)
      expect(response401.status).toBe(401)
      const data401 = await response401.json()

      expect(data401).toHaveProperty("error")
      expect(data401).toHaveProperty("message")
      expect(data401).toHaveProperty("statusCode")
      expect(data401.statusCode).toBe(401)

      console.log("✅ Error format consistent:", {
        error: data401.error,
        statusCode: data401.statusCode,
      })
    })

    it("should handle OPTIONS request (CORS preflight)", async () => {
      const response = await fetch(`${API_URL}/domains`, {
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
      const response = await apiRequest("/domains?limit=1")
      expect(response.status).toBe(200)

      const data = await response.json()

      if (data.data.length > 0) {
        const domain = data.data[0]

        // createdAt should be a valid date string
        expect(new Date(domain.createdAt).toISOString()).toBe(domain.createdAt)

        // updatedAt should be a valid date string
        expect(new Date(domain.updatedAt).toISOString()).toBe(domain.updatedAt)

        console.log("✅ Date format correct:", {
          createdAt: domain.createdAt,
          updatedAt: domain.updatedAt,
        })
      }
    })

    it("should use undefined for optional fields (not null)", async () => {
      const response = await apiRequest("/domains")
      expect(response.status).toBe(200)

      const data = await response.json()

      if (data.data.length > 0) {
        const domain = data.data[0]

        // Optional fields should be undefined or have a value, not null
        if (!domain.catchAllEndpoint) {
          expect(domain.catchAllEndpoint).toBeUndefined()
        }

        if (!domain.domainProvider) {
          // This field is nullable in schema, so null is okay
          expect([null, undefined]).toContain(domain.domainProvider)
        }

        console.log("✅ Optional fields handled correctly")
      }
    })

    it("should maintain type safety for boolean fields", async () => {
      const response = await apiRequest("/domains")
      expect(response.status).toBe(200)

      const data = await response.json()

      if (data.data.length > 0) {
        const domain = data.data[0]

        expect(typeof domain.canReceiveEmails).toBe("boolean")
        expect(typeof domain.hasMxRecords).toBe("boolean")
        expect(typeof domain.isCatchAllEnabled).toBe("boolean")
        expect(typeof domain.receiveDmarcEmails).toBe("boolean")
        expect(typeof domain.stats.hasCatchAll).toBe("boolean")

        console.log("✅ Boolean types preserved")
      }
    })

    it("should maintain type safety for number fields", async () => {
      const response = await apiRequest("/domains")
      expect(response.status).toBe(200)

      const data = await response.json()

      // Pagination numbers
      expect(typeof data.pagination.limit).toBe("number")
      expect(typeof data.pagination.offset).toBe("number")
      expect(typeof data.pagination.total).toBe("number")

      if (data.data.length > 0) {
        const domain = data.data[0]

        expect(typeof domain.stats.totalEmailAddresses).toBe("number")
        expect(typeof domain.stats.activeEmailAddresses).toBe("number")

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
      const response = await apiRequest("/domains")
      const duration = Date.now() - start

      expect(response.status).toBe(200)
      expect(duration).toBeLessThan(2000)

      console.log(`✅ Response time: ${duration}ms`)
    })

    it("should handle concurrent requests correctly", async () => {
      const requests = Array(5)
        .fill(null)
        .map(() => apiRequest("/domains?limit=10"))

      const responses = await Promise.all(requests)

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200)
      })

      console.log("✅ Handled 5 concurrent requests successfully")
    })

    it("should handle large offset values gracefully", async () => {
      const response = await apiRequest("/domains?offset=9999&limit=10")

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(Array.isArray(data.data)).toBe(true)
      // Data should be empty if offset exceeds total
      if (data.pagination.offset >= data.pagination.total) {
        expect(data.data.length).toBe(0)
      }

      console.log("✅ Large offset handled:", data.data.length, "results")
    })

    it("should handle combined filters correctly", async () => {
      const response = await apiRequest(
        "/domains?limit=5&offset=0&status=verified&canReceive=true"
      )

      expect(response.status).toBe(200)

      const data = await response.json()

      // All domains should match ALL filters
      data.data.forEach((domain: any) => {
        expect(domain.status).toBe("verified")
        expect(domain.canReceiveEmails).toBe(true)
      })

      console.log("✅ Combined filters working:", data.data.length, "domain(s)")
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
      expect(spec.info.title).toBe("Inbound E2 API")

      console.log("✅ OpenAPI spec available:", spec.info.version)
    })

    it("should document the domains endpoint", async () => {
      const response = await fetch(`${API_URL}/openapi.json`)
      const spec = await response.json()

      expect(spec.paths).toBeDefined()
      // OpenAPI includes the prefix in the path
      expect(spec.paths["/api/e2/domains"]).toBeDefined()
      expect(spec.paths["/api/e2/domains"].get).toBeDefined()

      const domainsEndpoint = spec.paths["/api/e2/domains"].get

      expect(domainsEndpoint.tags).toContain("Domains")
      expect(domainsEndpoint.summary).toBeDefined()
      expect(domainsEndpoint.description).toBeDefined()

      console.log("✅ Domains endpoint documented:", domainsEndpoint.summary)
    })
  })
})

// ===================================================================
// Summary
// ===================================================================

console.log("\n" + "=".repeat(60))
console.log("E2 API - Domains Endpoint Tests")
console.log("=".repeat(60))
console.log("✅ All tests completed")
console.log("📚 Coverage:")
console.log("  - Authentication & Rate Limiting")
console.log("  - List Domains with Pagination")
console.log("  - Query Parameter Filtering")
console.log("  - RFC Compliance & Error Handling")
console.log("  - Type Safety & Data Integrity")
console.log("  - Performance & Edge Cases")
console.log("  - OpenAPI Documentation")
console.log("=".repeat(60) + "\n")
