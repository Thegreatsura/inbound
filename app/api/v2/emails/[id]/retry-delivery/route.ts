import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth'
import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { structuredEmails, endpointDeliveries, endpoints } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { routeEmail } from '@/lib/email-management/email-router'

/**
 * POST /api/v2/emails/{id}/retry-delivery
 * Retries endpoint delivery for a failed delivery
 * Requires delivery ID in the request body
 */

export interface PostRetryDeliveryRequest {
  deliveryId: string
}

export interface PostRetryDeliveryResponse {
  success: boolean
  message: string
  deliveryId?: string
  error?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: emailId } = await params
  console.log(`🔄 POST /api/v2/emails/${emailId}/retry-delivery - Starting retry process`)

  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user?.id) {
      console.warn(`❌ Retry delivery - Unauthorized request for email ${emailId}`)
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Parse request body
    let requestData: PostRetryDeliveryRequest
    try {
      const body = await request.text()
      requestData = JSON.parse(body)
    } catch (error) {
      console.error('❌ Retry delivery - Invalid request body:', error)
      return NextResponse.json(
        { success: false, error: 'Invalid request body' },
        { status: 400 }
      )
    }

    if (!requestData.deliveryId) {
      return NextResponse.json(
        { success: false, error: 'deliveryId is required' },
        { status: 400 }
      )
    }

    // Verify the email belongs to the user and get the actual emailId used in deliveries
    const emailRecord = await db
      .select({
        id: structuredEmails.id,
        emailId: structuredEmails.emailId, // This is what endpointDeliveries references
      })
      .from(structuredEmails)
      .where(and(
        eq(structuredEmails.id, emailId),
        eq(structuredEmails.userId, userId)
      ))
      .limit(1)

    if (!emailRecord[0]) {
      console.warn(`❌ Retry delivery - Email ${emailId} not found or unauthorized`)
      return NextResponse.json(
        { success: false, error: 'Email not found or access denied' },
        { status: 404 }
      )
    }

    const actualEmailId = emailRecord[0].emailId
    console.log(`🔄 Retry delivery - URL emailId: ${emailId}, actual emailId for deliveries: ${actualEmailId}, deliveryId: ${requestData.deliveryId}`)

    // Get the delivery record and verify it belongs to this email using the correct emailId
    const deliveryRecord = await db
      .select({
        id: endpointDeliveries.id,
        emailId: endpointDeliveries.emailId,
        endpointId: endpointDeliveries.endpointId,
        status: endpointDeliveries.status,
        attempts: endpointDeliveries.attempts,
        deliveryType: endpointDeliveries.deliveryType
      })
      .from(endpointDeliveries)
      .where(and(
        eq(endpointDeliveries.id, requestData.deliveryId),
        eq(endpointDeliveries.emailId, actualEmailId) // Use the correct emailId
      ))
      .limit(1)

    if (!deliveryRecord[0]) {
      console.warn(`❌ Retry delivery - Delivery ${requestData.deliveryId} not found for actualEmailId ${actualEmailId} (structuredEmail: ${emailId})`)
      return NextResponse.json(
        { success: false, error: 'Delivery record not found' },
        { status: 404 }
      )
    }

    const delivery = deliveryRecord[0]

    // Allow retrying deliveries regardless of their current status
    // This enables re-delivery for both successful and failed deliveries

    // Verify the endpoint still exists and is active
    const endpointRecord = await db
      .select()
      .from(endpoints)
      .where(and(
        eq(endpoints.id, delivery.endpointId),
        eq(endpoints.userId, userId),
        eq(endpoints.isActive, true)
      ))
      .limit(1)

    if (!endpointRecord[0]) {
      console.warn(`❌ Retry delivery - Endpoint ${delivery.endpointId} not found or inactive`)
      return NextResponse.json(
        { success: false, error: 'Endpoint not found or inactive' },
        { status: 400 }
      )
    }

    console.log(`🔄 Retry delivery - Starting retry for delivery ${requestData.deliveryId}`)

    // Update the delivery record to increment attempts
    await db
      .update(endpointDeliveries)
      .set({
        attempts: (delivery.attempts || 0) + 1,
        status: 'pending',
        lastAttemptAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(endpointDeliveries.id, requestData.deliveryId))

    try {
      // Use the existing email router to retry delivery
      // This will create a new delivery record on success/failure
      // Note: routeEmail expects structuredEmails.emailId, not structuredEmails.id
      await routeEmail(actualEmailId)

      console.log(`✅ Retry delivery - Successfully retried delivery ${requestData.deliveryId} using actualEmailId: ${actualEmailId}`)
      
      return NextResponse.json({
        success: true,
        message: 'Email re-delivery initiated successfully',
        deliveryId: requestData.deliveryId
      })

    } catch (retryError) {
      console.error(`❌ Retry delivery - Retry failed for actualEmailId ${actualEmailId}:`, retryError)
      
      // Update delivery record to reflect failure
      await db
        .update(endpointDeliveries)
        .set({
          status: 'failed',
          lastAttemptAt: new Date(),
          responseData: JSON.stringify({
            error: retryError instanceof Error ? retryError.message : 'Unknown retry error',
            retryAttempt: true,
            actualEmailId,
            structuredEmailId: emailId,
            failedAt: new Date().toISOString()
          }),
          updatedAt: new Date()
        })
        .where(eq(endpointDeliveries.id, requestData.deliveryId))

      return NextResponse.json({
        success: false,
        message: 'Delivery retry failed',
        error: retryError instanceof Error ? retryError.message : 'Unknown error',
        deliveryId: requestData.deliveryId
      })
    }

  } catch (error) {
    console.error(`💥 Retry delivery - Unexpected error:`, error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: 'Failed to retry delivery'
      },
      { status: 500 }
    )
  }
}
