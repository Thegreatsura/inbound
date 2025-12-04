/**
 * DSN Bounce Analysis Script
 * 
 * Queries the database for DSN (Delivery Status Notification) emails
 * and analyzes them to identify:
 * - Which emails triggered bounces
 * - Which users/domains/tenants are affected
 * - Common bounce patterns and reasons
 * 
 * Usage: bun run scripts/analyze-dsn-bounces.ts [--days=7] [--limit=100]
 */

import { db } from '@/lib/db'
import { structuredEmails, sentEmails, user, emailDomains, sesTenants } from '@/lib/db/schema'
import { sql, desc, eq, or, and, gte } from 'drizzle-orm'
import { 
  parseDsn, 
  getDsnSourceInfo, 
  quickIsDsnCheck,
  type ParsedDSN,
  type DSNSourceInfo,
  DSN_STATUS_CLASSES,
  DSN_STATUS_CATEGORIES
} from '@/lib/email-management/dsn-parser'

interface AnalyzedDSN {
  id: string
  createdAt: Date | null
  dsn: ParsedDSN
  source: DSNSourceInfo | null
}

interface BounceStats {
  total: number
  byStatus: Record<string, number>
  byBounceType: Record<string, number>
  byDomain: Record<string, number>
  byUser: Record<string, { count: number; email?: string; name?: string }>
  byTenant: Record<string, { count: number; name: string }>
  byRecipientDomain: Record<string, number>
  typoDetected: Array<{
    recipient: string
    possibleCorrection: string
    count: number
  }>
  // Source info coverage
  sourceInfoFound: {
    total: number
    withUser: number
    withDomain: number
    withTenant: number
    withEmailId: number
  }
}

// Common domain typos
const DOMAIN_TYPOS: Record<string, string> = {
  'gmail.con': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'hotmail.con': 'hotmail.com',
  'hotail.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'yahoo.con': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'outlook.con': 'outlook.com',
  'outloo.com': 'outlook.com',
  'icloud.con': 'icloud.com',
  'aol.con': 'aol.com',
  '.exu': '.edu', // umich.exu -> umich.edu
  '.edi': '.edu',
  '.coom': '.com',
  '.comm': '.com',
  '.ney': '.net',
  '.orgg': '.org',
}

function detectTypo(email: string): string | null {
  if (!email) return null
  
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return null
  
  for (const [typo, correction] of Object.entries(DOMAIN_TYPOS)) {
    if (domain.includes(typo.replace('.', ''))) {
      const correctedDomain = domain.replace(typo.includes('.') ? typo : new RegExp(typo, 'g'), correction)
      return email.replace(domain, correctedDomain)
    }
    if (domain.endsWith(typo)) {
      return email.replace(domain, domain.replace(typo, correction))
    }
  }
  
  return null
}

async function fetchDsnEmails(days: number, limit: number): Promise<Array<{
  id: string
  rawContent: string | null
  textBody: string | null
  headers: string | null
  createdAt: Date | null
  fromData: string | null
}>> {
  console.log(`\n📧 Fetching potential DSN emails from last ${days} days...`)
  
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  
  // Query for emails that look like DSNs
  const results = await db
    .select({
      id: structuredEmails.id,
      rawContent: structuredEmails.rawContent,
      textBody: structuredEmails.textBody,
      headers: structuredEmails.headers,
      createdAt: structuredEmails.createdAt,
      fromData: structuredEmails.fromData,
    })
    .from(structuredEmails)
    .where(
      and(
        gte(structuredEmails.createdAt, cutoffDate),
        or(
          sql`${structuredEmails.fromData}::text LIKE '%MAILER-DAEMON%'`,
          sql`${structuredEmails.fromData}::text LIKE '%postmaster%'`,
          sql`${structuredEmails.subject} LIKE '%Delivery Status Notification%'`,
          sql`${structuredEmails.subject} LIKE '%Mail delivery failed%'`,
          sql`${structuredEmails.subject} LIKE '%Undeliverable%'`,
          sql`${structuredEmails.textBody} LIKE '%Diagnostic-Code%'`,
          sql`${structuredEmails.textBody} LIKE '%Action: failed%'`,
        )
      )
    )
    .orderBy(desc(structuredEmails.createdAt))
    .limit(limit)
  
  console.log(`  Found ${results.length} potential DSN emails`)
  return results
}

async function analyzeDsns(emails: Array<{
  id: string
  rawContent: string | null
  textBody: string | null
  headers: string | null
  createdAt: Date | null
}>): Promise<AnalyzedDSN[]> {
  console.log('\n🔍 Analyzing DSN emails...')
  
  const analyzed: AnalyzedDSN[] = []
  let processedCount = 0
  
  for (const email of emails) {
    processedCount++
    if (processedCount % 10 === 0) {
      process.stdout.write(`  Processed ${processedCount}/${emails.length}\r`)
    }
    
    // Use raw content if available, otherwise fall back to text body
    const content = email.rawContent || email.textBody || ''
    
    if (!content) continue
    
    const dsn = await parseDsn(content)
    
    if (!dsn.isDsn) continue
    
    let source: DSNSourceInfo | null = null
    
    // Try to get source info using In-Reply-To, References, or original message ID
    const hasMessageIdRef = dsn.inReplyTo || (dsn.references && dsn.references.length > 0) || dsn.originalMessage?.messageId
    if (hasMessageIdRef) {
      source = await getDsnSourceInfo(dsn)
    }
    
    analyzed.push({
      id: email.id,
      createdAt: email.createdAt,
      dsn,
      source,
    })
  }
  
  console.log(`\n  ✅ Analyzed ${analyzed.length} confirmed DSNs`)
  return analyzed
}

function computeStats(analyzed: AnalyzedDSN[]): BounceStats {
  const stats: BounceStats = {
    total: analyzed.length,
    byStatus: {},
    byBounceType: {},
    byDomain: {},
    byUser: {},
    byTenant: {},
    byRecipientDomain: {},
    typoDetected: [],
    sourceInfoFound: {
      total: 0,
      withUser: 0,
      withDomain: 0,
      withTenant: 0,
      withEmailId: 0,
    },
  }
  
  const typoMap = new Map<string, { recipient: string; correction: string; count: number }>()
  
  for (const item of analyzed) {
    const { dsn, source } = item
    
    // Track source info coverage
    if (source) {
      stats.sourceInfoFound.total++
      if (source.userId) stats.sourceInfoFound.withUser++
      if (source.domainName) stats.sourceInfoFound.withDomain++
      if (source.tenantId) stats.sourceInfoFound.withTenant++
      if (source.triggeringEmailId) stats.sourceInfoFound.withEmailId++
    }
    
    // By status code
    if (dsn.deliveryStatus?.status) {
      stats.byStatus[dsn.deliveryStatus.status] = (stats.byStatus[dsn.deliveryStatus.status] || 0) + 1
    }
    
    // By bounce type
    if (dsn.bounceType) {
      stats.byBounceType[dsn.bounceType] = (stats.byBounceType[dsn.bounceType] || 0) + 1
    }
    
    // By sending domain
    if (source?.domainName) {
      stats.byDomain[source.domainName] = (stats.byDomain[source.domainName] || 0) + 1
    }
    
    // By user
    if (source?.userId) {
      if (!stats.byUser[source.userId]) {
        stats.byUser[source.userId] = { 
          count: 0, 
          email: source.userEmail, 
          name: source.userName 
        }
      }
      stats.byUser[source.userId].count++
    }
    
    // By tenant
    if (source?.tenantId && source?.tenantName) {
      if (!stats.byTenant[source.tenantId]) {
        stats.byTenant[source.tenantId] = { 
          count: 0, 
          name: source.tenantName 
        }
      }
      stats.byTenant[source.tenantId].count++
    }
    
    // By recipient domain (the domain that bounced)
    const finalRecipient = dsn.deliveryStatus?.finalRecipient
    if (finalRecipient) {
      const recipientDomain = finalRecipient.split('@')[1]?.toLowerCase()
      if (recipientDomain) {
        stats.byRecipientDomain[recipientDomain] = (stats.byRecipientDomain[recipientDomain] || 0) + 1
        
        // Check for typos
        const correction = detectTypo(finalRecipient)
        if (correction) {
          const key = finalRecipient.toLowerCase()
          const existing = typoMap.get(key)
          if (existing) {
            existing.count++
          } else {
            typoMap.set(key, { recipient: finalRecipient, correction, count: 1 })
          }
        }
      }
    }
  }
  
  // Convert typo map to sorted array
  stats.typoDetected = Array.from(typoMap.values())
    .sort((a, b) => b.count - a.count)
    .map(t => ({
      recipient: t.recipient,
      possibleCorrection: t.correction,
      count: t.count,
    }))
  
  return stats
}

function printReport(analyzed: AnalyzedDSN[], stats: BounceStats) {
  console.log('\n' + '='.repeat(80))
  console.log('📊 DSN BOUNCE ANALYSIS REPORT')
  console.log('='.repeat(80))
  
  console.log(`\n📈 SUMMARY`)
  console.log(`  Total DSNs analyzed: ${stats.total}`)
  
  // Source info coverage
  const { sourceInfoFound } = stats
  const pctSourceFound = ((sourceInfoFound.total / stats.total) * 100).toFixed(1)
  const pctWithUser = ((sourceInfoFound.withUser / stats.total) * 100).toFixed(1)
  const pctWithDomain = ((sourceInfoFound.withDomain / stats.total) * 100).toFixed(1)
  const pctWithTenant = ((sourceInfoFound.withTenant / stats.total) * 100).toFixed(1)
  const pctWithEmailId = ((sourceInfoFound.withEmailId / stats.total) * 100).toFixed(1)
  
  console.log(`\n🔍 SOURCE INFO COVERAGE`)
  console.log(`  DSNs with source info found:   ${sourceInfoFound.total.toString().padStart(5)} / ${stats.total} (${pctSourceFound}%)`)
  console.log(`  ├─ With Email ID:              ${sourceInfoFound.withEmailId.toString().padStart(5)} / ${stats.total} (${pctWithEmailId}%)`)
  console.log(`  ├─ With User:                  ${sourceInfoFound.withUser.toString().padStart(5)} / ${stats.total} (${pctWithUser}%)`)
  console.log(`  ├─ With Domain:                ${sourceInfoFound.withDomain.toString().padStart(5)} / ${stats.total} (${pctWithDomain}%)`)
  console.log(`  └─ With Tenant:                ${sourceInfoFound.withTenant.toString().padStart(5)} / ${stats.total} (${pctWithTenant}%)`)
  
  // Bounce types
  console.log(`\n📋 BY BOUNCE TYPE`)
  for (const [type, count] of Object.entries(stats.byBounceType).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / stats.total) * 100).toFixed(1)
    console.log(`  ${type.padEnd(12)}: ${count.toString().padStart(5)} (${pct}%)`)
  }
  
  // Status codes
  console.log(`\n📋 BY STATUS CODE`)
  for (const [status, count] of Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / stats.total) * 100).toFixed(1)
    const classDesc = DSN_STATUS_CLASSES[status.charAt(0) as keyof typeof DSN_STATUS_CLASSES] || 'Unknown'
    const categoryDesc = DSN_STATUS_CATEGORIES[status.split('.')[1] as keyof typeof DSN_STATUS_CATEGORIES] || 'Unknown'
    console.log(`  ${status.padEnd(8)}: ${count.toString().padStart(5)} (${pct}%) - ${classDesc} / ${categoryDesc}`)
  }
  
  // Recipient domains (bounced domains)
  console.log(`\n📋 BY RECIPIENT DOMAIN (Top 15)`)
  const sortedRecipientDomains = Object.entries(stats.byRecipientDomain)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
  for (const [domain, count] of sortedRecipientDomains) {
    const pct = ((count / stats.total) * 100).toFixed(1)
    console.log(`  ${domain.padEnd(30)}: ${count.toString().padStart(5)} (${pct}%)`)
  }
  
  // Typos detected
  if (stats.typoDetected.length > 0) {
    console.log(`\n⚠️  DETECTED TYPOS`)
    for (const typo of stats.typoDetected) {
      console.log(`  ${typo.recipient.padEnd(35)} → ${typo.possibleCorrection} (${typo.count}x)`)
    }
  }
  
  // By tenant
  const tenantsWithBounces = Object.entries(stats.byTenant).filter(([, v]) => v.count > 0)
  if (tenantsWithBounces.length > 0) {
    console.log(`\n🏢 BY TENANT`)
    const sortedTenants = tenantsWithBounces.sort((a, b) => b[1].count - a[1].count)
    for (const [tenantId, info] of sortedTenants) {
      const pct = ((info.count / stats.total) * 100).toFixed(1)
      console.log(`  ${info.name.padEnd(35)}: ${info.count.toString().padStart(5)} (${pct}%)`)
    }
  }
  
  // By sending domain
  if (Object.keys(stats.byDomain).length > 0) {
    console.log(`\n🌐 BY SENDING DOMAIN`)
    for (const [domain, count] of Object.entries(stats.byDomain).sort((a, b) => b[1] - a[1])) {
      const pct = ((count / stats.total) * 100).toFixed(1)
      console.log(`  ${domain.padEnd(30)}: ${count.toString().padStart(5)} (${pct}%)`)
    }
  }
  
  // By user (if source info available)
  const usersWithBounces = Object.entries(stats.byUser).filter(([, v]) => v.count > 0)
  if (usersWithBounces.length > 0) {
    console.log(`\n👤 BY USER (Top 10)`)
    const sortedUsers = usersWithBounces.sort((a, b) => b[1].count - a[1].count).slice(0, 10)
    for (const [userId, info] of sortedUsers) {
      const display = info.email || info.name || userId
      const pct = ((info.count / stats.total) * 100).toFixed(1)
      console.log(`  ${display.padEnd(40)}: ${info.count.toString().padStart(5)} (${pct}%)`)
    }
  }
  
  // Sample DSNs with details
  console.log(`\n📝 SAMPLE DSNs (Latest 10)`)
  console.log('='.repeat(80))
  
  for (const item of analyzed.slice(0, 10)) {
    const { dsn, source } = item
    
    // Determine which Message-ID reference was found
    const msgIdRef = dsn.inReplyTo || (dsn.references?.[0]) || dsn.originalMessage?.messageId || null
    const msgIdSource = dsn.inReplyTo ? 'In-Reply-To' : 
                        dsn.references?.[0] ? 'References' : 
                        dsn.originalMessage?.messageId ? 'Part 3 Message-ID' : 'None'
    
    console.log(`\n┌${'─'.repeat(78)}┐`)
    console.log(`│ DSN ID: ${item.id.padEnd(68)}│`)
    console.log(`├${'─'.repeat(78)}┤`)
    console.log(`│ 📅 Date:      ${(item.createdAt?.toISOString() || 'Unknown').padEnd(62)}│`)
    console.log(`│ 📧 Failed To: ${(dsn.deliveryStatus?.finalRecipient || 'Unknown').padEnd(62)}│`)
    console.log(`│ 📊 Status:    ${(dsn.deliveryStatus?.status || 'Unknown').padEnd(10)} (${(dsn.bounceType || 'unknown').padEnd(10)} bounce)`.padEnd(79) + '│')
    console.log(`│ 💬 Reason:    ${(dsn.bounceReason || 'Unknown').substring(0, 60).padEnd(62)}│`)
    console.log(`├${'─'.repeat(78)}┤`)
    console.log(`│ 🔎 LOOKUP INFO`.padEnd(79) + '│')
    console.log(`│    Msg-ID Src: ${msgIdSource.padEnd(61)}│`)
    console.log(`│    Msg-ID:     ${(msgIdRef || 'N/A').substring(0, 60).padEnd(61)}│`)
    
    if (source) {
      console.log(`├${'─'.repeat(78)}┤`)
      console.log(`│ ✅ SOURCE EMAIL FOUND`.padEnd(79) + '│')
      console.log(`│    Email ID:  ${(source.triggeringEmailId || 'N/A').padEnd(62)}│`)
      console.log(`│    From:      ${(source.triggeringEmailFrom || 'N/A').substring(0, 60).padEnd(62)}│`)
      console.log(`│    To:        ${(source.triggeringEmailTo || 'N/A').substring(0, 60).padEnd(62)}│`)
      console.log(`│    Subject:   ${(source.triggeringEmailSubject || 'N/A').substring(0, 60).padEnd(62)}│`)
      console.log(`│    Sent At:   ${(source.triggeringEmailSentAt?.toISOString() || 'N/A').padEnd(62)}│`)
      console.log(`├${'─'.repeat(78)}┤`)
      console.log(`│ 👤 USER & TENANT`.padEnd(79) + '│')
      console.log(`│    User:      ${((source.userName || '') + (source.userEmail ? ` <${source.userEmail}>` : '') || source.userId || 'N/A').substring(0, 60).padEnd(62)}│`)
      console.log(`│    Domain:    ${(source.domainName || 'N/A').padEnd(62)}│`)
      console.log(`│    Tenant:    ${(source.tenantName || 'N/A').padEnd(62)}│`)
    } else {
      console.log(`├${'─'.repeat(78)}┤`)
      console.log(`│ ⚠️  SOURCE NOT FOUND`.padEnd(79) + '│')
      console.log(`│    Could not match Message-ID to any sent email in database`.padEnd(79) + '│')
    }
    
    console.log(`└${'─'.repeat(78)}┘`)
  }
}

async function main() {
  // Parse command line args
  const args = process.argv.slice(2)
  let days = 7
  let limit = 500
  
  for (const arg of args) {
    if (arg.startsWith('--days=')) {
      days = parseInt(arg.split('=')[1], 10)
    }
    if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1], 10)
    }
  }
  
  console.log('🚀 DSN Bounce Analysis Script')
  console.log(`   Analyzing last ${days} days, limit ${limit} emails`)
  
  try {
    // Fetch DSN emails
    const dsnEmails = await fetchDsnEmails(days, limit)
    
    if (dsnEmails.length === 0) {
      console.log('\n✅ No DSN emails found in the specified time range.')
      process.exit(0)
    }
    
    // Analyze DSNs
    const analyzed = await analyzeDsns(dsnEmails)
    
    if (analyzed.length === 0) {
      console.log('\n✅ No confirmed DSNs found after parsing.')
      process.exit(0)
    }
    
    // Compute statistics
    const stats = computeStats(analyzed)
    
    // Print report
    printReport(analyzed, stats)
    
    console.log('\n✅ Analysis complete!')
    
  } catch (error) {
    console.error('\n❌ Error:', error)
    process.exit(1)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

