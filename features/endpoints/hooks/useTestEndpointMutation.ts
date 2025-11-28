import { useMutation } from '@tanstack/react-query'
import { client } from '@/lib/api/client'
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
  
  const { data, error } = await client.api.e2.endpoints({ id }).test.post({
    webhookFormat,
    overrideUrl,
  })
  
  if (error) {
    // Handle error responses - they might have success: false
    const errorData = error as any
    if (errorData?.success === false) {
      return errorData as TestEndpointResponse
    }
    throw new Error(errorData?.error || errorData?.message || 'Failed to test endpoint')
  }
  
  return data as TestEndpointResponse
}

export const useTestEndpointMutation = () => {
  return useMutation({
    mutationFn: testEndpoint,
  })
}