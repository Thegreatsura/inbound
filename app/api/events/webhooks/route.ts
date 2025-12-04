import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { headers } from 'next/headers'
import {
  listUserWebhookEndpoints,
  createUserWebhookEndpoint,
} from '@/lib/svix/user-management'
import { isSvixEnabled } from '@/lib/svix'
import { SVIX_EVENT_TYPES } from '@/lib/svix/event-types'

/**
 * GET /api/events/webhooks
 * List all webhook endpoints for the current user
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
      return NextResponse.json({ 
        enabled: false,
        endpoints: [],
        eventTypes: Object.values(SVIX_EVENT_TYPES),
      })
    }

    const endpoints = await listUserWebhookEndpoints(session.user.id)

    return NextResponse.json({
      enabled: true,
      endpoints,
      eventTypes: Object.values(SVIX_EVENT_TYPES),
    })
  } catch (error) {
    console.error('Error fetching webhooks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch webhooks' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/events/webhooks
 * Create a new webhook endpoint
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { url, description, filterTypes } = body

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Validate filter types if provided
    const validEventTypes = Object.values(SVIX_EVENT_TYPES)
    if (filterTypes && filterTypes.length > 0) {
      const invalidTypes = filterTypes.filter((t: string) => !validEventTypes.includes(t as any))
      if (invalidTypes.length > 0) {
        return NextResponse.json(
          { error: `Invalid event types: ${invalidTypes.join(', ')}` },
          { status: 400 }
        )
      }
    }

    const result = await createUserWebhookEndpoint(
      session.user.id,
      url,
      description,
      filterTypes
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to create webhook' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      endpointId: result.endpointId,
      secret: result.secret,
    })
  } catch (error) {
    console.error('Error creating webhook:', error)
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    )
  }
}

