# security-agent

Generic Bun HTTP wrapper around OpenCode slash commands.

## What it does

- Exposes `POST /run` with bearer auth (`SERVICE_API_KEY`)
- Runs OpenCode slash commands such as `/inbound` and `/abuse-block`
- Creates an OpenCode session (or reuses `sessionID` when provided)
- Supports optional `args`, `context`, `directory`, `model`, `agent`, and per-request `timeoutMs`

## Local run

1. Install package deps:

```bash
cd packages/security-agent
bun install
```

2. Create env file:

```bash
cp .env.example .env
```

3. Start server:

```bash
bun run dev
```

By default it listens on `0.0.0.0:8788`.

## API

### `POST /run`

Headers:

- `Authorization: Bearer <SERVICE_API_KEY>`
- `Content-Type: application/json`

Body:

```json
{
  "command": "/inbound",
  "args": "--window 7d",
  "context": {
    "reason": "review elevated bounce clusters"
  },
  "timeoutMs": 120000,
  "directory": "/Users/ryanvogel/dev/inbound-org/inbound"
}
```

Sample curl:

```bash
curl -sS -X POST http://localhost:8788/run \
  -H "Authorization: Bearer $SERVICE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "command":"/abuse-block",
    "args":"--tenant-id tnt_123 --action cascade --execute --auto-confirm --reason \"abuse threshold exceeded\""
  }'
```

## Environment checklist

### Required

- `SERVICE_API_KEY`: bearer token checked by this server
- `OPENCODE_BASE_URL`: URL for the OpenCode server this service calls

### Required for slash workflow in this repo

- `INBOUND_API_KEY`: required by `scripts/admin-abuse-block.ts` for admin API actions
- `DATABASE_URL`: required by DB-backed scripts invoked by workflows

### OpenCode runtime

- `OPENCODE_BASE_URL` (required)
- The security-agent service connects to an existing OpenCode server at this URL.

### Model/provider auth (required based on provider used by your OpenCode config)

- Common examples:
  - `OPENAI_API_KEY`
  - `ANTHROPIC_API_KEY`
  - `OPENCODE_ZEN_KEY`
- Optional defaults passed per request fallback:
  - `OPENCODE_MODEL`
  - `OPENCODE_AGENT`

### AWS variables used by abuse/SES scripts (optional unless command path executes SES checks/actions)

- `AWS_REGION` (defaults to `us-east-2` in scripts if omitted)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ACCOUNT_ID`

### Optional behavior/config

- `INBOUND_API_BASE_URL`: override default admin API base URL used by scripts
- `ABUSE_ACTION_AUDIT_DIR`: audit output directory for abuse action logs
- `SECURITY_AGENT_HOST`, `SECURITY_AGENT_PORT`, `SECURITY_AGENT_TIMEOUT_MS`

### MCP usage (optional)

Only needed if your OpenCode config enables MCP servers for this workflow.
Set the env vars referenced by your MCP server config (for example `GITHUB_TOKEN`, `NEON_API_KEY`, or provider-specific API keys).
