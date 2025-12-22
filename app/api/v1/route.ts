import { NextRequest, NextResponse } from 'next/server'
import { getOpenAPISpec } from '@/lib/openapi/spec'

const ALLOWED_ORIGINS = [
  'https://inbound.email',
  'https://www.inbound.email',
  'https://app.inbound.email',
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean) as string[]

function getCorsOrigin(request: NextRequest): string {
  const origin = request.headers.get('origin')
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return origin
  }
  return ALLOWED_ORIGINS[0] || 'https://inbound.email'
}

export async function GET(request: NextRequest) {
  try {
    const spec = await getOpenAPISpec()
    const corsOrigin = getCorsOrigin(request)

    return NextResponse.json(spec, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  } catch (error) {
    console.error('Error generating OpenAPI spec:', error)
    return NextResponse.json(
      { error: 'Failed to generate API specification' },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  const corsOrigin = getCorsOrigin(request)

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
} 