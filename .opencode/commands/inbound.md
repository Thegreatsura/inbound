---
name: inbound
description: Operator-focused abuse triage with concise summaries and optional cascade enforcement via admin API.
---

# inbound

Use this command for SES abuse-response triage with an operator-first workflow: quick risk summary, offender IDs, and optional immediate cascade enforcement.

## Data sources

- Use the `inbound` subagent for read-only Neon analysis.
- Project: `inbound-exon` (`curly-king-52150024`)
- Primary branch: `production` (`br-blue-cherry-a56iiff9`)
- Use repo context from `~/inbound`.

## Safety rules

1. Default to analysis-only.
2. Never execute destructive SQL.
3. Only run enforcement actions when explicit execute intent is present (`--execute`) or when cron mode is enabled (`--cron`).
4. In cron mode, do not ask follow-up questions before enforcement.
5. SQL is opt-in only (`--include-sql`).

## Default behavior (concise mode)

If `$ARGUMENTS` is empty, run with:

- Window: past 7d and past 30d (UTC)
- Thresholds:
  - Critical bounce: `>= 2.5%` with `sent >= 200`
  - Critical complaint: `>= 0.1%` with `sent >= 1000`
  - Medium high-volume: `sent >= 500` and bounce `>= 1.0%`
  - Hourly cap: users/tenants at `>= 500` sent in the last hour
- Output: concise operator report only (no raw SQL)

## Arguments and modes

Interpret `$ARGUMENTS` as operator controls:

- `--window <preset>` where preset is `24h`, `7d`, or `30d`
- `--tenant-ids <csv>` explicitly target tenant IDs
- `--domain-ids <csv>` explicitly target domain IDs
- `--action pause|suspend|cascade` prepares action for listed/candidate tenant IDs
- `--execute` executes actions (without this, action is dry-run)
- `--cron` enables non-interactive execution mode for automation
- `--auto-enforce` apply action across all critical offenders automatically
- `--include-sql` include SQL appendix (statements only, never executed)
- `--verbose` include expanded diagnostic detail

When arguments are not provided, infer candidates from analysis and keep output concise.

## Workflow

1. Resolve windows from `$ARGUMENTS` or defaults.
2. Run read-only abuse analysis and produce:
   - concise risk summary
   - offender IDs (`tenant_ids`, `user_ids`, `domain_ids`)
   - top recipient-domain risk clusters
   - attribution gaps
3. Validate AWS status for candidate IDs:
   - `bun run ses:status --tenant-ids <csv> --domain-ids <csv> --json`
4. If `--action` is present:
   - Dry-run preview (default):
     - `bun run admin:abuse-block --tenant-id <id> --action <pause|suspend|cascade> --reason "<reason>" --json`
   - Interactive execute:
     - `bun run admin:abuse-block --tenant-id <id> --action <pause|suspend|cascade> --reason "<reason>" --execute --confirm <token> --json`
   - Cron/non-interactive execute:
     - `bun run admin:abuse-block --tenant-id <id> --action <pause|suspend|cascade> --reason "<reason>" --execute --auto-confirm --json`
   - Action semantics:
     - `pause`: pause tenant only
     - `suspend`: suspend tenant only
     - `cascade`: suspend tenant + ban user + add sender domains to blocked signup list
5. If `--auto-enforce` is present, execute action for each critical offender automatically.
6. Include SQL appendix only when `--include-sql` is explicitly requested.

## Output contract

Default response sections (no SQL):

A) Risk Summary
- severity (`critical`/`high`/`medium`)
- impacted tenants/users/domains counts
- baseline deltas (if available)

B) Offender IDs
- `tenant_ids`: deduped candidate IDs
- `user_ids`: deduped candidate IDs
- `domain_ids`: deduped candidate IDs

C) Current Status Matrix
- each offender with: tenant status, user banned status, domain blocked status, AWS verification notes

D) Enforcement Actions
- per offender narrative: user + domains + sent volume + bounce/complaint rates + violated thresholds + action taken
- include `already_exists` vs `executed` vs `failed`

E) Reference Legend
- append exact IDs used for audit: tenant IDs, user IDs, domain IDs, and audit log paths

F) Data Gaps
- attribution gaps and confidence notes

Optional section:
- SQL Appendix (only with `--include-sql`)

## User Input & Steering

$ARGUMENTS
