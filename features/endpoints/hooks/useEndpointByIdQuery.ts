import { useQuery } from '@tanstack/react-query'
import { client } from '@/lib/api/client'
import type { ApiEndpointDetailResponse } from '../types'

export const useEndpointByIdQuery = (endpointId: string | null) => {
  return useQuery<ApiEndpointDetailResponse>({
    queryKey: ['endpoint', endpointId],
    queryFn: async () => {
      if (!endpointId) throw new Error('Endpoint ID is required')
      
      const { data, error } = await client.api.e2.endpoints({ id: endpointId }).get()
      
      if (error) {
        throw new Error((error as any)?.error || 'Failed to load endpoint')
      }
      
      return data as ApiEndpointDetailResponse
    },
    enabled: !!endpointId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}
