import {
  Body,
  Container,
  Font,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Heading,
  Tailwind,
  Text,
} from '@react-email/components';
import * as React from 'react';
import { INBOUND_WORDMARK } from './utils';

interface ReputationAlertEmailProps {
  userFirstname?: string;
  alertType?: 'bounce' | 'complaint' | 'delivery_delay';
  severity?: 'warning' | 'critical';
  currentRate?: number;
  threshold?: number;
  configurationSet?: string;
  tenantName?: string;
  triggeredAt?: string;
  recommendations?: string[];
  sendingPaused?: boolean;
}

export const ReputationAlertEmail = ({
  userFirstname = 'User',
  alertType = 'bounce',
  severity = 'warning',
  currentRate = 0.05,
  threshold = 0.05,
  configurationSet = 'tenant-example',
  tenantName = 'Example Tenant',
  triggeredAt = new Date().toLocaleDateString(),
  recommendations = [
    'Review your email list for invalid addresses',
    'Check your email content for spam triggers',
    'Consider implementing double opt-in'
  ],
  sendingPaused = false,
}: ReputationAlertEmailProps) => {
  const alertEmoji = severity === 'critical' ? '🚨' : '⚠️';
  const alertColorClass = severity === 'critical' ? 'text-red-600' : 'text-amber-500';
  const alertTitle = severity === 'critical' ? 'Critical Alert' : 'Warning Alert';
  
  const metricName = alertType === 'bounce' ? 'Bounce Rate' : 
                    alertType === 'complaint' ? 'Complaint Rate' : 'Delivery Delay';
  
  const percentageDisplay = alertType !== 'delivery_delay' 
    ? `${(currentRate * 100).toFixed(2)}%` 
    : `${currentRate.toFixed(0)} emails delayed`;

  return (
    <Html>
      <Head>
        <Font
          fontFamily="Outfit"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4e6yO4a0FQItq6fNIg.woff",
            format: "woff",
          }}
          fontWeight={600}
          fontStyle="normal"
        />
        <Font
          fontFamily="Geist"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/geist/v4/gyBhhwUxId8gMGYQMKR3pzfaWI_RnOMImpnc6VEdtaiL.woff",
            format: "woff",
          }}
          fontWeight={500}
          fontStyle="normal"
        />
      </Head>
      <Preview>{alertEmoji} SES {alertTitle}: {metricName} reached {percentageDisplay}</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: { brand: '#7C3AED' },
              fontFamily: {
                outfit: ['Outfit', 'Arial', 'sans-serif'],
                geist: ['Geist', 'Arial', 'sans-serif'],
              },
            },
          },
        }}
      >
        <Body className="mx-auto my-auto font-geist text-slate-700">
          <Container className="mx-auto my-10 max-w-[600px] rounded border border-solid border-neutral-200 bg-white px-10 py-5">
            <Section className="mt-8">
              <Img src={INBOUND_WORDMARK} height="32" alt="inbound" />
            </Section>
            <Heading className="mx-0 my-7 p-0 text-2xl font-semibold text-black">{alertTitle}</Heading>
            {sendingPaused && (
              <Section className="my-4">
                <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4">
                  <Text className="text-sm font-semibold leading-6 text-red-700">
                    🛑 EMAIL SENDING HAS BEEN PAUSED
                  </Text>
                  <Text className="text-sm leading-6 text-red-600">
                    Due to the critical threshold breach, email sending has been automatically paused for your account to protect your sender reputation. Contact support to discuss resuming service after addressing the issues below.
                  </Text>
                </div>
              </Section>
            )}
            <Text className="text-sm leading-6 text-black">Hi {userFirstname},</Text>
            <Text className="text-sm leading-6 text-black">
              We detected that your <strong>{tenantName}</strong> configuration set exceeded the {metricName.toLowerCase()} threshold and needs attention.
            </Text>
            <Section className="my-6">
              <div className="rounded-lg border border-[#e6ebf1] bg-slate-50 p-4">
                <Text className="text-sm leading-6 text-black"><span className={`font-semibold ${alertColorClass}`}>Current {metricName}:</span> {percentageDisplay}</Text>
                <Text className="text-sm leading-6 text-black"><span className="font-semibold">Threshold:</span> {alertType !== 'delivery_delay' ? `${(threshold * 100).toFixed(2)}%` : `${threshold} emails`}</Text>
                <Text className="text-sm leading-6 text-black"><span className="font-semibold">Configuration Set:</span> {configurationSet}</Text>
                <Text className="text-sm leading-6 text-black"><span className="font-semibold">Triggered:</span> {triggeredAt}</Text>
              </div>
            </Section>
            <Section className="my-6">
              <div className="rounded-lg border border-[#e6ebf1] bg-slate-50 p-4">
                <Text className="text-sm font-semibold leading-6 text-black">💡 Recommended Actions</Text>
              {recommendations.map((rec, index) => (
                  <Text key={index} className="text-sm leading-6 text-black">• {rec}</Text>
              ))}
            </div>
            </Section>
            <Section className="my-8">
              <Link className="rounded-lg bg-brand px-6 py-3 text-center text-[12px] font-semibold text-white no-underline" href="https://inbound.new/dashboard/reputation">
              View Reputation Dashboard
              </Link>
            </Section>
            <Section className="my-6">
              <div className="rounded-lg border border-[#e6ebf1] bg-slate-50 p-4">
                <Text className="text-sm leading-6 text-black">
                {sendingPaused ? (
                    '🛑 Your email sending has been paused. Contact support@inbound.new to discuss resuming service after addressing the issues above.'
                ) : severity === 'critical' ? (
                    '🚨 Critical: Email sending will be automatically paused if rates do not improve. Take immediate action.'
                ) : (
                  '⚠️ Warning: Monitor your reputation closely. Continued high rates may trigger automatic restrictions.'
                )}
              </Text>
            </div>
            </Section>
            <Text className="text-sm leading-6 text-black">
              Need help improving reputation? Read our{' '}
              <Link className="font-medium text-brand no-underline" href="https://inbound.new/docs/reputation">reputation guide</Link>{' '}or contact{' '}
              <Link className="font-medium text-brand no-underline" href="https://inbound.new/support">support</Link>.
            </Text>
            <Text className="text-sm leading-6 text-black">— the inbound team</Text>
            <Section className="mt-8">
              <Text className="text-xs leading-4 text-neutral-500">
              inbound by exon
              <br />
              <br />
              4674 Town Center Parkway, Jacksonville, FL 32246
            </Text>
          </Section>
        </Container>
      </Body>
      </Tailwind>
    </Html>
  );
};

export default ReputationAlertEmail;
