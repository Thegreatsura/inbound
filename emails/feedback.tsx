import { Body, Head, Html, Preview } from '@react-email/components'
import * as React from 'react'

interface FeedbackEmailProps {
  userFirstname?: string
  userEmail: string
  feedback: string
  submittedAt?: string
}

export const FeedbackEmail = ({
  userFirstname = 'User',
  userEmail,
  feedback,
  submittedAt = new Date().toLocaleDateString(),
}: FeedbackEmailProps) => (
  <Html>
    <Head>
      <style>{`* { font-family: Outfit, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; letter-spacing: -0.02em; }`}</style>
    </Head>
    <Preview>New feedback from {userFirstname} • inbound</Preview>
    <Body style={body}>
      <div style={card}>
        {/* Header */}
        <div style={header}>
          <div style={brandText}>inbound</div>
          <h1 style={title}>New feedback received</h1>
          <p style={subtitle}>
            From <strong style={{ color: '#1f2937' }}>{userFirstname}</strong> ({userEmail})
          </p>
        </div>
      

        {/* Feedback */}
        <div style={block}>
          <div style={blockHeader}>Message</div>
          <p style={blockBody}>{feedback}</p>
        </div>

        {/* Footer */}
        <div style={footer}>
          <p style={footerText}>You can reply directly to this email to respond to {userFirstname}.</p>
          <p style={links}>
            <a href="https://inbound.new/dashboard" style={link}>dashboard</a>
            <span style={dot}>•</span>
            <a href="https://inbound.new/docs" style={link}>docs</a>
          </p>
        </div>
      </div>
    </Body>
  </Html>
)

export default FeedbackEmail

// Light-only modern styles
const body = {
  margin: 0,
  padding: 20,
  background: '#ffffff',
}

const card = {
  maxWidth: 640,
  margin: '0 auto',
  background: '#ffffff',
  borderRadius: 20,
  border: '1px solid rgba(0,0,0,0.08)',
  padding: 28,
}

const header = {
  textAlign: 'left' as const,
  marginBottom: 16,
}

const brandText = {
  fontSize: 24,
  fontWeight: 600,
  color: '#1f2937',
  marginBottom: 10,
}

const title = {
  margin: '0 0 6px 0',
  fontSize: 26,
  lineHeight: 1.25,
  color: '#111827',
}

const subtitle = {
  margin: 0,
  color: '#6b7280',
  fontSize: 14,
}

const metaTable = {
  marginTop: 8,
  marginBottom: 4,
} as const

const metaCellLeft = {
  padding: '0 12px 0 0',
  verticalAlign: 'top' as const,
}

const metaDividerCell = {
  width: 1,
  borderLeft: '1px solid rgba(0,0,0,0.12)',
}

const metaCellRight = {
  padding: '0 0 0 12px',
  verticalAlign: 'top' as const,
}

const metaLabel = {
  color: '#6b7280',
  fontSize: 12,
}

const metaValue = {
  color: '#111827',
  fontSize: 14,
  fontWeight: 500,
}


const block = {
  background: '#f8fafc',
  border: '1px solid rgba(0,0,0,0.06)',
  borderRadius: 14,
  padding: 16,
  marginTop: 8,
}

const blockHeader = {
  color: '#334155',
  fontWeight: 600,
  fontSize: 14,
  marginBottom: 8,
}

const blockBody = {
  color: '#334155',
  fontSize: 16,
  lineHeight: '24px',
  margin: 0,
  whiteSpace: 'pre-wrap' as const,
}

const footer = {
  textAlign: 'center' as const,
  marginTop: 20,
  paddingTop: 12,
  borderTop: '1px solid rgba(0,0,0,0.08)'
}

const footerText = {
  color: '#6b7280',
  fontSize: 12,
  margin: '0 0 8px 0',
}

const links = {
  margin: 0,
}

const link = {
  color: '#6C47FF',
  textDecoration: 'underline',
  fontWeight: 500,
  fontSize: 14,
}

const dot = {
  color: '#9ca3af',
  margin: '0 8px',
}