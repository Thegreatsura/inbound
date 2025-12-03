/**
 * List all reputation entities in AWS SES
 * 
 * This script helps understand what reputation entities exist and their format.
 * Run with: bun scripts/list-reputation-entities.ts
 */

import {
  SESv2Client,
  ListReputationEntitiesCommand,
} from '@aws-sdk/client-sesv2'

const awsRegion = process.env.AWS_REGION || 'us-east-2'
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

if (!awsAccessKeyId || !awsSecretAccessKey) {
  console.error('❌ AWS credentials not configured')
  process.exit(1)
}

const sesClient = new SESv2Client({
  region: awsRegion,
  credentials: {
    accessKeyId: awsAccessKeyId,
    secretAccessKey: awsSecretAccessKey,
  }
})

async function main() {
  console.log('Listing all reputation entities in AWS SES...\n')

  let nextToken: string | undefined
  let totalCount = 0
  const policyStats: Record<string, number> = {}

  do {
    const response = await sesClient.send(new ListReputationEntitiesCommand({
      NextToken: nextToken,
      PageSize: 100,
    }))

    for (const entity of response.ReputationEntities || []) {
      totalCount++
      
      // Extract policy name from ARN
      const policyName = entity.ReputationManagementPolicy?.split('/').pop() || 'none'
      policyStats[policyName] = (policyStats[policyName] || 0) + 1

      // Show first 10 as examples
      if (totalCount <= 10) {
        console.log(`${totalCount}. ${entity.ReputationEntityReference}`)
        console.log(`   Type: ${entity.ReputationEntityType}`)
        console.log(`   Policy: ${policyName}`)
        console.log(`   Impact: ${entity.ReputationImpact}`)
        console.log(`   Status: ${entity.SendingStatusAggregate}`)
        console.log()
      }
    }

    nextToken = response.NextToken
  } while (nextToken)

  console.log('=' .repeat(60))
  console.log(`Total reputation entities: ${totalCount}`)
  console.log('\nPolicy distribution:')
  for (const [policy, count] of Object.entries(policyStats)) {
    console.log(`  ${policy}: ${count}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error)
    process.exit(1)
  })

