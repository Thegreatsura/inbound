<!-- 892028a7-55ee-48a3-b7e2-e34a07d4a7ea 5d730c33-1b5a-4517-a564-0919cd250af6 -->
# Migrate to structuredEmails as Primary Table

## Overview

Make `structuredEmails` the single source of truth for inbound emails by removing all dependencies on deprecated `receivedEmails` and `parsedEmails` tables.

## Key Changes

### 1. Schema Updates (`lib/db/schema.ts`)

- Make `structuredEmails.emailId` self-referencing (initialize with `structuredEmails.id`)
- Update comment to clarify it's for backward compatibility only
- Keep field to avoid breaking existing queries

### 2. Webhook Handler (`app/api/inbound/webhook/route.ts`)

**Current flow:**

```typescript
// Creates receivedEmails record (id: nanoid())
// Creates parsedEmails record (emailId: receivedEmails.id)
// Creates structuredEmails record (emailId: receivedEmails.id)
// Routes using receivedEmails.id
```

**New flow:**

```typescript
// Creates structuredEmails ONLY (id: nanoid(), emailId: self-reference)
// Routes using structuredEmails.id
```

**Changes needed:**

- Remove `createParsedEmailRecord()` function call (line 884)
- Remove `receivedEmails` insert (line 868)
- Update `createStructuredEmailRecord()` to:
  - Generate ID with prefix: `id: 'inbnd_' + nanoid()`
  - Set `emailId: structuredEmailRecord.id` (self-referencing)
- Change `routeEmail()` call to use `structuredEmailRecord.id` instead of `emailRecord.id`
- Remove `receivedEmails` and `parsedEmails` from imports

### 3. Email Router (`lib/email-management/email-router.ts`)

**Already fixed:**

- `getEmailWithStructuredData()` now accepts `receivedEmails.id` (currently)

**Update needed:**

- Change to accept `structuredEmails.id` instead
- Update where clause from `.where(eq(structuredEmails.emailId, emailId))` to `.where(eq(structuredEmails.id, emailId))`

### 4. Legacy Webhook Function (`app/api/inbound/webhook/route.ts`)

The `triggerEmailAction()` function (lines 367-646):

- Currently queries from `receivedEmails` table
- Should query from `structuredEmails` directly
- Update to use `structuredEmails.id` as the primary key

### 5. Endpoint Deliveries

The `endpointDeliveries.emailId` field already references the correct ID:

- Comment says "Reference to structured_emails table" (line 386 in schema)
- Currently stores `receivedEmails.id` in practice
- Will automatically work with `structuredEmails.id` once webhook is updated

## Files to Update

1. `lib/db/schema.ts` - Schema comments
2. `app/api/inbound/webhook/route.ts` - Remove old table inserts, update routing
3. `lib/email-management/email-router.ts` - Update query to use structuredEmails.id

## What Stays Unchanged

- All v2 API endpoints (already use structuredEmails)
- Database tables (keep old tables for now, just stop using them)
- Frontend components (already work with structuredEmails.id)
- Webhook payloads (already send structuredEmails.id)

## Testing Needed

- Send test email through SES webhook
- Verify it creates only structuredEmails record
- Verify routing works with structuredEmails.id
- Verify delivery tracking works
- Verify /logs page displays correctly
- Verify webhook endpoints receive correct payload

### To-dos

- [ ] Update structuredEmails schema to add recipient field and make emailId self-referencing
- [ ] Create Drizzle migration for schema changes
- [ ] Refactor webhook POST handler to only insert into structuredEmails
- [ ] Update triggerEmailAction to query from structuredEmails directly
- [ ] Update EmailThreader.resolveEmailId to check structuredEmails.id
- [ ] Update all v2 API endpoints to query structuredEmails.id instead of receivedEmails
- [ ] Verify and update email-router.ts to use structuredEmails.id
- [ ] Add deprecation warnings to receivedEmails and parsedEmails schemas