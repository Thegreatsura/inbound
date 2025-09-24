"use client"

import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { PostRetryDeliveryRequest, PostRetryDeliveryResponse } from '@/app/api/v2/emails/[id]/retry-delivery/route'

interface RetryDeliveryParams {
  emailId: string
  deliveryId: string
}

export function useRetryDeliveryMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ emailId, deliveryId }: RetryDeliveryParams): Promise<PostRetryDeliveryResponse> => {
      const requestData: PostRetryDeliveryRequest = {
        deliveryId
      }

      const response = await fetch(`/api/v2/emails/${emailId}/retry-delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      return response.json()
    },
    onSuccess: (data, variables) => {
      console.log('✅ Delivery retry completed:', data)
      
      // Invalidate related queries to refresh the UI
      // Note: This assumes there might be queries for email details or delivery lists
      queryClient.invalidateQueries({
        queryKey: ['email', variables.emailId]
      })
      
      queryClient.invalidateQueries({
        queryKey: ['deliveries', variables.emailId]
      })
    },
    onError: (error, variables) => {
      console.error('❌ Delivery retry failed:', error, variables)
    }
  })
}
