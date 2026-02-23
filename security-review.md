# Inbound Security Review Prompt

Use this prompt with the `inbound` subagent whenever you want a repeatable incident scan for SES abuse, bounce spikes, and suspension candidates.

## Copy/paste prompt for `@inbound`

```text
You are the Inbound specialist with Neon DB + repo access. Run a read-only security review for SES abuse and deliverability risk. Do NOT execute destructive updates.

Use UTC windows:
- 24h: now-24h to now
- 7d: now-7d to now
- prior-7d baseline: now-14d to now-7d

Threshold policy:
- Critical bounce offender: bounce_rate >= 2.5% with sent_count >= 200
- Critical complaint offender: complaint_rate >= 0.1% with sent_count >= 1000
- Medium high-volume risk: sent_count >= 500 and bounce_rate >= 1.0%
- Hourly platform guardrail: user send volume should not exceed 500 sent emails in any rolling 1h window by default

Tasks:
1) Compute platform metrics: sends, bounces, complaints, bounce/complaint rates for 24h, 7d, and prior-7d baseline.
2) Identify offending tenants/users/sender domains for 24h and 7d with risk flags and exact IDs.
3) Include banned/suspended state for users and tenants.
4) Identify top recipient-domain clusters by bounce_sub_type in 24h and 7d (policy_rejection/user_unknown/etc).
5) Quantify attribution gaps (null user_id/tenant_id/domain_id) and confidence impact.
6) Return deduplicated disable-candidate lists for tenant_ids, user_ids, domain_ids.
7) Identify users/tenants currently at or over 500 sent emails in the last hour.
8) Provide SQL statements only (not executed):
   - diagnostics queries
   - suspend tenant updates by ID
   - disable domain updates by ID
   - post-action leakage audit queries
9) If IDs are provided, run this helper and include findings:
   bun run scripts/aws-ses-status-helper.ts --tenant-ids <csv> --domain-ids <csv> --json
10) If instructed to take action, use helper action mode:
   - dry-run preview: bun run scripts/aws-ses-status-helper.ts --pause-tenant-ids <csv> --tenant-ids <csv> --json
   - execute pause: bun run scripts/aws-ses-status-helper.ts --pause-tenant-ids <csv> --tenant-ids <csv> --execute --json
   - execute suspend: bun run scripts/aws-ses-status-helper.ts --suspend-tenant-ids <csv> --tenant-ids <csv> --execute --json

Return sections:
A) Platform Risk Snapshot
B) Offending Tenants (24h, 7d)
C) Offending Users (24h, 7d)
D) Offending Sender Domains (24h, 7d)
E) Recipient-Domain Risk Clusters
F) Disable Candidate IDs (deduped)
G) SQL Appendix (statements only)
H) Hourly cap violations (>=500 sent / 1h)
I) Assumptions and Data Gaps
```

## AWS status helper (CLI)

Use this helper to check AWS-side status for tenant IDs and domain IDs before disabling or after remediation.

Requirements:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (optional, defaults to `us-east-2`)
- `AWS_ACCOUNT_ID` (recommended for tenant reputation policy status)

Examples:

```bash
# Check specific offenders (JSON output)
bun run scripts/aws-ses-status-helper.ts \
  --tenant-ids tenant_a,tenant_b \
  --domain-ids indm_x,indm_y \
  --json

# Check all tenants (limited)
bun run scripts/aws-ses-status-helper.ts --all-tenants --limit 50

# Check all domains (limited)
bun run scripts/aws-ses-status-helper.ts --all-domains --limit 100
```

Output includes:
- DB state (`ses_tenants.status`, `email_domains.status`)
- AWS tenant status (`GetTenant`)
- AWS configuration set sending enabled (`GetConfigurationSet`)
- AWS identity verification/DKIM/mail-from status (`GetEmailIdentity`)
- Error details per resource when lookups fail
- Optional action execution for tenant pause/suspend with `--execute`
