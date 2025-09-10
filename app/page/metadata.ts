import type { Metadata } from 'next'

export const homePageMetadata: Metadata = {
  title: 'inbound - The Modern Email Infrastructure Platform for Developers',
  description: 'Stop struggling with email infrastructure. inbound provides unlimited email processing, TypeScript SDK, and webhook integration. Better than Mailgun, SendGrid, or Postmark at 90% less cost.',
  keywords: [
    'email infrastructure',
    'inbound email',
    'email API',
    'webhook email',
    'email parsing',
    'developer email tools',
    'mailgun alternative',
    'sendgrid alternative',
    'postmark alternative',
    'email webhook service',
    'email to webhook',
    'typescript email SDK',
    'email automation',
    'custom domain email',
    'email processing API',
    'modern email platform'
  ],
  openGraph: {
    title: 'inbound - The Modern Email Infrastructure Platform for Developers',
    description: 'Stop struggling with email infrastructure. Get unlimited email processing, TypeScript SDK, and webhook integration at 90% less cost than competitors.',
    type: 'website',
    url: 'https://inbound.new',
    siteName: 'inbound',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'inbound - Modern Email Infrastructure Platform',
      },
    ],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'inbound - The Modern Email Infrastructure Platform for Developers',
    description: 'Stop struggling with email infrastructure. Get unlimited email processing, TypeScript SDK, and webhook integration.',
    images: ['/twitter-image.png'],
    creator: '@inboundemail',
    site: '@inboundemail',
  },
  alternates: {
    canonical: 'https://inbound.new',
  },
  other: {
    'google-site-verification': process.env.GOOGLE_SITE_VERIFICATION || '',
  }
}

