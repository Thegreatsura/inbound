# Create or Migrate Elysia Route

Create a new Elysia route or migrate an existing Next.js API route to Elysia following project standards and RFC compliance.

## Checklist

Before starting, determine:
- [ ] Is this a new route or migration from existing Next.js route?
- [ ] What HTTP methods does this route support? (GET, POST, PUT, PATCH, DELETE)
- [ ] Does this route require authentication?
- [ ] What validation schemas are needed for request/response?
- [ ] What OpenAPI tags and documentation should be included?

## File Structure

All Elysia routes live in `/app/api/e2/`:

```
app/api/e2/
├── [[...slugs]]/route.ts        # Main Elysia app with error handling
├── lib/
│   ├── auth.ts                  # Authentication & rate limiting
│   └── types.ts                 # Shared types
└── [feature]/
    ├── list.ts                  # GET collection
    ├── get.ts                   # GET single item
    ├── create.ts                # POST create
    ├── update.ts                # PUT/PATCH update
    └── delete.ts                # DELETE remove
```

## Step-by-Step Process

### 1. Create the Route File

Create a new file in the appropriate feature folder:
- **Location**: `/app/api/e2/[feature]/[action].ts`
- **Naming**: Use lowercase with hyphens: `list.ts`, `create.ts`, `update.ts`, etc.

### 2. Define TypeBox Schemas

Start with request/response validation schemas using Elysia's `t` (TypeBox):

```typescript
import { Elysia, t } from "elysia"

// Query parameters schema (for GET requests)
const QuerySchema = t.Object({
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 50 })),
  offset: t.Optional(t.Number({ minimum: 0, default: 0 })),
  status: t.Optional(t.Union([
    t.Literal("active"),
    t.Literal("inactive"),
  ])),
})

// Request body schema (for POST/PUT/PATCH)
const CreateSchema = t.Object({
  name: t.String({ minLength: 1, maxLength: 255 }),
  email: t.String({ format: "email" }),
  isActive: t.Optional(t.Boolean({ default: true })),
})

// Response schema
const ItemSchema = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String(),
  isActive: t.Boolean(),
  createdAt: t.Date(),
  updatedAt: t.Date(),
})

const ListResponseSchema = t.Object({
  data: t.Array(ItemSchema),
  pagination: t.Object({
    limit: t.Number(),
    offset: t.Number(),
    total: t.Number(),
    hasMore: t.Boolean(),
  }),
})
```

### 3. Implement the Route Handler

```typescript
import { validateAndRateLimit } from "../lib/auth"
import { db } from "@/lib/db"
import { yourTable } from "@/lib/db/schema"

// Error response schema (reusable)
const ErrorResponse = t.Object({
  error: t.String(),
  code: t.Optional(t.String()),
})

export const listItems = new Elysia().get(
  "/items",
  async ({ request, query, set }) => {
    // Step 1: Authentication & Rate Limiting
    // Throws RFC-compliant errors automatically
    const userId = await validateAndRateLimit(request, set)
    
    // Step 2: Extract & validate query parameters
    const limit = Math.min(query.limit || 50, 100)
    const offset = query.offset || 0
    
    // Step 3: Database query
    const items = await db
      .select()
      .from(yourTable)
      .where(eq(yourTable.userId, userId))
      .limit(limit)
      .offset(offset)
    
    // Step 4: Get total count for pagination
    const [{ count: total }] = await db
      .select({ count: count() })
      .from(yourTable)
      .where(eq(yourTable.userId, userId))
    
    // Step 5: Return formatted response
    return {
      data: items,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + items.length < total,
      },
    }
  },
  {
    // Step 6: Attach schemas and documentation
    query: QuerySchema,
    // ⚠️ IMPORTANT: Use status-code keyed object, NOT t.Union()
    response: {
      200: ListResponseSchema,
      401: ErrorResponse,
      500: ErrorResponse,
    },
    detail: {
      tags: ["Feature Name"],
      summary: "List all items",
      description: "Get paginated list of items for authenticated user with optional filtering",
    },
  }
)
```

### 4. Register the Route

Add to `/app/api/e2/[[...slugs]]/route.ts`:

```typescript
import { listItems } from "../[feature]/list"

const app = new Elysia({ prefix: "/api/e2" })
  .use(openapi({ /* ... */ }))
  .onError(({ code, error, set }) => { /* ... */ })
  .use(listItems) // Add your route here
```

### 5. Export for Type Safety (Eden)

Update the export in `route.ts`:

```typescript
export type App = typeof app
```

This enables end-to-end type safety with Eden Treaty.

## Common Patterns

### POST/Create Routes

```typescript
export const createItem = new Elysia().post(
  "/items",
  async ({ request, body, set }) => {
    const userId = await validateAndRateLimit(request, set)
    
    const [newItem] = await db
      .insert(yourTable)
      .values({
        ...body,
        userId,
      })
      .returning()
    
    set.status = 201 // Created
    return newItem
  },
  {
    body: CreateSchema,
    // ⚠️ IMPORTANT: Use status-code keyed object for OpenAPI docs
    response: {
      201: ItemSchema,
      400: ErrorResponse,
      401: ErrorResponse,
      403: ErrorResponse,
      409: ErrorResponse,
      500: ErrorResponse,
    },
    detail: {
      tags: ["Feature Name"],
      summary: "Create new item",
      description: "Create a new item for the authenticated user",
    },
  }
)
```

### PUT/PATCH Update Routes

```typescript
export const updateItem = new Elysia().patch(
  "/items/:id",
  async ({ request, params, body, set }) => {
    const userId = await validateAndRateLimit(request, set)
    
    // Verify ownership
    const [existing] = await db
      .select()
      .from(yourTable)
      .where(
        and(
          eq(yourTable.id, params.id),
          eq(yourTable.userId, userId)
        )
      )
    
    if (!existing) {
      set.status = 404
      return { error: "Item not found" }
    }
    
    const [updated] = await db
      .update(yourTable)
      .set(body)
      .where(eq(yourTable.id, params.id))
      .returning()
    
    return updated
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    body: t.Partial(CreateSchema),
    // ⚠️ IMPORTANT: Use status-code keyed object for OpenAPI docs
    response: {
      200: ItemSchema,
      400: ErrorResponse,
      401: ErrorResponse,
      404: ErrorResponse,
      500: ErrorResponse,
    },
    detail: {
      tags: ["Feature Name"],
      summary: "Update item",
      description: "Update an existing item",
    },
  }
)
```

### DELETE Routes

```typescript
// Delete success response
const DeleteResponse = t.Object({
  success: t.Boolean(),
  message: t.String(),
  deletedResources: t.Optional(t.Object({
    // Add relevant deletion stats here
  })),
})

export const deleteItem = new Elysia().delete(
  "/items/:id",
  async ({ request, params, set }) => {
    const userId = await validateAndRateLimit(request, set)
    
    const [deleted] = await db
      .delete(yourTable)
      .where(
        and(
          eq(yourTable.id, params.id),
          eq(yourTable.userId, userId)
        )
      )
      .returning()
    
    if (!deleted) {
      set.status = 404
      return { error: "Item not found" }
    }
    
    return {
      success: true,
      message: `Successfully deleted item ${params.id}`,
    }
  },
  {
    params: t.Object({
      id: t.String(),
    }),
    // ⚠️ IMPORTANT: Use status-code keyed object for OpenAPI docs
    response: {
      200: DeleteResponse,
      401: ErrorResponse,
      404: ErrorResponse,
      409: ErrorResponse,
      500: ErrorResponse,
    },
    detail: {
      tags: ["Feature Name"],
      summary: "Delete item",
      description: "Delete an existing item",
    },
  }
)
```

## Handling Optional/Nullable Fields

When database fields are nullable, handle them properly:

```typescript
// Use undefined for optional fields (not null)
let optionalField: string | undefined = undefined

if (dbValue) {
  optionalField = dbValue
}

// Or use nullish coalescing
const value = dbRecord.nullableField ?? undefined

// Never mix null and undefined in return types
```

## Error Handling

Errors are automatically handled by the global error handler in `route.ts`:

- **401 Unauthorized** - Thrown by `validateAndRateLimit()` with `WWW-Authenticate` header
- **429 Rate Limited** - Thrown by `validateAndRateLimit()` with `Retry-After` header
- **400 Validation** - Automatically handled by Elysia for schema violations
- **404 Not Found** - Throw `Error` with `set.status = 404`
- **500 Server Error** - Caught by global handler

All errors follow RFC 7807 format:
```json
{
  "error": "Error Type",
  "message": "Human-readable message",
  "statusCode": 400
}
```

## Rate Limit Headers (Automatic)

All successful responses include rate limit headers:
```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1706234567000
```

## OpenAPI Documentation

Each route automatically generates OpenAPI documentation at:
- **UI**: `/api/e2/docs`
- **JSON Spec**: `/api/e2/openapi.json`

Make sure to provide:
- `tags` - Category for grouping endpoints
- `summary` - Short title (< 50 chars)
- `description` - Detailed explanation

### ⚠️ CRITICAL: Response Schema Format

**ALWAYS use status-code keyed objects for response schemas.**

Using `t.Union([SuccessResponse, ErrorResponse])` will NOT show responses in OpenAPI docs!

```typescript
// ❌ WRONG - Response won't show in OpenAPI docs
{
  response: t.Union([SuccessResponse, ErrorResponse]),
}

// ✅ CORRECT - All responses properly documented
{
  response: {
    200: SuccessResponse,
    400: ErrorResponse,
    401: ErrorResponse,
    404: ErrorResponse,
    500: ErrorResponse,
  },
}
```

### Standard Response Patterns

| Method | Success Code | Common Error Codes |
|--------|-------------|-------------------|
| GET (list) | 200 | 401, 500 |
| GET (single) | 200 | 401, 404, 500 |
| POST | 201 | 400, 401, 403, 409, 500 |
| PATCH/PUT | 200 | 400, 401, 404, 500 |
| DELETE | 200 | 401, 404, 409, 500 |

## Testing

### Manual Testing

Test your route using:

1. **OpenAPI Docs**: Visit `/api/e2/docs` to test in browser
2. **cURL**:
```bash
curl -X GET "http://localhost:3000/api/e2/items" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

3. **Eden Treaty** (Type-safe client):
```typescript
import { treaty } from '@elysiajs/eden'
import type { App } from '@/app/api/e2/[[...slugs]]/route'

const client = treaty<App>('http://localhost:3000')
const { data, error } = await client.api.e2.items.get()
```

### Automated Testing

Create a comprehensive test file for your endpoint using Bun's test runner.

#### 1. Create Test File

Location: `/app/api/e2/[feature]/[feature].test.ts`

Example: `/app/api/e2/domains/domains.test.ts`

#### 2. Test File Structure

```typescript
/**
 * E2 API - Feature Name Tests
 * Tests for the Elysia-powered [feature] API with RFC-compliant error handling
 */

// @ts-ignore - bun:test is a Bun-specific module
import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import dotenv from "dotenv"

dotenv.config()

const API_URL = "http://localhost:3000/api/e2"
const API_KEY = process.env.INBOUND_API_KEY

if (!API_KEY) {
  console.error("❌ INBOUND_API_KEY not found in environment variables")
  process.exit(1)
}

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

describe("E2 API - Feature Name", () => {
  // Your tests here
})
```

#### 3. Test Categories

Organize tests into these categories:

**A. Authentication & Rate Limiting**
```typescript
describe("Authentication & Rate Limiting", () => {
  it("should return 401 with WWW-Authenticate header when no auth provided", async () => {
    const response = await fetch(`${API_URL}/items`)
    
    expect(response.status).toBe(401)
    expect(response.headers.get("WWW-Authenticate")).toBeDefined()
    expect(response.headers.get("WWW-Authenticate")).toContain("Bearer")
    
    const data = await response.json()
    expect(data.error).toBe("Unauthorized")
    expect(data.message).toContain("Authentication required")
    expect(data.statusCode).toBe(401)
  })

  it("should include rate limit headers on successful requests", async () => {
    const response = await apiRequest("/items")
    
    expect(response.status).toBe(200)
    expect(response.headers.get("X-RateLimit-Limit")).toBeDefined()
    expect(response.headers.get("X-RateLimit-Remaining")).toBeDefined()
    expect(response.headers.get("X-RateLimit-Reset")).toBeDefined()
  })
})
```

**B. List Endpoints (GET collection)**
```typescript
describe("GET /items - List Items", () => {
  it("should list items with pagination", async () => {
    const response = await apiRequest("/items")
    
    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.data).toBeDefined()
    expect(Array.isArray(data.data)).toBe(true)
    expect(data.pagination).toBeDefined()
    expect(data.pagination.limit).toBeDefined()
    expect(data.pagination.offset).toBeDefined()
    expect(data.pagination.total).toBeDefined()
    expect(data.pagination.hasMore).toBeDefined()
  })

  it("should respect limit parameter", async () => {
    const response = await apiRequest("/items?limit=2")
    
    const data = await response.json()
    expect(data.pagination.limit).toBe(2)
    expect(data.data.length).toBeLessThanOrEqual(2)
  })

  it("should respect offset parameter", async () => {
    const response1 = await apiRequest("/items?limit=1&offset=0")
    const response2 = await apiRequest("/items?limit=1&offset=1")
    
    const data1 = await response1.json()
    const data2 = await response2.json()
    
    // Should return different items
    if (data1.data.length > 0 && data2.data.length > 0) {
      expect(data1.data[0].id).not.toBe(data2.data[0].id)
    }
  })

  it("should filter by query parameters", async () => {
    const response = await apiRequest("/items?status=active")
    
    const data = await response.json()
    data.data.forEach((item: any) => {
      expect(item.status).toBe("active")
    })
  })
})
```

**C. Create Endpoints (POST)**
```typescript
describe("POST /items - Create Item", () => {
  let createdItemId: string

  it("should create a new item", async () => {
    const response = await apiRequest("/items", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Item",
        description: "Test description",
      }),
    })
    
    expect(response.status).toBe(201)
    
    const data = await response.json()
    expect(data.id).toBeDefined()
    expect(data.name).toBe("Test Item")
    
    createdItemId = data.id
  })

  it("should return 400 for invalid data", async () => {
    const response = await apiRequest("/items", {
      method: "POST",
      body: JSON.stringify({
        // Missing required 'name' field
        description: "Test",
      }),
    })
    
    expect(response.status).toBe(400)
    
    const data = await response.json()
    expect(data.error).toBe("Bad Request")
    expect(data.message).toContain("Validation")
  })

  // Cleanup
  afterAll(async () => {
    if (createdItemId) {
      await apiRequest(`/items/${createdItemId}`, { method: "DELETE" })
    }
  })
})
```

**D. Update Endpoints (PATCH/PUT)**
```typescript
describe("PATCH /items/:id - Update Item", () => {
  it("should update an existing item", async () => {
    // Assume we have an item ID from previous tests
    const response = await apiRequest(`/items/${itemId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: "Updated Name",
      }),
    })
    
    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(data.name).toBe("Updated Name")
  })

  it("should return 404 for non-existent item", async () => {
    const response = await apiRequest("/items/nonexistent123", {
      method: "PATCH",
      body: JSON.stringify({
        name: "Test",
      }),
    })
    
    expect(response.status).toBe(404)
  })
})
```

**E. Delete Endpoints (DELETE)**
```typescript
describe("DELETE /items/:id - Delete Item", () => {
  it("should delete an existing item", async () => {
    const response = await apiRequest(`/items/${itemId}`, {
      method: "DELETE",
    })
    
    expect(response.status).toBe(204)
  })

  it("should return 404 for already deleted item", async () => {
    const response = await apiRequest(`/items/${itemId}`, {
      method: "DELETE",
    })
    
    expect(response.status).toBe(404)
  })
})
```

**F. RFC Compliance & Error Handling**
```typescript
describe("RFC Compliance & Error Handling", () => {
  it("should return proper Content-Type headers", async () => {
    const response = await apiRequest("/items")
    
    expect(response.headers.get("Content-Type")).toContain("application/json")
  })

  it("should return consistent error format", async () => {
    const response = await fetch(`${API_URL}/items`)
    
    const data = await response.json()
    expect(data).toHaveProperty("error")
    expect(data).toHaveProperty("message")
    expect(data).toHaveProperty("statusCode")
  })
})
```

**G. Type Safety & Data Integrity**
```typescript
describe("Type Safety & Data Integrity", () => {
  it("should return dates in ISO 8601 format", async () => {
    const response = await apiRequest("/items?limit=1")
    const data = await response.json()
    
    if (data.data.length > 0) {
      const item = data.data[0]
      expect(new Date(item.createdAt).toISOString()).toBe(item.createdAt)
    }
  })

  it("should use undefined for optional fields (not null)", async () => {
    const response = await apiRequest("/items")
    const data = await response.json()
    
    if (data.data.length > 0) {
      const item = data.data[0]
      // Optional fields should be undefined, not null
      if (!item.optionalField) {
        expect(item.optionalField).toBeUndefined()
      }
    }
  })
})
```

**H. Performance & Edge Cases**
```typescript
describe("Performance & Edge Cases", () => {
  it("should respond within reasonable time (< 2 seconds)", async () => {
    const start = Date.now()
    const response = await apiRequest("/items")
    const duration = Date.now() - start
    
    expect(response.status).toBe(200)
    expect(duration).toBeLessThan(2000)
  })

  it("should handle concurrent requests correctly", async () => {
    const requests = Array(5)
      .fill(null)
      .map(() => apiRequest("/items?limit=10"))
    
    const responses = await Promise.all(requests)
    
    responses.forEach((response) => {
      expect(response.status).toBe(200)
    })
  })

  it("should handle large offset values gracefully", async () => {
    const response = await apiRequest("/items?offset=9999&limit=10")
    
    expect(response.status).toBe(200)
    
    const data = await response.json()
    expect(Array.isArray(data.data)).toBe(true)
  })
})
```

**I. OpenAPI Documentation**
```typescript
describe("OpenAPI Documentation", () => {
  it("should have OpenAPI spec available", async () => {
    const response = await fetch(`${API_URL}/openapi.json`)
    
    expect(response.status).toBe(200)
    
    const spec = await response.json()
    expect(spec.openapi).toBeDefined()
    expect(spec.paths["/items"]).toBeDefined()
  })
})
```

#### 4. Running Tests

Add a test script to `package.json`:
```json
{
  "scripts": {
    "test:e2": "bun test app/api/e2/**/*.test.ts",
    "test:e2:domains": "bun test app/api/e2/domains/domains.test.ts"
  }
}
```

Run tests:
```bash
# Run all E2 API tests
bun run test:e2

# Run specific feature tests
bun run test:e2:domains

# Run single test file
bun test app/api/e2/domains/domains.test.ts

# Run with watch mode
bun test --watch app/api/e2/domains/domains.test.ts
```

#### 5. Test Best Practices

✅ **DO**:
- Test authentication before testing functionality
- Test RFC compliance (headers, status codes, error format)
- Test pagination and filtering thoroughly
- Test type safety (dates, booleans, numbers)
- Clean up test data in `afterAll()`
- Use descriptive test names
- Test edge cases (empty results, large offsets, etc.)
- Test performance (response time < 2 seconds)
- Test concurrent requests

❌ **DON'T**:
- Hardcode test data IDs (they might not exist)
- Skip cleanup in `afterAll()`
- Test implementation details (test behavior)
- Create tests dependent on each other
- Leave debug `console.log()` statements
- Test without rate limit consideration

#### 6. Example Complete Test File

See reference implementation: `/app/api/e2/domains/domains.test.ts`

This file includes all test categories and serves as a template for other endpoint tests.

## Migration from Next.js Route

If migrating an existing Next.js route:

1. **Copy logic** from `app/api/[route]/route.ts`
2. **Replace authentication**:
   - Remove manual `getSession()` calls
   - Replace with `validateAndRateLimit(request, set)`
3. **Replace validation**:
   - Remove Zod or manual validation
   - Use TypeBox schemas with Elysia
4. **Replace error handling**:
   - Remove `NextResponse.json()` with errors
   - Use `set.status` and `throw Error()`
5. **Update types**:
   - Replace Next.js types with Elysia context
   - Use TypeBox instead of Zod/TypeScript interfaces

## Common Issues

### "Property does not exist on type"
- Make sure `set.headers` is typed as `Record<string, string> | any`
- The `validateAndRateLimit` function accepts Elysia's context

### "Type 'null' is not assignable to 'undefined'"
- Use `undefined` for optional fields, not `null`
- Update database queries: `value ?? undefined`

### "Response does not match schema"
- Ensure return type matches response schema exactly
- Check for Date objects (use `t.Date()` in schema)
- Optional fields must use `t.Optional()` not nullable

### "Response parameters not showing in OpenAPI docs"
- **DO NOT USE** `t.Union([SuccessResponse, ErrorResponse])`
- **MUST USE** status-code keyed object: `{ 200: Success, 400: Error, ... }`
- Each status code must have its own schema definition

### Rate limit not working
- Check `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in `.env`
- Rate limiting is disabled without these variables

## Best Practices

✅ **DO**:
- Use `validateAndRateLimit()` for all authenticated routes
- Define TypeBox schemas before implementation
- Include OpenAPI documentation
- Use proper HTTP status codes
- Handle pagination consistently
- Export route as named constant
- Keep route files focused (one operation per file)
- **Use status-code keyed objects for response schemas** (e.g., `{ 200: Success, 400: Error }`)

❌ **DON'T**:
- Return raw `Response` objects (breaks type system)
- Mix `null` and `undefined` for optional fields
- Duplicate type definitions (use schema inference)
- Skip authentication checks
- Forget to verify resource ownership
- Use manual error response objects (use throw)
- **Use `t.Union()` for response schemas** (responses won't show in OpenAPI docs)

## Final Verification

Before completing:
- [ ] Route file created in correct location
- [ ] TypeBox schemas defined for request/response
- [ ] **Response uses status-code keyed object (NOT `t.Union()`)**
- [ ] Authentication added with `validateAndRateLimit()`
- [ ] Database queries verified
- [ ] OpenAPI documentation complete
- [ ] Route registered in main app
- [ ] No TypeScript linting errors
- [ ] Tested via OpenAPI docs or cURL
- [ ] Rate limit headers present in response
- [ ] **All response parameters visible in `/api/e2/docs`**

---

**Need help?** Reference these files:
- Authentication: `/app/api/e2/lib/auth.ts`
- Example route: `/app/api/e2/domains/list.ts`
- Main app: `/app/api/e2/[[...slugs]]/route.ts`
- Elysia docs: See `.cursor/rules/elysia.mdc`
