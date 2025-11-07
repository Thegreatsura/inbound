import { db } from '@/lib/db'
import { emailDomains, sesReceiptRules } from '@/lib/db/schema'
import { AWSSESReceiptRuleManager } from '@/lib/aws-ses/aws-ses-rules'
import { BatchRuleManager } from '@/lib/aws-ses/batch-rule-manager'
import { eq, sql } from 'drizzle-orm'

const DRY_RUN = process.env.DRY_RUN === 'true'
const FORCE_MIGRATE = process.env.FORCE_MIGRATE === 'true'
const RULE_SET_NAME = process.env.RULE_SET_NAME || 'inbound-catchall-domain-default'
const BATCH_SIZE = 100  // Process 100 domains per batch

interface MigrationStats {
  totalDomains: number
  processedDomains: number
  skippedDomains: number
  failedDomains: number
  rulesCreated: number
  errors: Array<{ domain: string; error: string }>
}

async function migrateToBatchCatchAll() {
  console.log('==================================================')
  console.log('SES Batch Catch-All Migration')
  console.log('==================================================')
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Force Migrate: ${FORCE_MIGRATE ? 'YES (will re-migrate all domains)' : 'NO'}`)
  console.log(`Rule Set: ${RULE_SET_NAME}`)
  console.log('==================================================\n')
  
  const stats: MigrationStats = {
    totalDomains: 0,
    processedDomains: 0,
    skippedDomains: 0,
    failedDomains: 0,
    rulesCreated: 0,
    errors: []
  }
  
  try {
    // Get AWS configuration
    const awsRegion = process.env.AWS_REGION || 'us-east-2'
    const lambdaFunctionName = process.env.LAMBDA_FUNCTION_NAME || 'email-processor'
    const s3BucketName = process.env.S3_BUCKET_NAME
    const awsAccountId = process.env.AWS_ACCOUNT_ID
    
    if (!s3BucketName || !awsAccountId) {
      throw new Error('Missing required env vars: S3_BUCKET_NAME or AWS_ACCOUNT_ID')
    }
    
    const lambdaArn = AWSSESReceiptRuleManager.getLambdaFunctionArn(
      lambdaFunctionName,
      awsAccountId,
      awsRegion
    )
    
    const sesManager = new AWSSESReceiptRuleManager(awsRegion)
    const batchManager = new BatchRuleManager(RULE_SET_NAME)
    
    // If FORCE_MIGRATE is set, clear existing batch rule data
    if (FORCE_MIGRATE && !DRY_RUN) {
      console.log('🔄 FORCE_MIGRATE enabled - clearing existing batch rule data...')
      
      // Clear sesReceiptRules table for this rule set
      await db
        .delete(sesReceiptRules)
        .where(eq(sesReceiptRules.ruleSetName, RULE_SET_NAME))
      console.log('✅ Cleared sesReceiptRules table')
      
      // Clear catchAllReceiptRuleName from all domains
      await db
        .update(emailDomains)
        .set({ catchAllReceiptRuleName: null })
        .where(sql`${emailDomains.catchAllReceiptRuleName} LIKE 'batch-rule-%'`)
      console.log('✅ Cleared catchAllReceiptRuleName from domains')
      console.log('')
    } else if (FORCE_MIGRATE && DRY_RUN) {
      console.log('[DRY RUN] Would clear existing batch rule data from database\n')
    }
    
    // Fetch all verified domains
    const domains = await db
      .select()
      .from(emailDomains)
      .where(eq(emailDomains.status, 'verified'))
    
    stats.totalDomains = domains.length
    console.log(`Found ${stats.totalDomains} verified domains to migrate\n`)
    
    if (stats.totalDomains === 0) {
      console.log('No domains to migrate. Exiting.')
      return
    }
    
    // Process domains in batches
    for (let i = 0; i < domains.length; i += BATCH_SIZE) {
      const batch = domains.slice(i, i + BATCH_SIZE)
      console.log(`\nProcessing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} domains)...`)
      
      // Get domains that need batch catch-all rules
      // If FORCE_MIGRATE is set, process all domains regardless of existing rule
      const domainsToProcess = FORCE_MIGRATE 
        ? batch 
        : batch.filter(d => !d.catchAllReceiptRuleName?.startsWith('batch-rule-'))
      
      if (domainsToProcess.length === 0) {
        console.log('All domains in this batch already migrated, skipping...')
        stats.skippedDomains += batch.length
        continue
      }
      
      try {
        // Find or create rule with capacity
        const rule = await batchManager.findOrCreateRuleWithCapacity(domainsToProcess.length)
        console.log(`Using rule: ${rule.ruleName} (current: ${rule.currentCapacity}, available: ${rule.availableSlots})`)
        
        if (DRY_RUN) {
          console.log(`[DRY RUN] Would add ${domainsToProcess.length} domains to ${rule.ruleName}`)
          console.log(`[DRY RUN] Domains: ${domainsToProcess.map(d => d.domain).join(', ')}`)
          stats.processedDomains += domainsToProcess.length
          continue
        }
        
        // Configure AWS SES batch catch-all rule
        const result = await sesManager.configureBatchCatchAllRule({
          domains: domainsToProcess.map(d => d.domain),
          lambdaFunctionArn: lambdaArn,
          s3BucketName,
          ruleSetName: RULE_SET_NAME,
          ruleName: rule.ruleName
        })
        
        console.log(`✅ ${result.status === 'created' ? 'Created' : 'Updated'} ${result.ruleName} with ${result.domainsAdded.length} domains`)
        
        if (result.status === 'created') {
          stats.rulesCreated++
        }
        
        // Update database records
        for (const domain of domainsToProcess) {
          await db
            .update(emailDomains)
            .set({
              catchAllReceiptRuleName: rule.ruleName,
              updatedAt: new Date()
            })
            .where(eq(emailDomains.id, domain.id))
        }
        
        // Increment rule capacity counter
        await batchManager.incrementRuleCapacity(rule.id, domainsToProcess.length)
        
        stats.processedDomains += domainsToProcess.length
        
      } catch (error) {
        console.error(`❌ Failed to process batch:`, error)
        stats.failedDomains += domainsToProcess.length
        for (const domain of domainsToProcess) {
          stats.errors.push({
            domain: domain.domain,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }
    
    // Verification step (if not dry run)
    if (!DRY_RUN) {
      console.log('\n==================================================')
      console.log('Verification')
      console.log('==================================================')
      await verifyMigration(RULE_SET_NAME, sesManager)
    }
    
  } catch (error) {
    console.error('💥 Migration failed:', error)
    throw error
  } finally {
    // Print summary
    console.log('\n==================================================')
    console.log('Migration Summary')
    console.log('==================================================')
    console.log(`Total domains: ${stats.totalDomains}`)
    console.log(`Processed: ${stats.processedDomains}`)
    console.log(`Skipped: ${stats.skippedDomains}`)
    console.log(`Failed: ${stats.failedDomains}`)
    console.log(`Rules created: ${stats.rulesCreated}`)
    
    if (stats.errors.length > 0) {
      console.log('\nErrors:')
      stats.errors.forEach(err => {
        console.log(`  - ${err.domain}: ${err.error}`)
      })
    }
    
    console.log('==================================================')
  }
}

async function verifyMigration(ruleSetName: string, sesManager: AWSSESReceiptRuleManager) {
  console.log('\nVerifying migration...')
  
  try {
    // Check database consistency
    const batchManager = new BatchRuleManager(ruleSetName)
    await batchManager.rebuildDomainCounts()
    console.log('✅ Database domain counts verified and rebuilt')
    
    // Get all batch rules from database
    const rules = await db
      .select()
      .from(sesReceiptRules)
      .where(eq(sesReceiptRules.ruleSetName, ruleSetName))
    
    console.log(`\nFound ${rules.length} batch rules in database:`)
    
    for (const rule of rules) {
      console.log(`  ${rule.ruleName}: ${rule.domainCount}/${rule.maxCapacity} domains`)
      
      // Verify rule exists in AWS
      const awsRule = await sesManager.getRuleIfExists(ruleSetName, rule.ruleName)
      if (awsRule) {
        const recipientCount = awsRule.Recipients?.length || 0
        console.log(`    ✅ AWS SES: ${recipientCount} recipients configured`)
        
        if (recipientCount !== rule.domainCount) {
          console.warn(`    ⚠️  Mismatch: DB says ${rule.domainCount}, AWS has ${recipientCount}`)
        }
      } else {
        console.error(`    ❌ Rule not found in AWS SES!`)
      }
    }
    
    console.log('\n✅ Verification complete')
    
  } catch (error) {
    console.error('❌ Verification failed:', error)
  }
}

// Run migration
migrateToBatchCatchAll()
  .then(() => {
    console.log('\n✅ Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n💥 Migration script failed:', error)
    process.exit(1)
  })

