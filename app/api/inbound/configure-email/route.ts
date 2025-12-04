import { NextRequest, NextResponse } from 'next/server'
import { getDomainWithRecordsAndEmails, createEmailAddress, updateEmailAddressReceiptRule } from '@/lib/db/domains'
import { AWSSESReceiptRuleManager } from '@/lib/aws-ses/aws-ses-rules'
import { BatchRuleManager } from '@/lib/aws-ses/batch-rule-manager'
import { auth } from '@/lib/auth/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { emailDomains } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    // Get user session
    const session = await auth.api.getSession({
      headers: await headers()
    })

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { domain, emailAddresses: emailAddressList } = await request.json()

    if (!domain || !emailAddressList || !Array.isArray(emailAddressList)) {
      return NextResponse.json(
        { error: 'Domain and email addresses are required' },
        { status: 400 }
      )
    }

    // Get domain record with existing email addresses from database
    const domainRecord = await getDomainWithRecordsAndEmails(domain, session.user.id)
    if (!domainRecord) {
      return NextResponse.json(
        { error: 'Domain not found. Please verify domain first.' },
        { status: 404 }
      )
    }

    // Check if domain is verified
    if (domainRecord.status !== 'ses_verified') {
      return NextResponse.json(
        { error: 'Domain must be fully verified before configuring email addresses' },
        { status: 400 }
      )
    }

    // Get existing email addresses
    const existingEmailAddresses = domainRecord.emailAddresses || []
    const existingEmailMap = new Map(
      existingEmailAddresses.map(email => [email.address.toLowerCase(), email])
    )

    // Validate email addresses
    const validEmails = []
    const invalidEmails = []
    const newEmailsToCreate = []
    
    for (const email of emailAddressList) {
      if (AWSSESReceiptRuleManager.isValidEmailAddress(email)) {
        const emailDomain = AWSSESReceiptRuleManager.extractDomain(email)
        if (emailDomain === domain) {
          validEmails.push(email)
          // Check if this is a new email address
          if (!existingEmailMap.has(email.toLowerCase())) {
            newEmailsToCreate.push(email)
          }
        } else {
          invalidEmails.push(`${email} (domain mismatch)`)
        }
      } else {
        invalidEmails.push(`${email} (invalid format)`)
      }
    }

    if (invalidEmails.length > 0) {
      return NextResponse.json(
        { 
          error: 'Invalid email addresses found',
          invalidEmails 
        },
        { status: 400 }
      )
    }

    // Get AWS configuration
    const awsRegion = process.env.AWS_REGION || 'us-east-2'
    const lambdaFunctionName = process.env.LAMBDA_FUNCTION_NAME || 'email-processor'
    const s3BucketName = process.env.S3_BUCKET_NAME
    const awsAccountId = process.env.AWS_ACCOUNT_ID

    if (!s3BucketName || !awsAccountId) {
      return NextResponse.json(
        { error: 'AWS configuration incomplete. Missing S3_BUCKET_NAME or AWS_ACCOUNT_ID' },
        { status: 500 }
      )
    }

    // Create SES receipt rule manager
    const ruleManager = new AWSSESReceiptRuleManager(awsRegion)
    const lambdaArn = AWSSESReceiptRuleManager.getLambdaFunctionArn(
      lambdaFunctionName,
      awsAccountId,
      awsRegion
    )

    // Use batch catch-all rule system (domain-level catch-all)
    // Check if domain already has a batch catch-all rule
    let receiptRuleName: string | null = domainRecord.catchAllReceiptRuleName
    
    if (!receiptRuleName?.startsWith('batch-rule-')) {
      console.log(`🔧 Domain not yet in batch catch-all, adding to batch rule`)
      
      const batchManager = new BatchRuleManager('inbound-catchall-domain-default')
      
      try {
        // Find or create rule with capacity
        const rule = await batchManager.findOrCreateRuleWithCapacity(1)

        // Add domain catch-all to batch rule
        await ruleManager.configureBatchCatchAllRule({
          domains: [domain],
          lambdaFunctionArn: lambdaArn,
          s3BucketName,
          ruleSetName: 'inbound-catchall-domain-default',
          ruleName: rule.ruleName
        })

        // Update domain record
        await db
          .update(emailDomains)
          .set({
            catchAllReceiptRuleName: rule.ruleName,
            updatedAt: new Date()
          })
          .where(eq(emailDomains.id, domainRecord.id))

        // Increment rule capacity
        await batchManager.incrementRuleCapacity(rule.id, 1)

        receiptRuleName = rule.ruleName
        console.log(`✅ Added domain to batch rule: ${rule.ruleName}`)
      } catch (error) {
        console.error('Failed to add domain to batch rule:', error)
        return NextResponse.json(
          { 
            error: 'Failed to configure SES receipt rules',
            details: error instanceof Error ? error.message : 'Unknown error',
            domain,
            emailAddresses: validEmails,
            isRetryable: true
          },
          { status: 500 }
        )
      }
    } else {
      console.log(`✅ Domain already in batch rule: ${receiptRuleName}`)
    }
    
    // Create a fake receipt result for backwards compatibility
    const receiptResult = {
      ruleName: receiptRuleName!,
      status: 'updated' as const
    }

    // Create only new email address records in database
    const allConfiguredEmails = []
    
    // Add existing emails to the response
    for (const existingEmail of existingEmailAddresses) {
      // Update receipt rule status if needed
      if (!existingEmail.isReceiptRuleConfigured || existingEmail.receiptRuleName !== receiptResult.ruleName) {
        await updateEmailAddressReceiptRule(
          existingEmail.id,
          true,
          receiptResult.ruleName
        )
      }
      
      allConfiguredEmails.push({
        id: existingEmail.id,
        address: existingEmail.address,
        isConfigured: true,
        ruleName: receiptResult.ruleName,
        isNew: false
      })
    }
    
    // Create new email addresses
    for (const email of newEmailsToCreate) {
      try {
        const emailRecord = await createEmailAddress(email, domainRecord.id, session.user.id)
        
        // Update receipt rule status
        await updateEmailAddressReceiptRule(
          emailRecord.id,
          true,
          receiptResult.ruleName
        )
        
        allConfiguredEmails.push({
          id: emailRecord.id,
          address: email,
          isConfigured: true,
          ruleName: receiptResult.ruleName,
          isNew: true
        })
      } catch (error) {
        console.error(`Failed to create email record for ${email}:`, error)
        // Continue with other emails
      }
    }

    return NextResponse.json({
      domain,
      emailAddresses: allConfiguredEmails,
      receiptRule: {
        name: receiptResult.ruleName,
        status: receiptResult.status
      },
      lambdaFunction: lambdaFunctionName,
      s3Bucket: s3BucketName,
      message: `Successfully configured ${allConfiguredEmails.length} email addresses for ${domain} (${newEmailsToCreate.length} new, ${existingEmailAddresses.length} existing)`,
      timestamp: new Date()
    })
  } catch (error) {
    console.error('Email configuration error:', error)
    return NextResponse.json(
      { error: 'Failed to configure email addresses' },
      { status: 500 }
    )
  }
} 