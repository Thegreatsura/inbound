# SDK Export TODO

## Package Migration: `@inboundemail/sdk` → `inboundemail`

We have two SDK packages installed:
- `@inboundemail/sdk` (v4.0.0) - Old manually-maintained SDK with webhook types
- `inboundemail` (v0.18.0) - New Stainless-generated SDK

### Migration Status

The docs and public-facing code should reference `inboundemail` (the new package name).

However, some internal code still uses `@inboundemail/sdk` because the new package is missing type exports.

## Missing Type Exports from `inboundemail` Package

The following types need to be exported from the `inboundemail` SDK package for use in webhook handling and other integrations:

### Types to Export

```typescript
// Webhook payload types
export type { InboundWebhookPayload } from './resources/webhooks'
export type { InboundEmailAddress } from './resources/emails'
export type { InboundEmailHeaders } from './resources/emails'

// Webhook verification helpers
export { verifyWebhook, verifyWebhookFromHeaders } from './lib/webhook'
```

### Current Usage in Codebase

These types are currently imported from `@inboundemail/sdk` (old package) in:

1. `app/api/e2/endpoints/test.ts` - Uses `InboundWebhookPayload`, `InboundEmailAddress`, `InboundEmailHeaders`
2. `app/api/e2/[[...slugs]]/route.ts` - References in webhook documentation examples

### Docs References

The docs (`/docs/*.mdx`) reference `inboundemail` (new package name) for:
- `import { Inbound } from 'inboundemail'`
- `import type { InboundWebhookPayload } from 'inboundemail'`
- `import { verifyWebhookFromHeaders } from 'inboundemail'`

These will work once the types are exported from the new package.

### Action Items

- [ ] Add type exports to `inboundemail` SDK's main `index.ts` in Stainless
- [ ] Export webhook verification helpers: `verifyWebhook`, `verifyWebhookFromHeaders`
- [ ] Update SDK version and publish to npm
- [ ] Update internal code to use `inboundemail` instead of `@inboundemail/sdk`
- [ ] Remove `@inboundemail/sdk` dependency from package.json
