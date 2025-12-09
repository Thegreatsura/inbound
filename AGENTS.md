# AGENTS.md - Inbound Email System

## Build/Test Commands
- `bun run dev` / `bun run build` - **Requires approval** before running
- `bun run lint` - Run Biome linter (enforces `noExplicitAny`)
- `bun test <file>` - Run single test (e.g., `bun test app/api/e2/domains/domains.test.ts`)
- `bun run test:e2` - All Elysia e2 API tests
- `bun run test-api` / `bun run test-sdk` - Run legacy API/SDK test suites
- `bun run generate:openapi` - Generate static OpenAPI spec
- **Never run** `bunx drizzle-kit generate/push` or `npx tsc` - prompt user to run manually

## Code Style
- **Package Manager**: Only `bun` (never npm/yarn/pnpm)
- **Imports**: Use `@/` path alias; group external -> local -> types
- **Types**: Find existing types in schemas (`lib/db/schema.ts`), don't duplicate; no explicit `any`
- **Database**: Use Drizzle ORM only (no raw SQL); use `structuredEmails` (NOT deprecated `receivedEmails`/`parsedEmails`)
- **Components**: Use variant props for styling, CSS variables from global.css; no custom colors/sizes/border-radius
- **Elysia responses**: Use status-code keyed objects `{ 200: Success, 400: Error }`, NOT `t.Union()`
- **No comments** unless explicitly requested; no unnecessary README files

## Architecture
- Next.js 15 + React 19, TanStack Query, Radix UI, Tailwind, Framer Motion
- API: Elysia routes in `app/api/e2/`, legacy v2 in `app/api/v2/`
- DB schema: `lib/db/schema.ts`, Features: `features/`
- AWS: CDK in `aws/cdk/`, Lambda in `lambda/`, deployment scripts in `scripts/`

## API Documentation (Elysia + Scalar)
- **Location**: `app/api/e2/[[...slugs]]/route.ts` - main Elysia app with `@elysiajs/openapi`
- **Docs URL**: `/api/e2/docs` (Scalar UI), `/api/e2/openapi.json` (raw spec)
- **SDK**: `inboundemail` on npm - use `x-scalar-sdk-installation` and `x-codeSamples` for SDK examples
- **Scalar Extensions**: `x-codeSamples` (per-operation SDK examples), `x-scalar-sdk-installation` (global install instructions), `x-tagGroups`, `x-scalar-stability` (`stable`/`experimental`/`deprecated`)
- **SDK Methods**: `client.domains.*`, `client.endpoints.*`, `client.emailAddresses.*`, `client.emails.*`, `client.mail.*`
