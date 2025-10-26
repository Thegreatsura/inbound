import type { Metadata } from 'next'
import BimiGeneratorClient from './client'

export const metadata: Metadata = {
  title: 'BIMI DNS Record Generator - Display Your Logo in Gmail & Yahoo Mail',
  description: 'Free BIMI DNS record generator. Create Brand Indicators for Message Identification records to display your verified logo in Gmail, Yahoo Mail, and other email clients. Includes setup instructions.',
  keywords: [
    'BIMI generator',
    'BIMI DNS record',
    'brand indicators for message identification',
    'email logo verification',
    'Gmail logo',
    'Yahoo Mail logo',
    'verified mark certificate',
    'VMC',
    'email authentication',
    'DMARC',
    'email branding',
    'brand logo email',
    'BIMI setup',
    'email deliverability',
    'sender verification'
  ],
  openGraph: {
    title: 'BIMI DNS Record Generator - Display Your Logo in Email',
    description: 'Free tool to generate BIMI DNS records. Display your verified brand logo in Gmail, Yahoo Mail, and more with proper email authentication.',
    type: 'website',
    url: 'https://inbound.new/bimi-generator',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BIMI DNS Record Generator',
    description: 'Generate BIMI DNS records to display your logo in Gmail, Yahoo Mail, and other email clients.',
  },
  alternates: {
    canonical: 'https://inbound.new/bimi-generator'
  }
}

export default function BimiGeneratorPage() {
  return <BimiGeneratorClient />
}
