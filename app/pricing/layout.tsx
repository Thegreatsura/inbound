import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pricing - Affordable Email Infrastructure for Developers | inbound',
  description: 'Transparent pricing for email infrastructure. Start free with 5,000 emails/month. Pro plans from $15/month with unlimited aliases, advanced features, and priority support.',
  keywords: [
    'email pricing',
    'email API pricing',
    'inbound email pricing',
    'email infrastructure cost',
    'email service pricing',
    'developer email pricing',
    'email platform pricing',
    'affordable email service',
    'email webhook pricing',
    'email processing pricing'
  ],
  openGraph: {
    title: 'Pricing - Affordable Email Infrastructure for Developers',
    description: 'Transparent pricing for email infrastructure. Start free with 5,000 emails/month. Pro plans from $15/month with unlimited aliases, advanced features, and priority support.',
    url: 'https://inbound.new/pricing',
    siteName: 'inbound',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'inbound - Pricing Plans'
      }
    ],
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing - Affordable Email Infrastructure for Developers',
    description: 'Transparent pricing for email infrastructure. Start free with 5,000 emails/month. Pro plans from $15/month.',
    images: ['/twitter-image.png']
  },
  alternates: {
    canonical: 'https://inbound.new/pricing'
  }
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
