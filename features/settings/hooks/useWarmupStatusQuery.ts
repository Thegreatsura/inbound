import { useQuery } from '@tanstack/react-query'
import { getUserWarmupStatus, WarmupStatus } from '@/app/actions/warmup-status'

/**
 * Hook to fetch user's warmup status (new account daily limits)
 */
export function useWarmupStatusQuery() {
  return useQuery<WarmupStatus | null>({
    queryKey: ['warmup-status'],
    queryFn: async () => {
      const result = await getUserWarmupStatus()
      if (!result.success) {
        console.error('Failed to fetch warmup status:', result.error)
        return null
      }
      return result.status || null
    },
    staleTime: 60 * 1000, // 1 minute - check relatively frequently
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    retry: 1,
  })
}

