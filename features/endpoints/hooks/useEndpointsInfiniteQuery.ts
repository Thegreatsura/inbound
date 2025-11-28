import { useInfiniteQuery } from '@tanstack/react-query'
import { client } from '@/lib/api/client'
import type { EndpointWithStats } from '../types'

export type EndpointsInfiniteQueryParams = {
  sortBy?: 'newest' | 'oldest'
  type?: 'webhook' | 'email' | 'email_group'
  active?: boolean
  search?: string
  limit?: number
}

type EndpointsPage = {
  data: EndpointWithStats[]
  pagination: {
    total: number
    hasMore: boolean
    limit: number
    offset: number
  }
}

async function fetchEndpointsPage(
  params: EndpointsInfiniteQueryParams & { offset: number }
): Promise<EndpointsPage> {
  const { data, error } = await client.api.e2.endpoints.get({
    query: {
      sortBy: params.sortBy,
      type: params.type,
      active: params.active !== undefined ? (params.active ? 'true' : 'false') : undefined,
      search: params.search,
      limit: params.limit || 50,
      offset: params.offset,
    }
  })

  if (error) {
    throw new Error((error as any)?.error || 'Failed to fetch endpoints')
  }

  return {
    data: (data?.data || []) as unknown as EndpointWithStats[],
    pagination: data?.pagination || { total: 0, hasMore: false, limit: 50, offset: 0 }
  }
}

/**
 * Infinite query hook for endpoints with pagination support.
 * Ideal for infinite scroll in selectors and lists.
 */
export const useEndpointsInfiniteQuery = (params?: EndpointsInfiniteQueryParams) => {
  const limit = params?.limit || 50

  return useInfiniteQuery({
    queryKey: ['endpoints', 'infinite', params],
    queryFn: ({ pageParam = 0 }) => fetchEndpointsPage({ 
      ...params, 
      offset: pageParam,
      limit 
    }),
    getNextPageParam: (lastPage) => {
      if (!lastPage.pagination.hasMore) return undefined
      return lastPage.pagination.offset + lastPage.pagination.limit
    },
    initialPageParam: 0,
    staleTime: 30 * 1000, // 30 seconds
    refetchOnWindowFocus: false, // Don't refetch on focus for infinite lists
  })
}

/**
 * Helper to flatten all pages into a single array of endpoints
 */
export function flattenEndpointPages(pages: EndpointsPage[] | undefined): EndpointWithStats[] {
  if (!pages) return []
  return pages.flatMap(page => page.data)
}
