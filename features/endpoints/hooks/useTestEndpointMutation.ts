import { useMutation } from '@tanstack/react-query'

export type WebhookFormat = 'inbound' | 'discord' | 'slack'

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
    const error = await response.json()
    throw new Error(error.error || 'Failed to test endpoint')
  }
  
  return await response.json()
}

export const useTestEndpointMutation = () => {
  return useMutation({
    mutationFn: testEndpoint,
  })
} 