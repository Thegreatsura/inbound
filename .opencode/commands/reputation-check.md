---
name: reputation-check
description: Read-only 7d/30d bounce + complaint report per tenant, cross-checked against AWS, with high-risk offenders highlighted.
---

# reputation-check

Read-only reputation scan. For the given window(s), produce a per-tenant table of bounces and complaints from the DB, cross-check against AWS account-level historic rates, and flag any high-risk users that need operator attention.

## When to use

- Operator wants a quick snapshot of who is bouncing or getting complaint-flagged, and how bad it is.
- After a complaint-rate alert from AWS, to identify which tenant is the actual source.
- Before deciding whether to `pause` / `suspend` / `cascade` a tenant via `/abuse-block`.

This command is **analysis-only**. It must not pause, suspend, ban, or mutate anything. If action is warranted, it should name the exact `admin:abuse-block` invocation in the report and hand off to the operator.

## Data sources

- **Neon MCP (read-only)** for SQL access to the platform DB.
  - Project: `inbound-exon` (`curly-king-52150024`)
  - Primary branch: `production` (`br-blue-cherry-a56iiff9`)
- **AWS CLI helpers** (already wired into `package.json`):
  - `bun run aws:stats --days 7 --period-seconds 3600 --json` — account-level historic bounce + complaint rates
  - `bun run aws:stats --days 30 --period-seconds 3600 --json` — same, 30-day window
  - `bun run ses:status --tenant-ids <csv> --json` — per-tenant AWS sending status + reputation policy

## Naming convention (important)

- `ses_tenants.tenant_name` = `user-<userId>` (e.g. `user-abc123`)
- `ses_tenants.configuration_set_name` = `tenant-user-<userId>` (e.g. `tenant-user-abc123`)
- `ses_tenants.user_id` maps 1:1 to `user.id`

When the report says "tenant", display the `tenant_name` (i.e. `user-<id>`) alongside the user's email and name.

## Risk thresholds

Classify each tenant into one bucket based on their **genuine** rates in each window. Ignore tenants with fewer than 50 sends in the window unless their rates are extreme and the tenant is new.

| Severity   | Complaint rate           | Bounce rate              | Min volume |
|------------|--------------------------|--------------------------|------------|
| `critical` | `>= 0.1%`                | `>= 2.5%`                | `>= 1000` (complaint) / `>= 200` (bounce) |
| `high`     | `>= 0.08%`               | `>= 1.0%`                | `>= 500`   |
| `medium`   | `>= 0.05%`               | `>= 0.5%`                | `>= 200`   |
| `clean`    | below all of the above   | below all of the above   | any        |

A tenant is `high-risk` if they hit `high` or `critical` in **either** the 7d or the 30d window. A tenant that is only `medium` in 30d but `clean` in 7d is trending down and should be noted but not highlighted.

### Collateral damage filter

Do **not** count failures with `sent_emails.failure_reason = 'Sending paused for this account'` as tenant-attributable. That error is the AWS account-level pause bleeding into every tenant. If a tenant's elevated numbers disappear once those rows are excluded, flag them as `collateral-victim` rather than `high-risk`.

## SQL queries to run (via Neon MCP)

Run these in the `production` branch. All timestamps in `created_at` / `sent_at` are UTC.

### Query 1 — Per-tenant send volume (denominator) for 7d and 30d

```sql
SELECT
  t.id AS tenant_id,
  t.tenant_name,
  t.user_id,
  t.status AS tenant_status,
  t.configuration_set_name,
  u.email AS user_email,
  u.name AS user_name,
  u.banned AS user_banned,
  u.ban_reason AS user_ban_reason,
  COUNT(*) FILTER (
    WHERE se.status = 'sent'
      AND se.sent_at >= NOW() - INTERVAL '7 days'
  ) AS sent_7d,
  COUNT(*) FILTER (
    WHERE se.status = 'sent'
      AND se.sent_at >= NOW() - INTERVAL '30 days'
  ) AS sent_30d
FROM ses_tenants t
LEFT JOIN "user" u ON u.id = t.user_id
LEFT JOIN sent_emails se ON se.user_id = t.user_id
GROUP BY t.id, t.tenant_name, t.user_id, t.status, t.configuration_set_name,
         u.email, u.name, u.banned, u.ban_reason
HAVING COUNT(*) FILTER (
  WHERE se.status = 'sent' AND se.sent_at >= NOW() - INTERVAL '30 days'
) > 0
ORDER BY sent_30d DESC;
```

### Query 2 — Per-tenant bounces and complaints (numerator) for 7d and 30d

```sql
SELECT
  e.tenant_id,
  e.tenant_name,
  COUNT(*) FILTER (
    WHERE e.event_type = 'bounce'
      AND e.created_at >= NOW() - INTERVAL '7 days'
  ) AS bounces_7d,
  COUNT(*) FILTER (
    WHERE e.event_type = 'bounce'
      AND e.bounce_type = 'hard'
      AND e.created_at >= NOW() - INTERVAL '7 days'
  ) AS hard_bounces_7d,
  COUNT(*) FILTER (
    WHERE e.event_type = 'complaint'
      AND e.created_at >= NOW() - INTERVAL '7 days'
  ) AS complaints_7d,
  COUNT(*) FILTER (
    WHERE e.event_type = 'bounce'
      AND e.created_at >= NOW() - INTERVAL '30 days'
  ) AS bounces_30d,
  COUNT(*) FILTER (
    WHERE e.event_type = 'bounce'
      AND e.bounce_type = 'hard'
      AND e.created_at >= NOW() - INTERVAL '30 days'
  ) AS hard_bounces_30d,
  COUNT(*) FILTER (
    WHERE e.event_type = 'complaint'
      AND e.created_at >= NOW() - INTERVAL '30 days'
  ) AS complaints_30d
FROM email_delivery_events e
WHERE e.tenant_id IS NOT NULL
  AND e.created_at >= NOW() - INTERVAL '30 days'
GROUP BY e.tenant_id, e.tenant_name
ORDER BY complaints_30d DESC, bounces_30d DESC;
```

### Query 3 — Collateral-damage check (per tenant, 30d)

```sql
SELECT
  se.user_id,
  COUNT(*) FILTER (
    WHERE se.status = 'failed'
      AND se.failure_reason = 'Sending paused for this account'
  ) AS collateral_failures_30d,
  COUNT(*) FILTER (
    WHERE se.status = 'failed'
      AND (se.failure_reason IS NULL
           OR se.failure_reason <> 'Sending paused for this account')
  ) AS genuine_failures_30d
FROM sent_emails se
WHERE se.created_at >= NOW() - INTERVAL '30 days'
GROUP BY se.user_id
HAVING COUNT(*) FILTER (WHERE se.status = 'failed') > 0;
```

### Query 4 — Top complaint sources (for drill-down)

```sql
SELECT
  e.tenant_id,
  e.tenant_name,
  e.failed_recipient_domain,
  COUNT(*) AS complaint_count_7d
FROM email_delivery_events e
WHERE e.event_type = 'complaint'
  AND e.created_at >= NOW() - INTERVAL '7 days'
GROUP BY e.tenant_id, e.tenant_name, e.failed_recipient_domain
ORDER BY complaint_count_7d DESC
LIMIT 20;
```

### Query 5 — Recent complaint samples (for flagged tenants only)

For every tenant you classify as `high` or `critical`, pull 5 recent complaints so the operator can see where the pain is coming from:

```sql
SELECT
  e.created_at,
  e.failed_recipient,
  e.original_subject,
  e.original_from,
  e.original_sent_at
FROM email_delivery_events e
WHERE e.event_type = 'complaint'
  AND e.tenant_id = $1
ORDER BY e.created_at DESC
LIMIT 5;
```

## Workflow

Run these steps in order.

1. **Parse args** from `$ARGUMENTS` (optional):
   - `--window 7d|30d|both` (default: `both`)
   - `--tenant-id <id>` to scope the report to a single tenant
   - `--user-id <id>` to scope by user
   - `--min-sends <n>` override the default min-volume filter
   - If nothing passed, do a full scan across all tenants with `sent_30d > 0`.

2. **Pull account-level AWS context** so per-tenant rates have a backdrop:
   - `bun run aws:stats --days 7 --period-seconds 3600 --json`
   - `bun run aws:stats --days 30 --period-seconds 3600 --json`
   - Record `historicBounceRatePercent`, `historicComplaintRatePercent`, and `bounceStatus` / `complaintStatus` for each window.

3. **Run the DB queries** above via Neon MCP. Combine Query 1 + Query 2 into one joined result on `tenant_id`, computing:
   - `bounce_rate_7d = bounces_7d / NULLIF(sent_7d, 0)`
   - `complaint_rate_7d = complaints_7d / NULLIF(sent_7d, 0)`
   - `bounce_rate_30d = bounces_30d / NULLIF(sent_30d, 0)`
   - `complaint_rate_30d = complaints_30d / NULLIF(sent_30d, 0)`

4. **Apply the collateral damage filter** (Query 3). Subtract `collateral_failures_30d` from any reject-based signals before classification.

5. **Classify** each tenant using the severity table above. Build three lists: `critical`, `high`, `medium`. Anything else is `clean` and doesn't need to be listed.

6. **Enrich flagged tenants with AWS-side status** (only the `critical` + `high` lists):
   - `bun run ses:status --tenant-ids <csv of flagged tenant_ids> --json`
   - Capture `aws_sending_status`, `config_set_sending_enabled`, `aws_reputation_policy`, and any `user_banned` / `ban_reason`.

7. **For each critical / high tenant**, run Query 5 to pull 5 recent complaint samples for context.

8. **Emit the report** in the structure below.

## Report structure

Produce output that reads top-to-bottom as a scannable operator brief.

### 1. Verdict line

One line, format:

```
REPUTATION-CHECK — <N_CRITICAL> critical, <N_HIGH> high, <N_MEDIUM> medium  |  AWS account: <bounceStatus> / <complaintStatus>
```

Example: `REPUTATION-CHECK — 1 critical, 2 high, 0 medium  |  AWS account: HEALTHY / WARNING`

### 2. AWS account context

| Window | Historic bounce | Status | Historic complaint | Status |
|--------|-----------------|--------|--------------------|--------|
| 7d     | 2.1%            | HEALTHY | 0.12%             | WARNING |
| 30d    | 1.8%            | HEALTHY | 0.09%             | HEALTHY |

Note thresholds: AWS bounce WARNING `>= 5%` / AT-RISK `>= 10%`, complaint WARNING `>= 0.1%` / AT-RISK `>= 0.5%`.

### 3. High-risk offenders

For each `critical` and `high` tenant, one block per tenant:

```
Severity: CRITICAL
Tenant:   user-abc123   (tenant_id: tenant_XXXXX)
User:     Jane Doe <jane@example.com>
Status:   tenant=active  user_banned=false  aws_sending=ENABLED  config_set_sending=true  policy=strict

              sent     bounces  (hard)   rate     complaints  rate
  7d         12,430   85        40      0.68%    18          0.145%  <-- exceeds complaint critical
  30d        48,211   312       150     0.65%    52          0.108%  <-- exceeds complaint critical

  Recent complaint samples:
    2026-04-20 14:12  recipient@gmail.com   subject: "Final notice — overdue invoice"
    2026-04-20 11:03  recipient@yahoo.com   subject: "Final notice — overdue invoice"
    ...

  Recommended action:
    bun run admin:abuse-block --tenant-id tenant_XXXXX --action suspend \
      --reason "complaint rate 0.145% in 7d (18 complaints / 12430 sent)" --json
```

### 4. Medium / watchlist

Compact table — no samples needed:

| tenant | user | 7d sent | 7d bnc% | 7d cmp% | 30d sent | 30d bnc% | 30d cmp% |
|--------|------|---------|---------|---------|----------|----------|----------|
| user-xyz | a@b.com | 620 | 0.6% | 0.06% | 3,410 | 0.7% | 0.07% |

### 5. Collateral damage (if any)

List tenants whose raw failure numbers looked bad but are dominated by `"Sending paused for this account"`. These are victims, not offenders. One-line each.

### 6. Clean summary

Aggregate-only — do not enumerate clean tenants:

```
Clean tenants: 142 (total 30d sends: 4.2M,  bounces: 0.4%,  complaints: 0.02%)
```

### 7. Data gaps

Note anything that limits confidence:
- tenants with `sent_30d < 50` that were excluded from classification
- any Neon MCP query errors
- any AWS CLI failures when enriching flagged tenants
- complaint events with `tenant_id IS NULL` (orphaned attribution — how many)

### 8. Audit reference

At the bottom, always include the full list of flagged `tenant_id`s and `user_id`s (critical + high + medium), comma-separated, so the operator can copy them into follow-up commands.

## Rules and guardrails

1. **Read-only.** Never run `admin:abuse-block` or any mutation. Only recommend it.
2. **Neon MCP only** for SQL. Never run destructive SQL.
3. **Respect `$ARGUMENTS` scope** — if `--tenant-id` or `--user-id` is passed, limit all queries and reporting to that entity.
4. **Prefer `tenant_name` display** over raw IDs in tables (but always include the raw `tenant_id` next to it for copy-paste).
5. **Always surface the fix context**: if the DB shows zero complaints across all tenants for a window, note that prominently — it may indicate the SES event ingestion path is still broken (see `app/api/inbound/health/tenant/route.ts:286`).

## User Input & Steering

$ARGUMENTS
