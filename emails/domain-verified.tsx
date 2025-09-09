import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface DomainVerifiedEmailProps {
  userFirstname?: string;
  domain?: string;
  verifiedAt?: string;
}

export const DomainVerifiedEmail = ({
  userFirstname = 'User',
  domain = 'example.com',
  verifiedAt = new Date().toLocaleDateString(),
}: DomainVerifiedEmailProps) => (
  <Html>
    <Head>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>{`
        @media (prefers-color-scheme: dark) {
          .dark-mode { display: block !important; }
          .light-mode { display: none !important; }
        }
        @media (prefers-color-scheme: light) {
          .dark-mode { display: none !important; }
          .light-mode { display: block !important; }
        }
      `}</style>
    </Head>
    <Preview>🎉 {domain} is verified and ready - inbound</Preview>
    <Body style={main}>
      {/* Light Mode Version */}
      <div className="light-mode" style={lightMode}>
        <div style={outerContainer}>
          <div style={innerContainer}>
            {/* Header */}
            <Section style={headerSection}>
              <div style={logoContainer}>
                <Img src="https://inbound.new/inbound-logo.png" alt="inbound" width={24} height={24} style={{ marginRight: '4px' }} />
                <Text style={logoText}>inbound</Text>
              </div>
              <Heading style={heading}>🎉 Domain Verified!</Heading>
              <Text style={subheading}>
                Your domain is now ready to receive emails
              </Text>
            </Section>

            <Text style={text}>
              Hi {userFirstname},
            </Text>

            <Text style={text}>
              Your domain <strong style={strongText}>{domain}</strong> is now verified and ready to receive emails through inbound.
            </Text>

            <Section style={detailsSection}>
              <Text style={detailText}>
                ✅ Verified on {verifiedAt}<br />
                ✅ Email receiving active<br />
                ✅ Email sending active
              </Text>
            </Section>

            <Section style={buttonSection}>
              <Button style={button} href="https://inbound.new/dashboard">
                Open Dashboard
              </Button>
            </Section>

            <Section style={signatureSection}>
              <Text style={text}>
                Reply to this email if you have any questions, we read every email
              </Text>
              <Text style={signatureText}>
                - ryan
              </Text>
            </Section>

            <Section style={footerSection}>
              <Text style={footerText}>
                <Link href="https://inbound.new/docs" style={link}>docs</Link> • <Link href="https://inbound.new/support" style={link}>support</Link>
              </Text>
            </Section>
          </div>
        </div>

        {/* Footer */}
        <div style={bottomFooter}>
          <Text style={bottomFooterText}>
            © {new Date().getFullYear()} inbound • Email infrastructure, redefined
          </Text>
        </div>
      </div>

      {/* Dark Mode Version */}
      <div className="dark-mode" style={darkMode}>
        <div style={outerContainerDark}>
          <div style={innerContainerDark}>
            {/* Header */}
            <Section style={headerSectionDark}>
              <div style={logoContainer}>
              <Img src="https://inbound.new/inbound-logo.png" alt="inbound" width={24} height={24} style={{ marginRight: '4px' }} />
                <Text style={logoTextDark}>inbound</Text>
              </div>
              <Heading style={headingDark}>🎉 Domain Verified!</Heading>
              <Text style={subheadingDark}>
                Your domain is now ready to receive emails
              </Text>
            </Section>

            <Text style={textDark}>
              Hi {userFirstname},
            </Text>

            <Text style={textDark}>
              Your domain <strong style={strongTextDark}>{domain}</strong> is now verified and ready to receive emails through inbound.
            </Text>

            <Section style={detailsSectionDark}>
              <Text style={detailTextDark}>
                ✅ Verified on {verifiedAt}<br />
                ✅ Email receiving active<br />
                ✅ AWS SES configured
              </Text>
            </Section>

            <Section style={buttonSection}>
                <Button style={buttonDark} href="https://inbound.new/dashboard">
                Open Dashboard
              </Button>
            </Section>

            <Section style={signatureSection}>
              <Text style={textDark}>
                Reply to this email if you have any questions, we read every email
              </Text>
              <Text style={signatureTextDark}>
                - ryan
              </Text>
            </Section>

            <Section style={footerSectionDark}>
              <Text style={footerTextDark}>
                <Link href="https://inbound.new/docs" style={linkDark}>docs</Link> • <Link href="https://inbound.new/support" style={linkDark}>support</Link>
              </Text>
            </Section>
          </div>
        </div>

        {/* Footer */}
        <div style={bottomFooter}>
          <Text style={bottomFooterTextDark}>
            © {new Date().getFullYear()} inbound • Email infrastructure, redefined
          </Text>
        </div>
      </div>
    </Body>
  </Html>
);

export default DomainVerifiedEmail;

// Styles
const main = {
  margin: '0',
  padding: '20px',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  letterSpacing: '-0.04em',
};

// Light Mode Styles
const lightMode = {
  display: 'block',
};

const outerContainer = {
  maxWidth: '600px',
  margin: '0 auto',
  background: 'linear-gradient(135deg, rgba(248, 250, 252, 0.6), rgba(241, 245, 249, 0.4))',
  borderRadius: '30px',
  overflow: 'hidden',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
};

const innerContainer = {
  background: '#ffffff',
  margin: '8px',
  borderRadius: '25px',
  padding: '48px 32px',
  border: '1px solid rgba(0, 0, 0, 0.10)',
};

const headerSection = {
  textAlign: 'center' as const,
  marginBottom: '32px',
};

const logoContainer = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  marginBottom: '20px',
};

const logoText = {
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: '24px',
  fontWeight: '600',
  color: '#414141',
  margin: '0',
};

const heading = {
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: '#414141',
  margin: '0 0 12px 0',
  fontSize: '32px',
  fontWeight: '600',
  textAlign: 'center' as const,
  letterSpacing: '-0.025em',
};

const subheading = {
  color: '#6b7280',
  fontSize: '16px',
  margin: '0',
  textAlign: 'center' as const,
  lineHeight: '1.5',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const text = {
  color: '#334155',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const strongText = {
  color: '#414141',
};

const detailsSection = {
  backgroundColor: 'rgba(248, 250, 252, 0.6)',
  padding: '20px 24px',
  borderRadius: '12px',
  margin: '24px 0',
  border: '1px solid rgba(0, 0, 0, 0.08)',
};

const detailText = {
  color: '#334155',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
  position: 'relative' as const,
};

const button = {
  position: 'relative' as const,
  display: 'inline-block',
  background: '#8161FF',
  color: 'white',
  padding: '16px 40px',
  textDecoration: 'none',
  borderRadius: '12px',
  fontWeight: '600',
  fontSize: '16px',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  boxShadow: '0 4px 14px 0 rgba(129, 97, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.26)',
  border: 'none',
  cursor: 'pointer',
};

const signatureSection = {
  marginTop: '24px',
};

const signatureText = {
  color: '#334155',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '8px 0 0 0',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const footerSection = {
  textAlign: 'center' as const,
  padding: '24px 0',
  borderTop: '1px solid rgba(0, 0, 0, 0.08)',
  marginTop: '8px',
};

const footerText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  textAlign: 'center' as const,
};

const link = {
  color: '#8161FF',
  textDecoration: 'underline',
  fontWeight: '500',
};

const bottomFooter = {
  textAlign: 'center' as const,
  padding: '24px',
  marginTop: '16px',
};

const bottomFooterText = {
  color: '#6b7280',
  fontSize: '12px',
  margin: '0',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

// Dark Mode Styles
const darkMode = {
  display: 'none',
};

const outerContainerDark = {
  maxWidth: '600px',
  margin: '0 auto',
  background: 'linear-gradient(135deg, rgba(20, 2, 28, 0.6), rgba(15, 1, 20, 0.4))',
  borderRadius: '30px',
  overflow: 'hidden',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
};

const innerContainerDark = {
  background: '#0f0114',
  margin: '8px',
  borderRadius: '25px',
  padding: '48px 32px',
  border: '1px solid rgba(255, 255, 255, 0.10)',
};

const headerSectionDark = {
  textAlign: 'center' as const,
  marginBottom: '32px',
};

const logoTextDark = {
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontSize: '24px',
  fontWeight: '600',
  color: '#ffffff',
  margin: '0',
};

const headingDark = {
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  color: '#ffffff',
  margin: '0 0 12px 0',
  fontSize: '32px',
  fontWeight: '600',
  textAlign: 'center' as const,
  letterSpacing: '-0.025em',
};

const subheadingDark = {
  color: '#94a3b8',
  fontSize: '16px',
  margin: '0',
  textAlign: 'center' as const,
  lineHeight: '1.5',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const textDark = {
  color: '#94a3b8',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '16px 0',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const strongTextDark = {
  color: '#ffffff',
};

const detailsSectionDark = {
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  padding: '20px 24px',
  borderRadius: '12px',
  margin: '24px 0',
  border: '1px solid rgba(255, 255, 255, 0.10)',
};

const detailTextDark = {
  color: '#94a3b8',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const buttonDark = {
  position: 'relative' as const,
  display: 'inline-block',
  background: '#8161FF',
  color: 'white',
  padding: '16px 40px',
  textDecoration: 'none',
  borderRadius: '12px',
  fontWeight: '600',
  fontSize: '16px',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  boxShadow: '0 4px 14px 0 rgba(129, 97, 255, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
  border: 'none',
  cursor: 'pointer',
};

const signatureTextDark = {
  color: '#94a3b8',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '8px 0 0 0',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const footerSectionDark = {
  textAlign: 'center' as const,
  padding: '24px 0',
  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  marginTop: '8px',
};

const footerTextDark = {
  color: '#94a3b8',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  textAlign: 'center' as const,
};

const linkDark = {
  color: '#bcacff',
  textDecoration: 'underline',
  fontWeight: '500',
};

const bottomFooterTextDark = {
  color: '#94a3b8',
  fontSize: '12px',
  margin: '0',
  fontFamily: 'Outfit, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
}; 