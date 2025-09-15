import { useQuery } from '@tanstack/react-query'
import type { EndpointConfig } from '../types'

export type GetEndpointByIdResponse = {
  id: string
  name: string
  type: 'webhook' | 'email' | 'email_group'
  config: EndpointConfig
  isActive: boolean
  description: string | null
  userId: string
  createdAt: string | null
  updatedAt: string | null
  groupEmails: string[] | null
  deliveryStats: {
    total: number
    successful: number
    failed: number
    lastDelivery: string | null
  }
  recentDeliveries: Array<{
    id: string
    emailId: string
    deliveryType: string
    status: string
    attempts: number
    lastAttemptAt: string | null
    responseData: any
    createdAt: string | null
  }>
  associatedEmails: Array<{
    id: string
    address: string
    isActive: boolean
    createdAt: string | null
  }>
  catchAllDomains: Array<{
    id: string
    domain: string
    status: string
  }>
}

export const useEndpointByIdQuery = (endpointId: string | null) => {
  return useQuery<GetEndpointByIdResponse>({
    queryKey: ['endpoint', endpointId],
    queryFn: async () => {
      if (!endpointId) throw new Error('Endpoint ID is required')
      const response = await fetch(`/api/v2/endpoints/${endpointId}`)
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error || `Failed to load endpoint (${response.status})`)
      }
      return response.json()
    },
    enabled: !!endpointId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}


