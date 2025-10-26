import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Types
export interface ScheduledEmailItem {
  id: string
  from: string
  to: string[]
  subject: string
  scheduled_at: string
  status: string
  timezone: string
  created_at: string
  attempts: number
  last_error?: string
  html?: string
  text?: string
}

export interface GetScheduledEmailsResponse {
  data: ScheduledEmailItem[]
  pagination: {
    limit: number
    offset: number
    total: number
    hasMore: boolean
  }
}

export interface CancelScheduledEmailResponse {
  success: boolean
  message: string
  id: string
}

// Query keys
export const scheduledEmailsKeys = {
  all: ['scheduled-emails'] as const,
  lists: () => [...scheduledEmailsKeys.all, 'list'] as const,
  list: (params?: { limit?: number; offset?: number; status?: string }) => 
    [...scheduledEmailsKeys.lists(), params] as const,
  details: () => [...scheduledEmailsKeys.all, 'detail'] as const,
  detail: (id: string) => [...scheduledEmailsKeys.details(), id] as const,
}

// Hook for listing scheduled emails
export function useScheduledEmailsQuery(params?: {
  limit?: number
  offset?: number
  status?: string
}) {
  return useQuery<GetScheduledEmailsResponse>({
    queryKey: scheduledEmailsKeys.list(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (params?.limit) searchParams.set('limit', params.limit.toString())
      if (params?.offset) searchParams.set('offset', params.offset.toString())
      if (params?.status) searchParams.set('status', params.status)

      const response = await fetch(`/api/v2/emails/schedule?${searchParams}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch scheduled emails')
      }
      return response.json()
    },
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true, // Refetch when window regains focus
  })
}

// Hook for getting scheduled email details
export function useScheduledEmailQuery(id: string, enabled = true) {
  return useQuery<ScheduledEmailItem>({
    queryKey: scheduledEmailsKeys.detail(id),
    queryFn: async () => {
      const response = await fetch(`/api/v2/emails/schedule/${id}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch scheduled email')
      }
      return response.json()
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

// Hook for cancelling a scheduled email
export function useCancelScheduledEmailMutation() {
  const queryClient = useQueryClient()

  return useMutation<CancelScheduledEmailResponse, Error, string>({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/v2/emails/schedule/${id}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to cancel scheduled email')
      }
      
      return response.json()
    },
    onSuccess: () => {
      // Invalidate and refetch scheduled emails list
      queryClient.invalidateQueries({ queryKey: scheduledEmailsKeys.lists() })
    },
  })
}

