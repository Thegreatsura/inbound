import { useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from '@/lib/api/client'
import type { UpdateEndpointData, Endpoint } from '../types'

async function updateEndpoint(params: { id: string; data: UpdateEndpointData }): Promise<Endpoint> {
  const { id, data } = params
  
  const { data: result, error } = await client.api.e2.endpoints({ id }).put({
    name: data.name,
    description: data.description,
    isActive: data.isActive,
    config: data.config,
    webhookFormat: data.webhookFormat,
  })
  
  if (error) {
    throw new Error((error as any)?.error || (error as any)?.details || 'Failed to update endpoint')
  }
  
  return result as Endpoint
}

export const useUpdateEndpointMutation = () => {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: updateEndpoint,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['endpoints'] })
      if (variables?.id) {
        queryClient.invalidateQueries({ queryKey: ['endpoint', variables.id] })
      }
    },
  })
} 