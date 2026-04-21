import { useQuery } from '@tanstack/react-query'
import { domainsApi, type DomainStatsResponse } from '../api/domainsApi'

export const domainKeys = {
  all: ['domains'] as const,
  stats: () => [...domainKeys.all, 'stats'] as const,
}

export const useDomainsStatsQuery = () => {
  return useQuery({
    queryKey: domainKeys.stats(),
    queryFn: domainsApi.getDomainStats,
  })
} 