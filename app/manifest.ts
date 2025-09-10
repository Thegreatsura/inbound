import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  const baseUrl = process.env.NEXT_PUBLIC_BETTER_AUTH_URL || 'https://inbound.new'
  
  return {
    name: 'inbound - Email Infrastructure Platform',
    short_name: 'inbound',
    description: 'The modern email infrastructure platform for developers. Receive, parse, and manage inbound emails with powerful APIs, webhooks, and real-time processing.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1C2894',
    categories: ['productivity', 'developer-tools', 'business'],
    lang: 'en',
    scope: '/',
    orientation: 'any',
    icons: [
      {
        src: '/images/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/images/icon-512.png', 
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      },
      {
        src: '/favicon.ico',
        sizes: '64x64 32x32 24x24 16x16',
        type: 'image/x-icon'
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png'
      }
    ],
    screenshots: [
      {
        src: '/images/screenshot-wide.png',
        sizes: '2880x1800',
        type: 'image/png',
        form_factor: 'wide',
        label: 'inbound Email Dashboard'
      },
      {
        src: '/images/screenshot-narrow.png', 
        sizes: '1284x2778',
        type: 'image/png',
        form_factor: 'narrow',
        label: 'inbound Mobile View'
      }
    ],
    shortcuts: [
      {
        name: 'Dashboard',
        short_name: 'Dashboard',
        description: 'Access your email dashboard',
        url: '/logs',
        icons: [
          {
            src: '/images/shortcut-dashboard.png',
            sizes: '96x96',
            type: 'image/png'
          }
        ]
      },
      {
        name: 'Add Domain', 
        short_name: 'Add Domain',
        description: 'Add a new email domain',
        url: '/add',
        icons: [
          {
            src: '/images/shortcut-add.png',
            sizes: '96x96', 
            type: 'image/png'
          }
        ]
      },
      {
        name: 'Documentation',
        short_name: 'Docs',
        description: 'View API documentation',
        url: '/docs',
        icons: [
          {
            src: '/images/shortcut-docs.png',
            sizes: '96x96',
            type: 'image/png' 
          }
        ]
      }
    ],
    related_applications: [
      {
        platform: 'web',
        url: 'https://docs.inbound.new',
        id: 'inbound-docs'
      }
    ]
  }
}

