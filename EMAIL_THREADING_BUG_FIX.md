# Email Threading Bug Fix

## Problem Summary

Email threading was failing when recipients replied to sent emails. The system would create separate threads instead of continuing the conversation.

## Root Cause

When sending a reply via `/api/v2/emails/[id]/reply/route.ts`:

1. The system generates an internal Message-ID: `replyEmailId@domain` (e.g., `fvTSWOB8O8GR6GGUFfISP@inbound.new`)
2. This internal ID is stored in `sentEmails.messageId`
3. AWS SES sends the email and **generates its own Message-ID**: `010f019a21753878-...-000000@us-east-2.amazonses.com`
4. When a reply arrives, it references the **SES Message-ID** (not the internal one) in its `In-Reply-To` header
5. The threading matcher searches `sentEmails.messageId` for the SES ID but only finds the internal ID
6. **No match found** → New thread created ❌

## The Fix

### 1. Database Schema Change (`lib/db/schema.ts`)

Added a new column to store the AWS SES Message-ID separately:

```typescript
sesMessageId: varchar('ses_message_id', { length: 300 }), // AWS SES Message-ID (returned after sending, used for threading)
```

### 2. Database Migration (`drizzle/0050_add_ses_message_id_to_sent_emails.sql`)

```sql
ALTER TABLE "sent_emails" ADD COLUMN "ses_message_id" varchar(300);
CREATE INDEX "sent_emails_ses_message_id_idx" ON "sent_emails" USING btree ("ses_message_id");
```

### 3. Reply Endpoint Update (`app/api/v2/emails/[id]/reply/route.ts`)

Captures and stores the SES Message-ID after sending:

```typescript
const sesResponse = await sesClient.send(sesCommand);
const sesMessageId = sesResponse.MessageId;

await db
  .update(sentEmails)
  .set({
    status: SENT_EMAIL_STATUS.SENT,
    sesMessageId: sesMessageId, // ✅ Store SES Message-ID for threading lookups
    providerResponse: JSON.stringify(sesResponse),
    sentAt: new Date(),
    updatedAt: new Date(),
  })
  .where(eq(sentEmails.id, replyEmailId));
```

### 4. Threading Matcher Update (`lib/email-management/email-threader.ts`)

Checks **both** the internal `messageId` and the `sesMessageId` when looking for threads:

```typescript
const existingSentEmails = await db
  .select({ threadId: sentEmails.threadId })
  .from(sentEmails)
  .where(
    and(
      eq(sentEmails.userId, userId),
      or(
        ...Array.from(messageIds).map(id => eq(sentEmails.messageId, id)),
        ...Array.from(messageIds).map(id => eq(sentEmails.sesMessageId, id)) // ✅ Also check SES Message-ID
      ),
      isNotNull(sentEmails.threadId)
    )
  )
  .limit(1)
```

## How It Works Now

### Scenario: User sends email, recipient replies

**Step 1: Sending initial email**
- System generates: `messageId: "abc123@inbound.new"`
- Stores in `sentEmails.messageId`
- AWS SES sends and returns: `sesMessageId: "010f019a21753878-...@amazonses.com"`
- System stores in `sentEmails.sesMessageId` ✅

**Step 2: User replies to that email**
- System generates: `messageId: "def456@inbound.new"`
- `References: ["<010f019a21753878-...@amazonses.com>", "<original@gmail.com>"]`
- AWS SES sends and returns: `sesMessageId: "010f019a21753879-...@amazonses.com"`
- System stores in `sentEmails.sesMessageId` ✅

**Step 3: Recipient replies back**
- Email arrives with:
  ```
  In-Reply-To: <010f019a21753879-...@amazonses.com>
  References: <010f019a21753878-...@amazonses.com> <010f019a21753879-...@amazonses.com>
  ```
- Threading matcher extracts these Message-IDs
- Searches `sentEmails` for matches against **both** `messageId` AND `sesMessageId`
- **Match found** on `sesMessageId` ✅
- Returns existing `threadId`
- Continues conversation in same thread ✅

## Testing the Fix

### Prerequisites
1. Run the migration: `bun drizzle-kit push` or deploy to production
2. Ensure the database schema is updated

### Test Scenario (Reproducing Original Bug)

1. **Send first email from Slack**
   - POST to `/api/v2/emails/{emailId}/reply`
   - Note the returned `threadId` (e.g., `tiYOZgNqGsRSrg_ggK9JF`)

2. **Recipient replies to first email**
   - System should find thread and continue conversation
   - Check logs for: `🔗 Found existing thread in sent emails: tiYOZgNqGsRSrg_ggK9JF`

3. **Send second reply from Slack**
   - POST to `/api/v2/emails/{emailId}/reply` again
   - **Should return SAME threadId** (not a new one)

4. **Recipient replies to second email**
   - System should again find the thread via `sesMessageId` lookup
   - All emails should be in the **same thread**

### Expected Logs

```
🧵 EmailThreader - Processing email inbnd_xyz for threading
🔍 Looking for existing thread with message IDs: [..., "<010f019a21753878-...@us-east-2.amazonses.com>", ...]
🔗 Found existing thread in sent emails: tiYOZgNqGsRSrg_ggK9JF
✅ Email inbnd_xyz assigned to thread tiYOZgNqGsRSrg_ggK9JF at position 3
```

## Technical Notes

- **Backward Compatible**: Existing emails without `sesMessageId` will still work (matcher checks both fields)
- **Index Added**: Query performance maintained with index on `sesMessageId`
- **No Breaking Changes**: Internal `messageId` still used for email headers
- **SES-Specific**: This fix is specific to AWS SES; other providers would need similar handling

## Related Files

- `lib/db/schema.ts` - Schema definition
- `drizzle/0050_add_ses_message_id_to_sent_emails.sql` - Migration
- `app/api/v2/emails/[id]/reply/route.ts` - Reply endpoint
- `lib/email-management/email-threader.ts` - Threading matcher

## References

- Original issue: ChatGPT debugging session with user "sorinschiefelbein@gmail.com"
- RFC 5322 - Internet Message Format (Message-ID, In-Reply-To, References)
- Gmail threading behavior: Uses `In-Reply-To` and `References` headers
