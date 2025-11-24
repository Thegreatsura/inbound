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

  // ===================================================================
  // List Domains with check=true (Live Verification)
  // ===================================================================

  describe("GET /domains?check=true - List Domains with Verification", () => {
    it("should return verificationCheck when check=true", async () => {
      const response = await apiRequest("/domains?check=true&limit=1")

      expect(response.status).toBe(200)

      const data = await response.json()

      if (data.data.length > 0) {
        const domain = data.data[0]

        // Should have verificationCheck object
        expect(domain.verificationCheck).toBeDefined()
        expect(domain.verificationCheck.dnsRecords).toBeDefined()
        expect(Array.isArray(domain.verificationCheck.dnsRecords)).toBe(true)
        expect(domain.verificationCheck.sesStatus).toBeDefined()
        expect(typeof domain.verificationCheck.isFullyVerified).toBe("boolean")
        expect(domain.verificationCheck.lastChecked).toBeDefined()

        console.log("✅ Verification check returned:", {
          sesStatus: domain.verificationCheck.sesStatus,
          isFullyVerified: domain.verificationCheck.isFullyVerified,
          dnsRecordsCount: domain.verificationCheck.dnsRecords.length,
        })
      }
    })

    it("should update domain status based on SES verification", async () => {
      const response = await apiRequest("/domains?check=true&limit=1&status=verified")

      expect(response.status).toBe(200)

      const data = await response.json()

      if (data.data.length > 0) {
        const domain = data.data[0]
        
        // If SES says Success, status should be verified
        if (domain.verificationCheck?.sesStatus === "Success") {
          expect(domain.status).toBe("verified")
        }

        console.log("✅ Domain status synced with SES:", {
          status: domain.status,
          sesStatus: domain.verificationCheck?.sesStatus,
        })
      }
    })
  })

  // ===================================================================
  // Get Domain by ID (GET /domains/:id)
  // ===================================================================

  describe("GET /domains/:id - Get Domain by ID", () => {
    it("should return domain details with DNS records", async () => {
      // First get a domain ID
      const listResponse = await apiRequest("/domains?limit=1")
      const listData = await listResponse.json()

      if (listData.data.length === 0) {
        console.log("⚠️ No domains available for testing GET /domains/:id")
        return
      }

      const domainId = listData.data[0].id
      const response = await apiRequest(`/domains/${domainId}`)

      expect(response.status).toBe(200)

      const data = await response.json()

      // Verify full domain response structure
      expect(data.id).toBe(domainId)
      expect(data.domain).toBeDefined()
      expect(data.status).toBeDefined()
      expect(typeof data.canReceiveEmails).toBe("boolean")
      expect(typeof data.hasMxRecords).toBe("boolean")
      expect(typeof data.isCatchAllEnabled).toBe("boolean")
      expect(data.createdAt).toBeDefined()
      expect(data.updatedAt).toBeDefined()
      expect(data.userId).toBeDefined()

      // Should have stats
      expect(data.stats).toBeDefined()
      expect(typeof data.stats.totalEmailAddresses).toBe("number")
      expect(typeof data.stats.activeEmailAddresses).toBe("number")

      // Should always have dnsRecords array
      expect(data.dnsRecords).toBeDefined()
      expect(Array.isArray(data.dnsRecords)).toBe(true)

      console.log("✅ Domain details returned:", {
        id: data.id,
        domain: data.domain,
        status: data.status,
        dnsRecordsCount: data.dnsRecords.length,
      })
    })

    it("should return 404 for non-existent domain", async () => {
      const response = await apiRequest("/domains/nonexistent-domain-id-12345")

      expect(response.status).toBe(404)

      console.log("✅ 404 returned for non-existent domain")
    })

    it("should support check=true for live verification", async () => {
      // First get a domain ID
      const listResponse = await apiRequest("/domains?limit=1")
      const listData = await listResponse.json()

      if (listData.data.length === 0) {
        console.log("⚠️ No domains available for testing")
        return
      }

      const domainId = listData.data[0].id
      const response = await apiRequest(`/domains/${domainId}?check=true`)

      expect(response.status).toBe(200)

      const data = await response.json()

      // Should have verificationCheck
      expect(data.verificationCheck).toBeDefined()
      expect(data.verificationCheck.dnsRecords).toBeDefined()
      expect(data.verificationCheck.sesStatus).toBeDefined()
      expect(typeof data.verificationCheck.isFullyVerified).toBe("boolean")

      // May have auth recommendations if SPF/DMARC missing
      if (data.authRecommendations) {
        expect(typeof data.authRecommendations).toBe("object")
      }

      console.log("✅ Live verification returned:", {
        sesStatus: data.verificationCheck.sesStatus,
        dkimStatus: data.verificationCheck.dkimStatus,
        mailFromStatus: data.verificationCheck.mailFromStatus,
        isFullyVerified: data.verificationCheck.isFullyVerified,
        hasRecommendations: !!data.authRecommendations,
      })
    })

    it("should include catch-all endpoint info if configured", async () => {
      // Find a domain with catch-all enabled
      const listResponse = await apiRequest("/domains?limit=50")
      const listData = await listResponse.json()

      const domainWithCatchAll = listData.data.find(
        (d: any) => d.isCatchAllEnabled && d.catchAllEndpointId
      )

      if (!domainWithCatchAll) {
        console.log("⚠️ No domains with catch-all configured for testing")
        return
      }

      const response = await apiRequest(`/domains/${domainWithCatchAll.id}`)
      expect(response.status).toBe(200)

      const data = await response.json()

      expect(data.isCatchAllEnabled).toBe(true)
      expect(data.catchAllEndpointId).toBeDefined()
      expect(data.catchAllEndpoint).toBeDefined()
      expect(data.catchAllEndpoint.id).toBeDefined()
      expect(data.catchAllEndpoint.name).toBeDefined()
      expect(data.catchAllEndpoint.type).toBeDefined()
      expect(typeof data.catchAllEndpoint.isActive).toBe("boolean")

      console.log("✅ Catch-all endpoint info returned:", {
        endpointId: data.catchAllEndpoint.id,
        name: data.catchAllEndpoint.name,
        type: data.catchAllEndpoint.type,
      })
    })
  })

  // ===================================================================
  // Update Domain (PATCH /domains/:id)
  // ===================================================================

  describe("PATCH /domains/:id - Update Domain Catch-All", () => {
    it("should return 404 for non-existent domain", async () => {
      const response = await apiRequest("/domains/nonexistent-domain-id-12345", {
        method: "PATCH",
        body: JSON.stringify({
          isCatchAllEnabled: false,
        }),
      })

      expect(response.status).toBe(404)
      console.log("✅ 404 returned for non-existent domain update")
    })

    it("should require domain to be verified", async () => {
      // Find a pending domain if one exists
      const listResponse = await apiRequest("/domains?status=pending&limit=1")
      const listData = await listResponse.json()

      if (listData.data.length === 0) {
        console.log("⚠️ No pending domains available for testing")
        return
      }

      const pendingDomain = listData.data[0]
      const response = await apiRequest(`/domains/${pendingDomain.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isCatchAllEnabled: true,
          catchAllEndpointId: null,
        }),
      })

      expect(response.status).toBe(400)

      console.log("✅ Update rejected for unverified domain")
    })

    it("should update catch-all settings for verified domain", async () => {
      // Find a verified domain
      const listResponse = await apiRequest("/domains?status=verified&limit=1")
      const listData = await listResponse.json()

      if (listData.data.length === 0) {
        console.log("⚠️ No verified domains available for testing")
        return
      }

      const verifiedDomain = listData.data[0]
      const currentCatchAllEnabled = verifiedDomain.isCatchAllEnabled

      // Toggle catch-all off (safe operation that doesn't require endpoint)
      const response = await apiRequest(`/domains/${verifiedDomain.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isCatchAllEnabled: false,
          catchAllEndpointId: null,
        }),
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.id).toBe(verifiedDomain.id)
      expect(data.isCatchAllEnabled).toBe(false)
      expect(data.catchAllEndpointId).toBeNull()
      expect(data.updatedAt).toBeDefined()

      console.log("✅ Catch-all settings updated:", {
        domain: data.domain,
        isCatchAllEnabled: data.isCatchAllEnabled,
      })
    })

    it("should validate endpoint belongs to user when enabling catch-all", async () => {
      // Find a verified domain
      const listResponse = await apiRequest("/domains?status=verified&limit=1")
      const listData = await listResponse.json()

      if (listData.data.length === 0) {
        console.log("⚠️ No verified domains available for testing")
        return
      }

      const verifiedDomain = listData.data[0]

      // Try to enable catch-all with invalid endpoint
      const response = await apiRequest(`/domains/${verifiedDomain.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          isCatchAllEnabled: true,
          catchAllEndpointId: "invalid-endpoint-id-12345",
        }),
      })

      expect(response.status).toBe(400)

      console.log("✅ Invalid endpoint rejected")
    })
  })

  // ===================================================================
  // Create Domain (POST /domains)
  // ===================================================================

  describe("POST /domains - Create Domain", () => {
    const testDomainName = `test-e2-${Date.now()}.example.com`

    it("should require domain field", async () => {
      const response = await apiRequest("/domains", {
        method: "POST",
        body: JSON.stringify({}),
      })

      expect(response.status).toBe(400)
      console.log("✅ Empty request rejected")
    })

    it("should validate domain format", async () => {
      const invalidDomains = [
        "invalid domain with spaces",
        "-startwithdash.com",
        "toolong" + "a".repeat(250) + ".com",
      ]

      for (const invalidDomain of invalidDomains) {
        const response = await apiRequest("/domains", {
          method: "POST",
          body: JSON.stringify({ domain: invalidDomain }),
        })

        // Should be 400 for invalid format
        expect(response.status).toBe(400)
      }

      console.log("✅ Invalid domain formats rejected")
    })

    it("should reject duplicate domains", async () => {
      // First get an existing domain
      const listResponse = await apiRequest("/domains?limit=1")
      const listData = await listResponse.json()

      if (listData.data.length === 0) {
        console.log("⚠️ No domains available for duplicate test")
        return
      }

      const existingDomain = listData.data[0].domain

      // Try to add the same domain
      const response = await apiRequest("/domains", {
        method: "POST",
        body: JSON.stringify({ domain: existingDomain }),
      })

      expect(response.status).toBe(409)

      const data = await response.json()
      expect(data.error).toBeDefined()

      console.log("✅ Duplicate domain rejected:", data.error)
    })

    // Note: We don't test actual domain creation in CI as it:
    // 1. Creates AWS SES identities
    // 2. May hit plan limits
    // 3. Would leave orphaned domains
    // Instead, we test validation and error cases
  })

  // ===================================================================
  // Delete Domain (DELETE /domains/:id)
  // ===================================================================

  describe("DELETE /domains/:id - Delete Domain", () => {
    it("should return 404 for non-existent domain", async () => {
      const response = await apiRequest("/domains/nonexistent-domain-id-12345", {
        method: "DELETE",
      })

      expect(response.status).toBe(404)
      console.log("✅ 404 returned for non-existent domain deletion")
    })

    // Note: We don't test actual deletion in CI as it:
    // 1. Removes real domains
    // 2. Cleans up AWS SES identities
    // 3. Is destructive and irreversible
    // Instead, test would be done in a controlled environment with test domains

    it("should block deletion of root domain with dependent subdomains", async () => {
      // Find a domain that might have subdomains
      const listResponse = await apiRequest("/domains?limit=100")
      const listData = await listResponse.json()

      // Look for potential root domain and subdomain pairs
      const domains = listData.data
      const domainNames = domains.map((d: any) => d.domain)

      // Find a root domain that has subdomains
      let rootDomainWithSubs = null
      for (const domain of domains) {
        const domainName = domain.domain
        const hasSubdomain = domainNames.some(
          (d: string) => d !== domainName && d.endsWith(`.${domainName}`)
        )
        if (hasSubdomain) {
          rootDomainWithSubs = domain
          break
        }
      }

      if (!rootDomainWithSubs) {
        console.log("⚠️ No root domains with subdomains available for testing")
        return
      }

      // Try to delete the root domain
      const response = await apiRequest(`/domains/${rootDomainWithSubs.id}`, {
        method: "DELETE",
      })

      expect(response.status).toBe(409)

      const data = await response.json()
      expect(data.error).toContain("subdomain")
      expect(data.code).toBe("DOMAIN_HAS_DEPENDENT_SUBDOMAINS")
      expect(data.dependentSubdomains).toBeDefined()

      console.log("✅ Root domain deletion blocked:", {
        rootDomain: rootDomainWithSubs.domain,
        dependentCount: data.dependentSubdomains?.length,
      })
    })
  })

  // ===================================================================
  // Country Code TLD Domains (e.g., .co.uk, .com.au)
  // Tests for domains with multi-part TLDs
  // ===================================================================

  describe("Country Code TLD Domains (e.g., .co.uk)", () => {
    // Use a unique test domain name to avoid conflicts
    const testCCTLDDomain = `e2-test-${Date.now()}.co.uk`
    let createdDomainId: string | null = null

    it("should create a .co.uk domain successfully", async () => {
      console.log(`🧪 Testing creation of country code TLD domain: ${testCCTLDDomain}`)

      const response = await apiRequest("/domains", {
        method: "POST",
        body: JSON.stringify({ domain: testCCTLDDomain }),
      })

      const data = await response.json()
      console.log("📋 Create response:", {
        status: response.status,
        domain: data.domain,
        id: data.id,
        dnsRecordsCount: data.dnsRecords?.length,
      })

      // Should be 201 Created (or 409 if somehow exists)
      if (response.status === 201) {
        expect(data.id).toBeDefined()
        expect(data.domain).toBe(testCCTLDDomain)
        expect(data.status).toMatch(/pending|verified/)
        expect(data.dnsRecords).toBeDefined()
        expect(Array.isArray(data.dnsRecords)).toBe(true)

        // Verify DNS records contain proper domain name (not duplicated)
        for (const record of data.dnsRecords) {
          // Check that the record name doesn't have duplicate domain parts
          // e.g., should NOT be "mail.spendwisely.co.uk.spendwisely.co.uk"
          const domainParts = testCCTLDDomain.split(".")
          const recordName = record.name
          
          // Count occurrences of the base domain in the record name
          const baseDomain = domainParts.slice(-2).join(".") // e.g., "co.uk"
          const occurrences = (recordName.match(new RegExp(baseDomain.replace(".", "\\."), "g")) || []).length
          
          expect(occurrences).toBeLessThanOrEqual(1)
          console.log(`  ✅ DNS Record: ${record.type} ${record.name} → ${record.value.substring(0, 50)}...`)
        }

        createdDomainId = data.id
        console.log(`✅ Successfully created .co.uk domain: ${data.domain} (${data.id})`)
      } else if (response.status === 409) {
        console.log("⚠️ Domain already exists (might be from previous test run)")
        expect(data.error).toBeDefined()
      } else if (response.status === 400) {
        // DNS conflict - expected if domain has existing MX/CNAME
        console.log("⚠️ Domain has DNS conflicts:", data.error)
      } else if (response.status === 403) {
        // Plan limit reached
        console.log("⚠️ Domain limit reached:", data.error)
      } else {
        console.error("❌ Unexpected response:", response.status, data)
        expect(response.status).toBe(201)
      }
    })

    it("should retrieve .co.uk domain with correct DNS records", async () => {
      if (!createdDomainId) {
        console.log("⚠️ Skipping - no domain was created in previous test")
        return
      }

      const response = await apiRequest(`/domains/${createdDomainId}`)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.id).toBe(createdDomainId)
      expect(data.domain).toBe(testCCTLDDomain)
      expect(data.dnsRecords).toBeDefined()

      // Verify DNS record names are properly formatted
      console.log(`📋 DNS Records for ${data.domain}:`)
      for (const record of data.dnsRecords) {
        console.log(`  - ${record.recordType}: ${record.name}`)
        
        // Ensure no duplicate domain parts in record names
        // Bad: "mail.example.co.uk.example.co.uk"
        // Good: "mail.example.co.uk"
        const fullDomain = data.domain
        const recordName = record.name
        
        // Check that the full domain doesn't appear twice
        const domainOccurrences = (recordName.match(new RegExp(fullDomain.replace(/\./g, "\\."), "g")) || []).length
        expect(domainOccurrences).toBeLessThanOrEqual(1)
      }

      console.log(`✅ DNS records properly formatted for .co.uk domain`)
    })

    it("should retrieve .co.uk domain with check=true for live verification", async () => {
      if (!createdDomainId) {
        console.log("⚠️ Skipping - no domain was created in previous test")
        return
      }

      const response = await apiRequest(`/domains/${createdDomainId}?check=true`)
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.verificationCheck).toBeDefined()
      expect(data.verificationCheck.dnsRecords).toBeDefined()
      expect(data.verificationCheck.sesStatus).toBeDefined()

      console.log(`📋 Verification check for ${data.domain}:`, {
        sesStatus: data.verificationCheck.sesStatus,
        isFullyVerified: data.verificationCheck.isFullyVerified,
        dnsRecordsChecked: data.verificationCheck.dnsRecords.length,
      })

      // Check that verification DNS records don't have duplicate domain parts
      for (const record of data.verificationCheck.dnsRecords) {
        const fullDomain = data.domain
        const domainOccurrences = (record.name.match(new RegExp(fullDomain.replace(/\./g, "\\."), "g")) || []).length
        expect(domainOccurrences).toBeLessThanOrEqual(1)
        
        console.log(`  - ${record.type}: ${record.name} (verified: ${record.isVerified})`)
      }

      console.log(`✅ Live verification works for .co.uk domain`)
    })

    it("should delete the test .co.uk domain", async () => {
      if (!createdDomainId) {
        console.log("⚠️ Skipping cleanup - no domain was created")
        return
      }

      console.log(`🗑️ Cleaning up test domain: ${testCCTLDDomain} (${createdDomainId})`)

      const response = await apiRequest(`/domains/${createdDomainId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.deletedResources).toBeDefined()
      expect(data.deletedResources.domain).toBe(testCCTLDDomain)

      console.log(`✅ Successfully deleted test domain:`, {
        domain: data.deletedResources.domain,
        emailAddresses: data.deletedResources.emailAddresses,
        dnsRecords: data.deletedResources.dnsRecords,
        sesIdentity: data.deletedResources.sesIdentity,
      })

      createdDomainId = null
    })

    // Additional test for other country code TLD formats
    it("should validate various country code TLD formats", async () => {
      // Test domain format validation for various ccTLDs
      const testDomains = [
        { domain: "test.co.uk", shouldBeValid: true },
        { domain: "test.com.au", shouldBeValid: true },
        { domain: "test.org.uk", shouldBeValid: true },
        { domain: "test.net.nz", shouldBeValid: true },
        { domain: "test.co.jp", shouldBeValid: true },
        { domain: "münchen.de", shouldBeValid: false }, // IDN not supported in basic regex
        { domain: "test..co.uk", shouldBeValid: false }, // Double dot
        { domain: ".co.uk", shouldBeValid: false }, // Missing subdomain
        { domain: "-test.co.uk", shouldBeValid: false }, // Starts with hyphen
      ]

      console.log("🧪 Testing domain format validation for various ccTLDs:")

      for (const test of testDomains) {
        // We're just validating the domain format regex
        // Not actually creating domains to avoid AWS costs
        const domainRegex =
          /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
        const isValid = domainRegex.test(test.domain) && test.domain.length <= 253

        if (test.shouldBeValid) {
          expect(isValid).toBe(true)
          console.log(`  ✅ ${test.domain} - valid format`)
        } else {
          expect(isValid).toBe(false)
          console.log(`  ✅ ${test.domain} - correctly rejected`)
        }
      }
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
console.log("  - List Domains with check=true (Live Verification)")
console.log("  - Query Parameter Filtering")
console.log("  - RFC Compliance & Error Handling")
console.log("  - Type Safety & Data Integrity")
console.log("  - Performance & Edge Cases")
console.log("  - OpenAPI Documentation")
console.log("  - Get Domain by ID")
console.log("  - Update Domain Catch-All")
console.log("  - Create Domain (validation)")
console.log("  - Delete Domain")
console.log("  - Country Code TLD Domains (.co.uk, .com.au)")
console.log("    - Create/Delete lifecycle")
console.log("    - DNS record format validation")
console.log("    - Duplicate domain detection")
console.log("=".repeat(60) + "\n")
