# Batch Catch-All Migration Notes

## Summary

The V2 API `/api/v2/domains/{id}` has been updated to use the batch catch-all system to avoid AWS SES receipt rule limits.

## What Changed

### Before (Individual Rules)
- Each domain got its own SES receipt rule: `example.com-catchall-rule`
- AWS SES limit: ~200 rules per account
- Problem: Hit limits quickly with many domains

### After (Batch Rules)
- Multiple domains share batch rules: `batch-rule-001`, `batch-rule-002`, etc.
- Each batch rule supports up to 500 domains
- Capacity tracked in `sesReceiptRules` table
- Rule set: `inbound-catchall-domain-default`

## Files Modified

- `/app/api/v2/domains/[id]/route.ts` - Updated PUT handler to use batch system

## Migration Status

### ✅ Migrated to Batch System
- `POST /api/v2/email-addresses` - Already using batch system
- `PUT /api/v2/domains/{id}` - **JUST UPDATED** ✨

### ⚠️ Still Using Old System (Consider Updating)
- `PUT /api/v1.1/domains/{id}/catch-all` - Still uses individual rules
- Note: V1.1 API may be deprecated, check with team before updating

## Testing Checklist

- [ ] Enable catch-all for a new domain
- [ ] Verify domain is added to a batch rule (check `catchAllReceiptRuleName` starts with `batch-rule-`)
- [ ] Verify AWS SES rule shows domain in Recipients list
- [ ] Disable catch-all for the domain
- [ ] Verify domain is removed from batch rule
- [ ] Check that capacity is properly incremented/decremented in `sesReceiptRules` table
- [ ] Test with multiple domains to ensure batch rules are reused efficiently

## Cleanup Recommendations

### 1. Clean up old individual catch-all rules in AWS SES

Run the migration script to convert any remaining old-style rules:

\`\`\`bash
# Dry run first to see what would be migrated
DRY_RUN=true bun run scripts/migrate-to-batch-catchall.ts

# Actually migrate
bun run scripts/migrate-to-batch-catchall.ts
\`\`\`

### 2. Verify batch rule capacity

The migration script includes a verification step that:
- Rebuilds domain counts from the database
- Checks for mismatches between DB and AWS SES
- Reports on batch rule utilization

### 3. Monitor batch rule usage

Query to check current batch rule distribution:

\`\`\`sql
SELECT 
  ruleName,
  domainCount,
  maxCapacity,
  (maxCapacity - domainCount) as availableSlots,
  ROUND((domainCount::numeric / maxCapacity::numeric) * 100, 2) as utilizationPct
FROM sesReceiptRules
WHERE ruleSetName = 'inbound-catchall-domain-default'
  AND isActive = true
ORDER BY ruleName;
\`\`\`

### 4. Consider updating V1.1 API (Optional)

If V1.1 is still actively used, consider applying the same batch system changes to:
- `/app/api/v1.1/domains/{id}/catch-all/route.ts`

Check with the team first to see if V1.1 is being deprecated.

## Architecture Notes

### Batch Rule Manager
- **Location**: `/lib/aws-ses/batch-rule-manager.ts`
- **Purpose**: Manages capacity tracking and rule creation
- **Methods**:
  - `findOrCreateRuleWithCapacity(n)` - Find rule with capacity or create new one
  - `incrementRuleCapacity(ruleId, count)` - Increment domain count
  - `decrementRuleCapacity(ruleId, count)` - Decrement domain count
  - `rebuildDomainCounts()` - Rebuild counts from database (for recovery)

### AWS SES Rules Manager
- **Location**: `/lib/aws-ses/aws-ses-rules.ts`
- **Key Method**: `configureBatchCatchAllRule(config)`
- **Features**:
  - Creates or updates batch rules with multiple domains
  - Merges new domains with existing recipients
  - Handles up to 500 domains per rule
  - Uses `emails/batch-catchall/` S3 prefix for stored emails

## Troubleshooting

### "Too many rules" error
- **Cause**: Trying to create individual rules instead of batch rules
- **Solution**: Ensure code is using `BatchRuleManager` and `configureBatchCatchAllRule()`

### Domain count mismatch
- **Symptom**: Database shows different count than AWS SES
- **Solution**: Run `batchManager.rebuildDomainCounts()` to sync

### Capacity errors
- **Cause**: Trying to add more domains than batch rule capacity
- **Solution**: System should auto-create new batch rules, check logs

## Related Files

- `/lib/aws-ses/batch-rule-manager.ts` - Batch rule management
- `/lib/aws-ses/aws-ses-rules.ts` - AWS SES API wrapper
- `/scripts/migrate-to-batch-catchall.ts` - Migration script
- `/app/api/v2/email-addresses/route.ts` - Reference implementation

