import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { WebhookFormat } from '@/lib/db/schema'

export type TestEndpointRequest = {
  id: string
  webhookFormat?: WebhookFormat
  overrideUrl?: string
}

export type TestEndpointResponse = {
  success: boolean
  message: string
  responseTime: number
  statusCode?: number
  responseBody?: string
  error?: string
  testPayload?: any
  webhookFormat?: WebhookFormat
  urlTested?: string
}

async function testEndpoint(params: TestEndpointRequest): Promise<TestEndpointResponse> {
  const { id, webhookFormat, overrideUrl } = params
  
  // Use v2 API endpoint
  const response = await fetch(`/api/v2/endpoints/${id}/test`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...(webhookFormat ? { webhookFormat } : {}),
      ...(overrideUrl ? { overrideUrl } : {}),
    }),
  })
  
  if (!response.ok) {
    let message = 'Failed to test endpoint'
    try {
      const err = await response.json()
      message = err.error || message
    } catch {
      const text = await response.text().catch(() => '')
      message = text || message
    }
    throw new Error(message)
  }
  
  return await response.json()
}

export const useTestEndpointMutation = () => {
  return useMutation({
    mutationFn: testEndpoint,
  })
}