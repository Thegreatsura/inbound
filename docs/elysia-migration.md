# Elysia Migration Checklist (v2 → e2)

This document tracks the migration progress from Next.js API routes (`/api/v2`) to Elysia (`/api/e2`).

## Legend

- ✅ Completed
- 🚧 In Progress
- ❌ Not Started

---

## Domains

| Route | Method | v2 Path | e2 Status |
|-------|--------|---------|-----------|
| List domains | GET | `/api/v2/domains` | ✅ `list.ts` |
| Create domain | POST | `/api/v2/domains` | ✅ `create.ts` |
| Get domain | GET | `/api/v2/domains/[id]` | ✅ `get.ts` |
| Update domain | PUT | `/api/v2/domains/[id]` | ✅ `update.ts` |
| Patch domain | PATCH | `/api/v2/domains/[id]` | ✅ `update.ts` |
| Delete domain | DELETE | `/api/v2/domains/[id]` | ✅ `delete.ts` |
| Initialize domain auth | POST | `/api/v2/domains/[id]/auth` | ✅ Consolidated into `create.ts` |
| Verify domain auth | PATCH | `/api/v2/domains/[id]/auth` | ✅ Consolidated into `get.ts?check=true` |
| Get DNS records | GET | `/api/v2/domains/[id]/dns-records` | ✅ Consolidated into `get.ts` (returns `dnsRecords`) |

---

## Endpoints

| Route | Method | v2 Path | e2 Status |
|-------|--------|---------|-----------|
| List endpoints | GET | `/api/v2/endpoints` | ✅ `list.ts` |
| Create endpoint | POST | `/api/v2/endpoints` | ✅ `create.ts` |
| Get endpoint | GET | `/api/v2/endpoints/[id]` | ✅ `get.ts` |
| Update endpoint | PUT | `/api/v2/endpoints/[id]` | ✅ `update.ts` |
| Delete endpoint | DELETE | `/api/v2/endpoints/[id]` | ✅ `delete.ts` |
| Test endpoint | POST | `/api/v2/endpoints/[id]/test` | ✅ `test.ts` |

---

## Email Addresses

| Route | Method | v2 Path | e2 Status |
|-------|--------|---------|-----------|
| List email addresses | GET | `/api/v2/email-addresses` | ❌ |
| Create email address | POST | `/api/v2/email-addresses` | ❌ |
| Get email address | GET | `/api/v2/email-addresses/[id]` | ❌ |
| Update email address | PUT | `/api/v2/email-addresses/[id]` | ❌ |
| Delete email address | DELETE | `/api/v2/email-addresses/[id]` | ❌ |

---

## Mail (NEW - Consolidates Threads + Emails)

> **Design goal**: Unified inbox API. Replaces v2 `/threads`, `/emails`, and related routes.

| Route | Method | e2 Path | Description | Status |
|-------|--------|---------|-------------|--------|
| List threads | GET | `/mail` | Inbox view with filtering | ❌ |
| Get email | GET | `/mail/:id` | Single email details | ❌ |
| Send email | POST | `/mail` | Send new email | ❌ |
| Reply to email | POST | `/mail/:id/reply` | Reply in thread | ❌ |
| Update email | PATCH | `/mail/:id` | Archive, mark read, cancel scheduled | ❌ |

### `GET /mail` - List Threads (Inbox)

Query parameters for filtering:

| Param | Type | Description |
|-------|------|-------------|
| `domain` | `string` | Filter by domain ID or domain name |
| `addresses` | `string[]` | Filter by email address ID(s) - comma-separated |
| `status` | `enum` | `all` \| `unread` \| `archived` |
| `type` | `enum` | `all` \| `received` \| `sent` \| `scheduled` |
| `limit` | `number` | Pagination limit (default: 50) |
| `cursor` | `string` | Cursor for pagination |

**Response**: Returns thread summaries with latest message preview, participant info, unread count.

```ts
interface ThreadSummary {
  id: string
  subject: string
  participants: { email: string; name?: string }[]
  latestMessage: {
    id: string
    snippet: string      // First ~100 chars
    sentAt: Date
    direction: 'inbound' | 'outbound'
  }
  messageCount: number
  unreadCount: number
  hasAttachments: boolean
  status: 'active' | 'archived'
  createdAt: Date
  updatedAt: Date
}
```

### `GET /mail/:id` - Get Email

Returns full email details (works for sent, received, or scheduled).

```ts
interface Email {
  id: string
  threadId: string
  direction: 'inbound' | 'outbound'
  status: 'delivered' | 'pending' | 'scheduled' | 'failed' | 'bounced'
  
  from: { email: string; name?: string }
  to: { email: string; name?: string }[]
  cc?: { email: string; name?: string }[]
  bcc?: { email: string; name?: string }[]
  replyTo?: string
  
  subject: string
  bodyText?: string
  bodyHtml?: string
  
  attachments?: {
    id: string
    filename: string
    contentType: string
    size: number
    url: string  // Presigned URL
  }[]
  
  // For scheduled emails
  scheduledFor?: Date
  
  // Tracking
  sentAt?: Date
  receivedAt?: Date
  openedAt?: Date
  
  metadata?: Record<string, unknown>
}
```

### `POST /mail` - Send Email

```ts
interface SendEmailRequest {
  from: string              // Must be verified address
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  replyTo?: string
  
  subject: string
  text?: string
  html?: string
  
  attachments?: {
    filename: string
    content: string         // Base64
    contentType: string
  }[]
  
  // Optional scheduling
  scheduledFor?: Date       // ISO string - if set, schedules instead of sends
  
  // Optional thread linking
  threadId?: string         // Links to existing thread
  
  metadata?: Record<string, unknown>
}
```

### `POST /mail/:id/reply` - Reply to Email

```ts
interface ReplyRequest {
  text?: string
  html?: string
  
  // Override recipients (defaults to reply-all behavior)
  to?: string | string[]
  cc?: string | string[]
  
  attachments?: {
    filename: string
    content: string
    contentType: string
  }[]
  
  scheduledFor?: Date
}
```

### `PATCH /mail/:id` - Update Email

```ts
interface UpdateEmailRequest {
  // For any email
  isRead?: boolean
  isArchived?: boolean
  
  // For scheduled emails only
  cancel?: boolean          // Cancels scheduled send
  scheduledFor?: Date       // Reschedule
}
```

---

## Attachments

| Route | Method | v2 Path | e2 Status |
|-------|--------|---------|-----------|
| Get attachment | GET | `/api/v2/attachments/[id]/[filename]` | ❌ → May consolidate into `GET /mail/:id` response |

---

## Summary

| Category | Routes | Completed | Remaining |
|----------|--------|-----------|-----------|
| Domains | 9 | 9 | 0 |
| Endpoints | 6 | 6 | 0 |
| Email Addresses | 5 | 0 | 5 |
| Mail (unified) | 5 | 0 | 5 |
| Attachments | 1 | 0 | 1 |
| **Total** | **26** | **15** | **11** |

---

## Notes

- The e2 API uses Elysia with OpenAPI documentation at `/api/e2/docs`
- All routes use `Bearer <api-key>` authentication
- Endpoints module includes `validation.ts` for shared validation schemas
- **Consolidation approach**: Sub-routes are consolidated into main CRUD endpoints where possible:
  - Domain auth/DNS → consolidated into `get.ts` (with `?check=true` query param)
  - Domain creation sets up SES identity automatically
- **Not migrating**: Guard, Mail (v2 inbox), and Onboarding routes (internal/deprecated)
- **Mail redesign**: v2 `/threads` + `/emails` consolidated into unified `/mail` API
