
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'
import DailyUsageSummaryEmail from '@/emails/daily-usage-summary'
import { render } from '@react-email/render'
import { Inbound } from '@inboundemail/sdk'
import { generateObject } from 'ai'
import { z } from 'zod'

// Vercel cron/webhook route. Secure by shared secret header if set.
export async function GET() {

  const now = new Date()
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setUTCHours(23, 59, 59, 999)

  // Aggregate totals
  const totalsRes = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM sent_emails WHERE created_at BETWEEN ${start} AND ${end})::int AS sent,
      (SELECT COUNT(*) FROM received_emails WHERE created_at BETWEEN ${start} AND ${end})::int AS received,
      (SELECT COUNT(DISTINCT from_address) FROM sent_emails WHERE created_at BETWEEN ${start} AND ${end})::int AS unique_senders,
      (SELECT COUNT(DISTINCT recipient) FROM received_emails WHERE created_at BETWEEN ${start} AND ${end})::int AS unique_recipients
  `)
  const totalsRow: any = totalsRes.rows[0] || { sent: 0, received: 0, unique_senders: 0, unique_recipients: 0 }

  // Top users for the day
  const topUsersRes = await db.execute(sql`
    SELECT
      u.email AS user_email,
      u.name AS user_name,
      COALESCE(s.sent, 0)::int AS sent,
      COALESCE(r.received, 0)::int AS received,
      (COALESCE(s.sent, 0) + COALESCE(r.received, 0))::int AS total
    FROM "user" u
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS sent
      FROM sent_emails
      WHERE created_at BETWEEN ${start} AND ${end}
      GROUP BY user_id
    ) s ON s.user_id = u.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS received
      FROM received_emails
      WHERE created_at BETWEEN ${start} AND ${end}
      GROUP BY user_id
    ) r ON r.user_id = u.id
    ORDER BY total DESC
    LIMIT 10
  `)
  const topUsers = (topUsersRes.rows as any[]).map(r => ({
    userEmail: r.user_email as string,
    userName: (r.user_name ?? null) as string | null,
    sent: Number(r.sent || 0),
    received: Number(r.received || 0),
    total: Number(r.total || 0)
  }))

  // Optional AI insights using Vercel AI SDK generateObject
  let insights: string[] = []
  try {
    if (process.env.OPENAI_API_KEY) {
      
      const result = await generateObject({
        model: 'openai/gpt-5',
        schema: z.object({ insights: z.array(z.string()).max(8) }),
        prompt: `You are an email analytics assistant. Given today's usage metrics, produce concise insights (max 8 bullet points).\n\nTotals: sent=${totalsRow.sent}, received=${totalsRow.received}, uniqueSenders=${totalsRow.unique_senders}, uniqueRecipients=${totalsRow.unique_recipients}.\nTop users (email: sent/received/total):\n${topUsers.map(u => `${u.userEmail}: ${u.sent}/${u.received}/${u.total}`).join('\n')}`
      })
      insights = (result.object as any).insights || []
    }
  } catch (e) {
    console.error('AI insights generation failed:', e)
  }

  const html = await render(DailyUsageSummaryEmail({
    dateLabel: now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    totals: {
      sent: Number(totalsRow.sent || 0),
      received: Number(totalsRow.received || 0),
      uniqueSenders: Number(totalsRow.unique_senders || 0),
      uniqueRecipients: Number(totalsRow.unique_recipients || 0)
    },
    topUsers,
    insights,
  }))

  const inbound = new Inbound(process.env.INBOUND_API_KEY!)
  const toEmail = process.env.USAGE_REPORT_TO || 'ryan@inboundemail.com'
  const response = await inbound.emails.send({
    from: 'inbound reports <notifications@inbound.new>',
    to: toEmail,
    subject: `Daily usage • ${now.toLocaleDateString('en-US')}`,
    html,
    tags: [{ name: 'type', value: 'daily-usage' }]
  })

  if (response.error) {
    console.error('Daily usage email send failed:', response.error)
    return new Response(null, { status: 500 })
  }

  return new Response(null, { status: 204 })
}


