<!-- 57460299-9329-45d2-98aa-0fbad5851fac 820f0e86-89c2-415c-ab12-bf8a408391d4 -->
# Migrate Emails and Mail API to e2 (Consolidated)

## Summary

Simplified API with two main resources: `/emails` for all email operations and `/mail` for inbox/thread views. Consolidates 20+ v2-legacy routes into 9 focused endpoints.

## Route Structure

### Emails (All Email Operations)

| Route | Method | Path | Description |

|-------|--------|------|-------------|

| Send email | POST | `/emails` | Send email (supports `scheduledAt` param for scheduling) |

| List emails | GET | `/emails` | List all emails with filters (type: sent/received/scheduled/all) |

| Get email | GET | `/emails/:id` | Get any email by ID (sent, received, or scheduled) |

| Cancel scheduled | DELETE | `/emails/:id` | Cancel a scheduled email |

| Reply | POST | `/emails/:id/reply` | Reply to an email (should be able to accept emailID or threadID (responding to latest email in thread) |

| Retry | POST | `/emails/:id/retry` | Retry delivery (covers resend + retry-delivery) |

### Mail (Inbox & Thread Views)

| Route | Method | Path | Description |

|-------|--------|------|-------------|

| List inbox | GET | `/mail` | List emails filtered by domain or address |

| List threads | GET | `/mail/threads` | Get thread summaries for domain/address |

| Get thread | GET | `/mail/threads/:id` | Get all emails in a thread |

## File Structure

```
app/api/e2/
├── emails/
│   ├── send.ts          # POST /emails
│   ├── list.ts          # GET /emails
│   ├── get.ts           # GET /emails/:id
│   ├── cancel.ts        # DELETE /emails/:id
│   ├── reply.ts         # POST /emails/:id/reply
│   └── retry.ts         # POST /emails/:id/retry
└── mail/
    ├── list.ts          # GET /mail
    ├── threads-list.ts  # GET /mail/threads
    └── threads-get.ts   # GET /mail/threads/:id
```

## Implementation Details

### POST /emails - Send Email

Request body includes optional `scheduled_at` for scheduling:

```typescript
interface SendEmailRequest {
  from: string
  to: string | string[]
  subject: string
  html?: string
  text?: string
  cc?: string | string[]
  bcc?: string | string[]
  reply_to?: string | string[]
  headers?: Record<string, string>
  attachments?: Attachment[]
  tags?: { name: string; value: string }[]
  scheduled_at?: string   // Optional: ISO 8601 or natural language
  timezone?: string       // For natural language parsing
}
```

### GET /emails - List Emails

Query parameters:

| Param | Type | Description |

|-------|------|-------------|

| `type` | enum | `all` / `sent` / `received` / `scheduled` (default: all) |

| `status` | enum | `delivered` / `pending` / `failed` / `bounced` |

| `limit` | number | Pagination limit (default: 50, max: 100) |

| `offset` | number | Pagination offset |

| `domain` | string | Filter by domain ID or name |

| `address` | string | Filter by email address ID |

### GET /emails/:id - Get Email

Returns unified email object regardless of type (sent, received, scheduled). Response includes `type` field to indicate which it is.

### GET /mail - List Inbox

Query parameters:

| Param | Type | Description |

|-------|------|-------------|

| `domain` | string | Filter by domain ID or name |

| `address` | string | Filter by email address ID |

| `status` | enum | `all` / `unread` / `archived` |

| `limit` | number | Pagination limit |

| `offset` | number | Pagination offset |

### GET /mail/threads - List Threads

Query parameters:

| Param | Type | Description |

|-------|------|-------------|

| `domain` | string | Filter by domain ID or name |

| `address` | string | Filter by email address ID |

| `limit` | number | Pagination limit |

| `cursor` | string | Cursor for pagination |

### GET /mail/threads/:id - Get Thread

Returns all emails in the thread with full details.

## v2-legacy Consolidation Map

| v2-legacy Route | e2 Route | Notes |

|-----------------|----------|-------|

| POST `/emails` | POST `/emails` | Add `scheduled_at` support |

| POST `/emails/schedule` | POST `/emails` | Via `scheduled_at` param |

| GET `/emails/schedule` | GET `/emails?type=scheduled` | Filter param |

| GET `/emails/schedule/:id` | GET `/emails/:id` | Unified get |

| DELETE `/emails/schedule/:id` | DELETE `/emails/:id` | Cancel scheduled |

| PATCH `/emails/schedule/:id` | POST `/emails/:id/retry` | Reschedule = cancel + resend |

| GET `/emails/:id` | GET `/emails/:id` | Unified get |

| POST `/emails/:id/reply` | POST `/emails/:id/reply` | Same |

| POST `/emails/:id/resend` | POST `/emails/:id/retry` | Consolidated |

| POST `/emails/:id/retry-delivery` | POST `/emails/:id/retry` | Consolidated |

| POST `/emails/batch` | Removed | Multiple individual requests |

| GET `/mail` | GET `/mail` | Same |

| GET `/mail/:id` | GET `/emails/:id` | Unified get |

| PATCH `/mail/:id` | PATCH via `/mail` | TBD if needed |

| GET `/mail/:id/thread` | GET `/mail/threads/:id` | Moved |

| POST `/mail/bulk` | Removed | Individual requests |

| POST `/mail/thread-counts` | Removed | Not needed |

| GET `/threads` | GET `/mail/threads` | Moved under mail |

| GET `/threads/:id` | GET `/mail/threads/:id` | Moved |

| GET `/threads/stats` | Removed | Not needed |

| POST `/threads/:id/actions` | Removed | Use individual endpoints |

## Key v2-legacy Files to Reference

| File | Maps To |

|------|---------|

| [app/api/v2-legacy/emails/route.ts](app/api/v2-legacy/emails/route.ts) | `emails/send.ts` |

| [app/api/v2-legacy/emails/[id]/route.ts](app/api/v2-legacy/emails/[id]/route.ts) | `emails/get.ts` |

| [app/api/v2-legacy/emails/[id]/reply/route.ts](app/api/v2-legacy/emails/[id]/reply/route.ts) | `emails/reply.ts` |

| [app/api/v2-legacy/mail/route.ts](app/api/v2-legacy/mail/route.ts) | `mail/list.ts` |

| [app/api/v2-legacy/threads/route.ts](app/api/v2-legacy/threads/route.ts) | `mail/threads-list.ts` |

| [app/api/v2-legacy/threads/[id]/route.ts](app/api/v2-legacy/threads/[id]/route.ts) | `mail/threads-get.ts` |

We can implement this, but when you are implementing each of the routes, so like when you're about to start a new route, go and read over what we did in the v2 routes, the v2 legacy stuff, because I am very sure there's an explicit reason for everything that we have there, whether that be security or anything else, and we want to make sure that we don't lose any of the changes that we've done just to your my mistake. We need to be very thorough about this.

### To-dos

- [ ] Create emails/send.ts - POST /emails (with scheduled_at support)
- [ ] Create emails/list.ts - GET /emails (with type/status filters)
- [ ] Create emails/get.ts - GET /emails/:id (unified for sent/received/scheduled)
- [ ] Create emails/cancel.ts - DELETE /emails/:id (cancel scheduled)
- [ ] Create emails/reply.ts - POST /emails/:id/reply
- [ ] Create emails/retry.ts - POST /emails/:id/retry
- [ ] Create mail/list.ts - GET /mail (inbox with domain/address filter)
- [ ] Create mail/threads-list.ts - GET /mail/threads
- [ ] Create mail/threads-get.ts - GET /mail/threads/:id
- [ ] Register all routes in route.ts and add OpenAPI tags
- [ ] Register all routes in route.ts and add OpenAPI tag