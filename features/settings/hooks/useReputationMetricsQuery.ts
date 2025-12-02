import { useQuery } from '@tanstack/react-query'
import { getUserReputationMetrics, ReputationMetrics } from '@/app/actions/reputation-metrics'

/**
 * Hook to fetch user's reputation metrics from AWS CloudWatch
 */
export function useReputationMetricsQuery() {
  return useQuery<ReputationMetrics | null>({
    queryKey: ['reputation-metrics'],
    queryFn: async () => {
      const result = await getUserReputationMetrics()
      if (!result.success) {
        console.error('Failed to fetch reputation metrics:', result.error)
        return null
      }
      return result.metrics || null
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - metrics don't change frequently
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  })
}

