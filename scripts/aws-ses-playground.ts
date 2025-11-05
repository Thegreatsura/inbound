/**
 * AWS SES Playground Script
 * 
 * A simple script to test AWS SES email sending functionality,
 * including testing subdomain sending without additional verification.
 * 
 * Usage: bun run scripts/aws-ses-playground.ts
 */

import { SESv2Client, SendEmailCommand, GetEmailIdentityCommand } from '@aws-sdk/client-sesv2';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration from environment variables
const config = {
  region: process.env.AWS_REGION || 'us-east-2',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  verifiedDomain: "shipomate.com",
  testRecipient: "inboundemaildotnew@gmail.com",
};

// Initialize SES client
const sesClient = new SESv2Client({
  region: config.region,
  credentials: {
    accessKeyId: config.accessKeyId!,
    secretAccessKey: config.secretAccessKey!,
  },
});

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function separator() {
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Test 1: Check domain verification status
 */
async function checkDomainVerification(domain: string) {
  separator();
  log(`🔍 Checking verification status for: ${domain}`, 'cyan');
  
  try {
    const command = new GetEmailIdentityCommand({
      EmailIdentity: domain,
    });
    
    const response = await sesClient.send(command);
    
    log('✅ Domain found in SES', 'green');
    log(`Verification Status: ${response.VerifiedForSendingStatus ? 'Verified ✓' : 'Not Verified ✗'}`, 
        response.VerifiedForSendingStatus ? 'green' : 'yellow');
    
    if (response.DkimAttributes) {
      log(`DKIM Status: ${response.DkimAttributes.Status}`, 'blue');
    }
    
    return response.VerifiedForSendingStatus;
  } catch (error: any) {
    if (error.name === 'NotFoundException') {
      log('❌ Domain not found in SES', 'red');
    } else {
      log(`❌ Error: ${error.message}`, 'red');
    }
    return false;
  }
}

/**
 * Helper function to format email with display name
 */
function formatEmailAddress(email: string, name?: string): string {
  if (!name) {
    // Extract a name from the email address
    const localPart = email.split('@')[0];
    const displayName = localPart
      .split(/[._-]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return `${displayName} <${email}>`;
  }
  return `${name} <${email}>`;
}

/**
 * Test 2: Send a simple test email
 */
async function sendTestEmail(fromAddress: string, toAddress: string, subject: string, fromName?: string) {
  separator();
  const formattedFrom = formatEmailAddress(fromAddress, fromName);
  log(`📧 Attempting to send email...`, 'cyan');
  log(`From: ${formattedFrom}`, 'blue');
  log(`To: ${toAddress}`, 'blue');
  log(`Subject: ${subject}`, 'blue');
  
  try {
    const command = new SendEmailCommand({
      FromEmailAddress: formattedFrom,
      Destination: {
        ToAddresses: [toAddress],
      },
      Content: {
        Simple: {
          Subject: {
            Data: subject,
            Charset: 'UTF-8',
          },
          Body: {
            Text: {
              Data: `This is a test email sent from AWS SES via the playground script.\n\nFrom: ${formattedFrom}\nTimestamp: ${new Date().toISOString()}`,  
              Charset: 'UTF-8',
            },
            Html: {
              Data: `
                <html>
                  <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #2563eb;">AWS SES Test Email</h2>
                    <p>This is a test email sent from AWS SES via the playground script.</p>
                    <hr style="margin: 20px 0;">
                    <p><strong>From:</strong> ${formattedFrom}</p>
                    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
                    <div style="margin-top: 30px; padding: 15px; background-color: #f3f4f6; border-radius: 8px;">
                      <p style="margin: 0; font-size: 14px; color: #6b7280;">
                        This email was sent to test AWS SES subdomain functionality.
                      </p>
                    </div>
                  </body>
                </html>
              `,
              Charset: 'UTF-8',
            },
          },
        },
      },
    });

    const response = await sesClient.send(command);
    
    log('✅ Email sent successfully!', 'green');
    log(`Message ID: ${response.MessageId}`, 'green');
    
    return true;
  } catch (error: any) {
    log(`❌ Failed to send email: ${error.message}`, 'red');
    
    if (error.message.includes('not verified')) {
      log('💡 Tip: The sender address needs to be verified in SES', 'yellow');
    }
    
    return false;
  }
}

/**
 * Test 3: Test sending from multiple subdomains
 */
async function testSubdomainSending(baseDomain: string, recipient: string) {
  separator();
  log(`🧪 Testing Subdomain Sending`, 'cyan');
  log(`Base Domain: ${baseDomain}`, 'blue');
  
  const subdomains = [
    `noreply@${baseDomain}`,
    `hello@${baseDomain}`,
    `test@mail.${baseDomain}`,
    `support@app.${baseDomain}`,
    `notifications@api.${baseDomain}`,
  ];
  
  const results: { address: string; success: boolean }[] = [];
  
  for (const subdomain of subdomains) {
    log(`\nTesting: ${subdomain}`, 'yellow');
    
    const success = await sendTestEmail(
      subdomain,
      recipient,
      `Subdomain Test: ${subdomain}`
    );
    
    results.push({ address: subdomain, success });
    
    // Wait a bit between sends to avoid throttling
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  separator();
  log('📊 Subdomain Test Results:', 'bright');
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const color = result.success ? 'green' : 'red';
    log(`${icon} ${result.address}`, color);
  });
  
  const successCount = results.filter(r => r.success).length;
  log(`\nSuccess Rate: ${successCount}/${results.length}`, 
      successCount === results.length ? 'green' : 'yellow');
}

/**
 * Test 4: Send with custom headers
 */
async function sendEmailWithHeaders(fromAddress: string, toAddress: string) {
  separator();
  log(`📨 Sending email with custom headers...`, 'cyan');
  
  const formattedFrom = formatEmailAddress(fromAddress, 'Test Sender');
  log(`From: ${formattedFrom}`, 'blue');
  
  try {
    const command = new SendEmailCommand({
      FromEmailAddress: formattedFrom,
      Destination: {
        ToAddresses: [toAddress],
      },
      Content: {
        Simple: {
          Subject: {
            Data: 'Test Email with Custom Headers',
            Charset: 'UTF-8',
          },
          Body: {
            Text: {
              Data: 'This email includes custom headers for testing.',
              Charset: 'UTF-8',
            },
          },
        },
      },
      EmailTags: [
        {
          Name: 'Environment',
          Value: 'Testing',
        },
        {
          Name: 'Source',
          Value: 'Playground',
        },
      ],
    });

    const response = await sesClient.send(command);
    
    log('✅ Email with headers sent successfully!', 'green');
    log(`Message ID: ${response.MessageId}`, 'green');
    
    return true;
  } catch (error: any) {
    log(`❌ Failed: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Test 5: Test multi-level subdomain sending
 */
async function testMultiLevelSubdomains(baseDomain: string, recipient: string) {
  separator();
  log(`🔬 Testing Multi-Level Subdomain Sending`, 'cyan');
  log(`Base Domain: ${baseDomain}`, 'blue');
  log(`Testing deeply nested subdomains (2, 3, and 4 levels deep)`, 'blue');
  
  const multiLevelSubdomains = [
    // 2-level subdomains
    { address: `test@app.${baseDomain}`, level: 2 },
    { address: `noreply@mail.${baseDomain}`, level: 2 },
    
    // 3-level subdomains
    { address: `hello@api.app.${baseDomain}`, level: 3 },
    { address: `notifications@smtp.mail.${baseDomain}`, level: 3 },
    { address: `support@v1.api.${baseDomain}`, level: 3 },
    
    // 4-level subdomains
    { address: `alerts@prod.v2.api.${baseDomain}`, level: 4 },
    { address: `system@us-east.smtp.mail.${baseDomain}`, level: 4 },
    
    // 5-level subdomain (edge case)
    { address: `test@dev.internal.v1.api.${baseDomain}`, level: 5 },
  ];
  
  const results: { address: string; level: number; success: boolean }[] = [];
  
  for (const { address, level } of multiLevelSubdomains) {
    log(`\nTesting Level ${level}: ${address}`, 'yellow');
    
    const success = await sendTestEmail(
      address,
      recipient,
      `Multi-Level Subdomain Test (${level} levels): ${address}`
    );
    
    results.push({ address, level, success });
    
    // Wait between sends to avoid throttling
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  separator();
  log('📊 Multi-Level Subdomain Test Results:', 'bright');
  
  // Group results by level
  const byLevel = results.reduce((acc, result) => {
    if (!acc[result.level]) acc[result.level] = [];
    acc[result.level].push(result);
    return acc;
  }, {} as Record<number, typeof results>);
  
  Object.keys(byLevel).sort().forEach(levelStr => {
    const level = parseInt(levelStr);
    const levelResults = byLevel[level];
    const successCount = levelResults.filter(r => r.success).length;
    
    log(`\n${level}-Level Subdomains (${successCount}/${levelResults.length} successful):`, 'cyan');
    levelResults.forEach(result => {
      const icon = result.success ? '✅' : '❌';
      const color = result.success ? 'green' : 'red';
      log(`  ${icon} ${result.address}`, color);
    });
  });
  
  const totalSuccess = results.filter(r => r.success).length;
  
  separator();
  log(`Overall Success Rate: ${totalSuccess}/${results.length}`, 
      totalSuccess === results.length ? 'green' : 'yellow');
  
  // Provide insights
  log('\n💡 Insights:', 'bright');
  if (totalSuccess === results.length) {
    log('✨ All multi-level subdomains work! AWS SES supports deeply nested subdomains.', 'green');
  } else if (totalSuccess > 0) {
    log('⚠️  Some levels work, others don\'t. Check the pattern above.', 'yellow');
  } else {
    log('❌ Multi-level subdomains may not be supported or additional verification needed.', 'red');
  }
  
  return results;
}

/**
 * Test 6: Find the maximum subdomain nesting level
 */
async function testMaxSubdomainDepth(baseDomain: string, recipient: string) {
  separator();
  log(`🚀 Testing Maximum Subdomain Depth`, 'cyan');
  log(`Base Domain: ${baseDomain}`, 'blue');
  log(`Progressively testing deeper subdomain levels...`, 'blue');
  
  const results: { level: number; address: string; success: boolean }[] = [];
  let currentDepth = 1;
  const maxTestDepth = 15; // Test up to 15 levels deep
  
  // Generate progressively deeper subdomains
  for (let level = 1; level <= maxTestDepth; level++) {
    // Build subdomain parts: level1.level2.level3...
    const subdomainParts: string[] = [];
    for (let i = 1; i <= level; i++) {
      subdomainParts.push(`sub${i}`);
    }
    
    const subdomain = subdomainParts.join('.');
    const fullAddress = `test@${subdomain}.${baseDomain}`;
    
    log(`\n${'━'.repeat(60)}`, 'cyan');
    log(`Testing Level ${level}: ${level} subdomain${level > 1 ? 's' : ''} deep`, 'yellow');
    log(`Address: ${fullAddress}`, 'blue');
    log(`Structure: test @ ${subdomainParts.join(' → ')} → ${baseDomain}`, 'blue');
    
    const success = await sendTestEmail(
      fullAddress,
      recipient,
      `Max Depth Test - Level ${level}`,
      `Level ${level} Test`
    );
    
    results.push({ level, address: fullAddress, success });
    
    // If we hit a failure, try a couple more times to confirm the limit
    if (!success) {
      log(`\n⚠️  Failed at level ${level}. Testing one more time to confirm...`, 'yellow');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const retrySuccess = await sendTestEmail(
        fullAddress,
        recipient,
        `Max Depth Test - Level ${level} (Retry)`,
        `Level ${level} Retry`
      );
      
      if (!retrySuccess) {
        log(`\n🛑 Confirmed: Level ${level} fails consistently`, 'red');
        log(`Maximum working depth appears to be: Level ${level - 1}`, 'green');
        break;
      } else {
        log(`\n✅ Retry succeeded! Continuing tests...`, 'green');
        results[results.length - 1].success = true;
      }
    }
    
    // Wait between tests to avoid throttling
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  separator();
  log('📊 Maximum Depth Test Results:', 'bright');
  
  // Show all results
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌';
    const color = result.success ? 'green' : 'red';
    log(`${icon} Level ${result.level.toString().padStart(2, ' ')}: ${result.address}`, color);
  });
  
  // Calculate and display the maximum working depth
  const successfulLevels = results.filter(r => r.success);
  const maxWorkingDepth = successfulLevels.length > 0 
    ? Math.max(...successfulLevels.map(r => r.level))
    : 0;
  
  separator();
  log('🎯 Final Results:', 'bright');
  log(`Total Levels Tested: ${results.length}`, 'blue');
  log(`Successful Levels: ${successfulLevels.length}`, 'green');
  log(`Failed Levels: ${results.length - successfulLevels.length}`, 'red');
  
  if (maxWorkingDepth > 0) {
    log(`\n🏆 Maximum Working Subdomain Depth: ${maxWorkingDepth} level${maxWorkingDepth > 1 ? 's' : ''}`, 'green');
    
    // Show the deepest working address
    const deepestSuccess = results.find(r => r.level === maxWorkingDepth && r.success);
    if (deepestSuccess) {
      log(`\nDeepest working address:`, 'cyan');
      log(`${deepestSuccess.address}`, 'green');
    }
  } else {
    log(`\n❌ No subdomain levels worked`, 'red');
  }
  
  // Provide insights
  separator();
  log('💡 Insights:', 'bright');
  
  if (maxWorkingDepth >= 10) {
    log('✨ AWS SES supports very deep subdomain nesting (10+ levels)!', 'green');
    log('This is more than sufficient for any practical use case.', 'green');
  } else if (maxWorkingDepth >= 5) {
    log('✅ AWS SES supports moderate subdomain nesting.', 'green');
    log('This should be sufficient for most use cases.', 'green');
  } else if (maxWorkingDepth >= 2) {
    log('⚠️  AWS SES supports basic subdomain nesting.', 'yellow');
    log('You may need to verify deeper subdomains separately.', 'yellow');
  } else if (maxWorkingDepth === 1) {
    log('⚠️  Only single-level subdomains work.', 'yellow');
  } else {
    log('❌ Subdomains may not be supported without additional verification.', 'red');
  }
  
  return { maxWorkingDepth, results };
}

/**
 * Main execution
 */
async function main() {
  const args = process.argv.slice(2);
  const depthTestOnly = args.includes('--depth-only') || args.includes('-d');
  
  log('\n🚀 AWS SES Playground', 'bright');
  if (depthTestOnly) {
    log('Running DEPTH TEST ONLY\n', 'yellow');
  } else {
    log('Testing email sending functionality\n', 'cyan');
    log('💡 Tip: Run with --depth-only or -d to only test maximum subdomain depth', 'blue');
  }
  
  // Validate configuration
  if (!config.accessKeyId || !config.secretAccessKey) {
    log('❌ Missing AWS credentials in environment variables', 'red');
    log('Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY', 'yellow');
    process.exit(1);
  }
  
  if (!config.testRecipient) {
    log('❌ Missing TEST_RECIPIENT_EMAIL in environment variables', 'red');
    log('Please set TEST_RECIPIENT_EMAIL to receive test emails', 'yellow');
    process.exit(1);
  }
  
  log('Configuration:', 'bright');
  log(`Region: ${config.region}`, 'blue');
  log(`Verified Domain: ${config.verifiedDomain}`, 'blue');
  log(`Test Recipient: ${config.testRecipient}`, 'blue');
  
  try {
    if (depthTestOnly) {
      // Run only the depth test
      log('\n📏 Running maximum subdomain depth test only...', 'cyan');
      await checkDomainVerification(config.verifiedDomain);
      
      separator();
      log('⏳ This may take a few minutes...', 'yellow');
      const depthResults = await testMaxSubdomainDepth(config.verifiedDomain, config.testRecipient);
      
      separator();
      log('✨ Depth test completed!', 'green');
      log(`\n🏆 Maximum subdomain depth: ${depthResults.maxWorkingDepth} levels`, 'bright');
      
    } else {
      // Run all tests
      // Test 1: Check domain verification
      await checkDomainVerification(config.verifiedDomain);
      
      // Test 2: Send a simple test email from the base domain
      await sendTestEmail(
        `test@${config.verifiedDomain}`,
        config.testRecipient,
        'AWS SES Test Email',
        'Test Account'
      );
      
      // Test 3: Test subdomain sending
      await testSubdomainSending(config.verifiedDomain, config.testRecipient);
      
      // Test 4: Send with custom headers
      await sendEmailWithHeaders(
        `noreply@${config.verifiedDomain}`,
        config.testRecipient
      );
      
      // Test 5: Test multi-level subdomain sending
      await testMultiLevelSubdomains(config.verifiedDomain, config.testRecipient);
      
      // Test 6: Find maximum subdomain depth (this is the extensive one)
      log('\n⏳ Starting maximum depth test - this may take a few minutes...', 'yellow');
      const depthResults = await testMaxSubdomainDepth(config.verifiedDomain, config.testRecipient);
      
      separator();
      log('✨ All tests completed!', 'green');
      log('\n💡 Check your email inbox for the test messages', 'cyan');
      log(`\n🏆 Key Finding: Maximum subdomain depth = ${depthResults.maxWorkingDepth} levels`, 'bright');
    }
    
  } catch (error: any) {
    separator();
    log(`❌ Unexpected error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the playground
main();

