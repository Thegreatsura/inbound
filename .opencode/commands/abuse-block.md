---
name: abuse-block
description: Dry-run and execute tenant abuse enforcement via admin API.
---

# abuse-block

Use this command to enforce abuse controls for a specific tenant with safe defaults.

## Safety

1. Default mode is dry-run.
2. Interactive execution requires `--execute` and a valid `--confirm` token from dry-run output.
3. Cron/non-interactive execution can use `--execute --auto-confirm`.
4. Always require an explicit `--reason` for execution.

## Modes

- Dry-run preview:
  - `bun run admin:abuse-block --tenant-id <id> --action <pause|suspend|cascade> --reason "<reason>" --json`
- Execute (interactive):
  - `bun run admin:abuse-block --tenant-id <id> --action <pause|suspend|cascade> --reason "<reason>" --execute --confirm <token> --json`
- Execute (cron/non-interactive):
  - `bun run admin:abuse-block --tenant-id <id> --action <pause|suspend|cascade> --reason "<reason>" --execute --auto-confirm --json`

## Action behavior

- Default cascade behavior:
  1) suspend tenant sending
  2) ban tenant owner user
  3) add sender domains to blocked signup list

## Inputs

- `--tenant-id <id>` required
- `--action <pause|suspend|cascade>` optional (default `cascade`)
- `--user-id <id>` optional override
- `--domains <csv>` optional override
- `--reason <text>` required for execute
- `--execute` optional (without it, dry-run)
- `--confirm <token>` required for interactive execute
- `--auto-confirm` optional for non-interactive execute
- `--json` optional

## Output contract

A) Target resolution (`tenant_id`, `user_id`, `domains`)
B) Current status + violation metrics (`sent`, `bounce_rate`, thresholds)
C) Confirmation token
D) Step-by-step action results (`executed` / `already_exists` / `failed`)
E) Final success/failure summary
F) Audit log path

## User Input & Steering

$ARGUMENTS
