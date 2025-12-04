import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { headers } from 'next/headers'
import { deleteUserWebhookEndpoint, updateUserWebhookEndpoint } from '@/lib/svix/user-management'
import { isSvixEnabled } from '@/lib/svix'
import { SVIX_EVENT_TYPES } from '@/lib/svix/event-types'

/**
 * PATCH /api/events/webhooks/[endpointId]
 * Update a webhook endpoint
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ endpointId: string }> }
) {
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

    const { endpointId } = await params
    const body = await request.json()
    const { url, description, filterTypes, disabled } = body

    // URL is required for SVIX updates
    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Validate URL format
    try {
      new URL(url)
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Validate filter types if provided
    if (filterTypes && filterTypes.length > 0) {
      const validEventTypes = Object.values(SVIX_EVENT_TYPES)
      const invalidTypes = filterTypes.filter((t: string) => !validEventTypes.includes(t as any))
      if (invalidTypes.length > 0) {
        return NextResponse.json(
          { error: `Invalid event types: ${invalidTypes.join(', ')}` },
          { status: 400 }
        )
      }
    }

    const result = await updateUserWebhookEndpoint(session.user.id, endpointId, {
      url,
      description,
      filterTypes,
      disabled,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to update webhook' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating webhook:', error)
    return NextResponse.json(
      { error: 'Failed to update webhook' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/events/webhooks/[endpointId]
 * Delete a webhook endpoint
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ endpointId: string }> }
) {
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

    const { endpointId } = await params

    const result = await deleteUserWebhookEndpoint(session.user.id, endpointId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to delete webhook' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting webhook:', error)
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    )
  }
}

