import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { emailDeliveryEvents } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch delivery events for this user
    const events = await db
      .select({
        id: emailDeliveryEvents.id,
        eventType: emailDeliveryEvents.eventType,
        bounceType: emailDeliveryEvents.bounceType,
        bounceSubType: emailDeliveryEvents.bounceSubType,
        statusCode: emailDeliveryEvents.statusCode,
        failedRecipient: emailDeliveryEvents.failedRecipient,
        failedRecipientDomain: emailDeliveryEvents.failedRecipientDomain,
        originalSubject: emailDeliveryEvents.originalSubject,
        originalFrom: emailDeliveryEvents.originalFrom,
        userId: emailDeliveryEvents.userId,
        domainName: emailDeliveryEvents.domainName,
        tenantName: emailDeliveryEvents.tenantName,
        addedToBlocklist: emailDeliveryEvents.addedToBlocklist,
        createdAt: emailDeliveryEvents.createdAt,
      })
      .from(emailDeliveryEvents)
      .where(eq(emailDeliveryEvents.userId, session.user.id))
      .orderBy(desc(emailDeliveryEvents.createdAt))
      .limit(100)

    return NextResponse.json(events)
  } catch (error) {
    console.error('Error fetching delivery events:', error)
    return NextResponse.json(
      { error: 'Failed to fetch delivery events' },
      { status: 500 }
    )
  }
}

