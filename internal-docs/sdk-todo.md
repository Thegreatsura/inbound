# SDK Export TODO

## Package Migration: `@inboundemail/sdk` → `inboundemail`

We have two SDK packages installed:
- `@inboundemail/sdk` (v4.0.0) - Old manually-maintained SDK with webhook types and different API
- `inboundemail` (v0.18.0) - New Stainless-generated SDK

### Migration Status

**Documentation and public-facing code** now references `inboundemail` (the new package name).

**Internal code** still uses `@inboundemail/sdk` because:
1. The npm-published `inboundemail` package (v0.18.0) doesn't have webhook types yet
2. The API is different (new SDK uses `new Inbound()` and returns responses directly, old SDK uses `new Inbound(apiKey)` and returns `{ data, error }`)

The local SDK source (`packages/inbound-typescript-sdk/`) has the webhook types, but they haven't been published to npm yet.

## Types Available in Local SDK (Not Yet Published)

The following exports exist in `packages/inbound-typescript-sdk/src/index.ts`:

```typescript
// Webhook types and helpers
export {
  type InboundWebhookPayload,
  type InboundEmail,
  type InboundEmailAddress,
  type InboundEmailAddressField,
  type InboundAttachment,
  type InboundParsedEmailData,
  type InboundCleanedContent,
  type InboundEndpointInfo,
  isInboundWebhookPayload,
  verifyWebhook,
  verifyWebhookFromHeaders,
} from "./lib/webhook";
```

## Internal Code Using `@inboundemail/sdk`

These files still use the old SDK because the npm package isn't updated yet:

- `lib/auth/auth.ts` - Magic link sending
- `lib/email-management/email-notifications.ts` - Domain verification emails
- `app/api/webhooks/daily-usage/route.ts` - Usage reports
- `app/actions/primary.ts` - Threads waitlist
- `app/api/e2/endpoints/test.ts` - Test endpoint types
- `app/api/v2/endpoints/[id]/test/route.ts` - Test endpoint types
- `app/actions/feedback.ts`
- `app/actions/ambassador.ts`
- `app/actions/dns-setup.ts`
- `app/api/v2/onboarding/demo/route.ts`
- `app/api/v2/onboarding/webhook/route.ts`
- `app/vercel-oss-program/actions.ts`

### Action Items

- [x] Update docs and user-facing examples to use `inboundemail`
- [x] Add webhook types to local SDK source
- [ ] Publish updated `inboundemail` package to npm with webhook exports
- [ ] Update internal code to use `inboundemail` instead of `@inboundemail/sdk`
- [ ] Remove `@inboundemail/sdk` dependency from package.json
