import { useMutation, useQueryClient } from '@tanstack/react-query'
import { track } from '@vercel/analytics'
import { client } from '@/lib/api/client'
import type { CreateEndpointData, ApiEndpointResponse } from '../types'

async function createEndpoint(data: CreateEndpointData): Promise<ApiEndpointResponse> {
  const { data: result, error } = await client.api.e2.endpoints.post({
    name: data.name,
    type: data.type,
    config: data.config,
    description: data.description,
  })
  
  if (error) {
    throw new Error((error as any)?.error || (error as any)?.details || 'Failed to create endpoint')
  }
  
  return result as ApiEndpointResponse
}

export const useCreateEndpointMutation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: createEndpoint,
    onSuccess: (endpoint) => {
      // Track endpoint creation
      track('Endpoint Created', {
        endpointType: endpoint.type,
        endpointName: endpoint.name,
        endpointId: endpoint.id
      })
      
      // Invalidate and refetch endpoints list
      queryClient.invalidateQueries({ queryKey: ['endpoints'] })
    },
  })
} 