import { useQuery } from '@tanstack/react-query'
import type { EndpointWithStats, EndpointConfig } from '../types'

type EndpointByIdResponse = Omit<EndpointWithStats, 'config'> & { config: EndpointConfig }

export const useEndpointByIdQuery = (endpointId: string | null) => {
  return useQuery<EndpointByIdResponse>({
    queryKey: ['endpoint', endpointId],
    queryFn: async () => {
      if (!endpointId) throw new Error('Endpoint ID is required')
      const response = await fetch(`/api/v2/endpoints/${endpointId}`)
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || `Failed to load endpoint (${response.status})`)
      }
      return response.json() as Promise<EndpointByIdResponse>
    },
    enabled: !!endpointId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}


