# AGENTS.md - Inbound Email Platform

> Agent guidelines for working with this Next.js 15 + Elysia API codebase.

## Quick Reference

| Task | Command |
|------|---------|
| Single test | `bun test app/api/e2/domains/domains.test.ts` |
| All E2 API tests | `bun run test:e2` |
| Legacy API tests | `bun run test-api` |
| SDK tests | `bun run test-sdk` |
| Lint | `bun run lint` |
| Generate OpenAPI | `bun run generate:openapi` |

## Build & Test Commands

### Running Tests
```bash
# Single test file (most common)
bun test <path/to/file.test.ts>
bun test app/api/e2/domains/domains.test.ts

# All Elysia e2 API tests
bun run test:e2

# Legacy v2 API tests
bun run test-api
bun run test-sdk
```

### Linting
```bash
bun run lint              # Run Biome linter
bun run lint:noany        # Error on explicit any
```

### Restricted Commands (Require Approval)
- `bun run dev` / `bun run build` - **Ask before running**
- `bunx drizzle-kit generate` / `bunx drizzle-kit push` - **Prompt user to run manually**
- `npx tsc` - **Never run** (can break project state)

## Package Manager

**Only use `bun`** - Never npm, yarn, or pnpm.

```bash
bun add <package>          # Install dependency
bun add -d <package>       # Install dev dependency
bun remove <package>       # Remove dependency
```

## Architecture Overview

```
app/
├── api/
│   ├── e2/              # Elysia API routes (primary)
│   │   ├── domains/     # Domain endpoints
│   │   ├── emails/      # Email endpoints
│   │   ├── endpoints/   # Webhook/forward endpoints
│   │   ├── lib/         # Shared auth, types, responses
│   │   └── [[...slugs]]/route.ts  # Main Elysia app
│   └── v2/              # Legacy Next.js API routes
├── (web)/               # Public website pages
└── (dashboard)/         # Dashboard pages

lib/
├── db/
│   └── schema.ts        # Drizzle schema (source of truth for types)
└── domains-and-dns/     # DNS verification utilities

features/                # Feature-specific logic
aws/cdk/                 # AWS CDK infrastructure
lambda/                  # AWS Lambda functions
scripts/                 # Deployment and utility scripts
```

## Code Style Guidelines

### Imports
```typescript
// Order: external packages → local modules → types
import { Elysia, t } from "elysia";
import { db } from "@/lib/db";
import { emailDomains } from "@/lib/db/schema";
import type { InferSelectModel } from "drizzle-orm";
```

Use `@/` path alias for all local imports. Never use relative paths like `../../../`.

### TypeScript
- **No `any`** - Biome enforces `noExplicitAny: error`
- **Find existing types** in `lib/db/schema.ts` - don't create duplicates
- **Infer DB types** from Drizzle: `InferSelectModel<typeof tableName>`
- Dynamic route params: `params: Promise<{ id: string }>`, then `const { id } = await params`

### Database
- **Drizzle ORM only** - No raw SQL
- **Use `structuredEmails`** - NOT deprecated `receivedEmails` or `parsedEmails`
- Always scope queries by `userId` for multi-tenant safety
- Import schema from `@/lib/db/schema`

### Elysia API Responses
**Always use status-code keyed objects, NOT `t.Union()`:**

```typescript
// CORRECT
{
  response: {
    200: SuccessResponse,
    400: ErrorResponse,
    401: ErrorResponse,
    404: ErrorResponse,
    500: ErrorResponse,
  },
}

// WRONG - won't show in OpenAPI docs
{
  response: t.Union([SuccessResponse, ErrorResponse]),
}
```

### React Components
- Use variant props for styling (never custom colors/sizes/border-radius)
- Colors from CSS variables in `global.css`
- Use Suspense with fallback for data fetching
- Use TanStack Query (`useQuery`, `useMutation`) for data fetching

```tsx
function StatsCard() {
  return (
    <Suspense fallback={<Skeleton />}>
      <StatsCardInternal />
    </Suspense>
  );
}

async function StatsCardInternal() {
  const data = await getData();
  return <div>{data}</div>;
}
```

### Naming Conventions
- **Files**: kebab-case (`email-addresses.ts`)
- **React components**: PascalCase (`EmailList.tsx`)
- **Hooks**: `use` prefix with Query/Mutation suffix (`useDomainsQuery.ts`)
- **Tests**: Same name as source + `.test.ts` suffix

### Comments & Documentation
- **No comments** unless explicitly requested
- **No unnecessary README files**
- API documentation via OpenAPI/Scalar annotations

## Error Handling

### API Errors (Elysia)
```typescript
import { createErrorResponse } from "./lib/responses";

// Standard error responses
set.status = 400;
return createErrorResponse(400, "Bad Request", "Validation failed");

set.status = 401;
return createErrorResponse(401, "Unauthorized", "Authentication required");

set.status = 404;
return createErrorResponse(404, "Not Found", "Resource not found");
```

### Status Codes
| Code | Use Case |
|------|----------|
| 200 | Success (GET, PATCH, DELETE) |
| 201 | Created (POST) |
| 400 | Validation error |
| 401 | Authentication required |
| 403 | Forbidden (insufficient permissions) |
| 404 | Resource not found |
| 409 | Conflict (duplicate, dependency) |
| 429 | Rate limited |
| 500 | Internal server error |

## Testing Patterns

Tests use `bun:test` with Elysia's treaty client:

```typescript
import { describe, it, expect, beforeAll } from "bun:test";

const API_URL = "https://dev.inbound.new/api/e2";
const API_KEY = process.env.INBOUND_API_KEY;

async function apiRequest(endpoint: string, options: RequestInit = {}) {
  return fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

describe("Domains API", () => {
  it("should list domains", async () => {
    const response = await apiRequest("/domains");
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(data.pagination).toBeDefined();
  });
});
```

## API Documentation (Scalar)

- **Docs URL**: `/api/e2/docs` (Scalar UI)
- **OpenAPI spec**: `/api/e2/openapi.json`
- **SDK**: `inboundemail` on npm

### Scalar Extensions
```typescript
{
  detail: {
    tags: ["Domains"],
    summary: "List all domains",
    description: "Get paginated list of domains.",
    "x-scalar-stability": "stable", // or "experimental", "deprecated"
  },
}
```

## AWS Integration

### SES Client (v2)
```typescript
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const client = new SESv2Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});
```

### Logging Pattern
```typescript
console.log("🌐 GET /api/e2/domains - Starting request");
console.log("✅ Authentication successful for userId:", userId);
console.log("🔍 Querying domains from database");
console.log("📊 Found", domains.length, "domains");
console.error("❌ GET /api/e2/domains - Error:", err);
```

## Common Pitfalls

1. **Don't duplicate types** - Use existing types from `lib/db/schema.ts`
2. **Don't use deprecated tables** - Use `structuredEmails`, not `receivedEmails`/`parsedEmails`
3. **Don't forget user scoping** - Always filter by `userId` in DB queries
4. **Don't use `t.Union()` for responses** - Use status-code keyed objects
5. **Don't run drizzle-kit commands** - Prompt user to run manually
6. **Don't skip auth validation** - Call `validateAndRateLimit()` first

## TanStack Query Patterns

```typescript
// Query hook
export function useDomainsQuery() {
  return useQuery({
    queryKey: ["domains"],
    queryFn: fetchDomains,
  });
}

// Mutation with invalidation
export function useCreateDomainMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDomain,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["domains"] });
    },
  });
}
```

## Pagination Standard

All list endpoints return:
```typescript
{
  data: Item[],
  pagination: {
    limit: number,   // Items per page (default 50, max 100)
    offset: number,  // Skip count
    total: number,   // Total matching items
    hasMore: boolean // More items available
  }
}
```
