import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { headers } from 'next/headers'
import { getUserWebhookPortalUrl } from '@/lib/svix/user-management'
import { isSvixEnabled } from '@/lib/svix'

/**
 * GET /api/events/webhooks/portal
 * Get a URL to the SVIX App Portal for managing webhooks
 */
export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isSvixEnabled()) {
      return NextResponse.json(
        { error: 'Webhook events are not configured' },
        { status: 503 }
      )
    }

    const portalUrl = await getUserWebhookPortalUrl(session.user.id)

    if (!portalUrl) {
      return NextResponse.json(
        { error: 'Failed to get portal URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({ url: portalUrl })
  } catch (error) {
    console.error('Error getting portal URL:', error)
    return NextResponse.json(
      { error: 'Failed to get portal URL' },
      { status: 500 }
    )
  }
}

