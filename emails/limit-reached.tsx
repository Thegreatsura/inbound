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

interface LimitReachedEmailProps {
  userFirstname?: string;
  limitType?: 'inbound_triggers' | 'emails_sent' | 'domains';
  currentUsage?: number;
  limit?: number;
  rejectedEmailCount?: number;
  rejectedRecipient?: string;
  domain?: string;
  triggeredAt?: string;
}

export const LimitReachedEmail = ({
  userFirstname = 'User',
  limitType = 'inbound_triggers',
  currentUsage = 100,
  limit = 100,
  rejectedEmailCount = 1,
  rejectedRecipient,
  domain,
  triggeredAt = new Date().toLocaleDateString(),
}: LimitReachedEmailProps) => {
  const limitName = limitType === 'inbound_triggers' ? 'Inbound Email' : 
                   limitType === 'emails_sent' ? 'Outbound Email' : 'Domain';
  
  const limitDescription = limitType === 'inbound_triggers' 
    ? 'inbound emails that can be processed and delivered to your endpoints' 
    : limitType === 'emails_sent' 
    ? 'outbound emails that can be sent through our API'
    : 'domains that can be verified';

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
          fontFamily="Inter"
          fallbackFontFamily="Arial"
          webFont={{
            url: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>⚠️ {limitName} limit reached - upgrade to continue processing emails</Preview>
      <Tailwind
        config={{
          theme: {
            extend: {
              colors: { brand: '#7C3AED' },
              fontFamily: {
                outfit: ['Outfit', 'Arial', 'sans-serif'],
                inter: ['Inter', 'Arial', 'sans-serif'],
              },
            },
          },
        }}
      >
        <Body className="mx-auto my-auto font-inter text-slate-700">
          <Container className="mx-auto my-8 max-w-[600px] rounded border border-solid border-neutral-200 bg-white px-10 py-4">
            <Section className="mt-4">
              <Img src={INBOUND_WORDMARK} height="32" alt="inbound" />
            </Section>
            <Heading className="mx-0 my-4 p-0 text-2xl font-semibold text-black">{limitName} Limit Reached</Heading>
            
            <Section className="my-3">
              <div className="rounded-lg border-2 border-amber-500 bg-amber-50 p-3">
                <Text className="m-0 text-sm font-semibold leading-5 text-amber-700">
                  ⚠️ YOUR PLAN LIMIT HAS BEEN REACHED
                </Text>
                <Text className="mb-0 mt-1 text-sm leading-5 text-amber-600">
                  {rejectedEmailCount === 1 
                    ? 'An incoming email was rejected because your plan limit has been reached.'
                    : `${rejectedEmailCount} incoming emails were rejected because your plan limit has been reached.`
                  }
                </Text>
              </div>
            </Section>

            <Text className="my-2 text-sm leading-5 text-black">Hi {userFirstname},</Text>
            <Text className="my-2 text-sm leading-5 text-black">
              You've reached your plan's limit for {limitDescription}. New incoming emails will not be processed until you upgrade your plan or your usage resets.
            </Text>

            <Section className="my-3">
              <div className="rounded-lg border border-[#e6ebf1] bg-slate-50 p-3">
                <Text className="m-0 text-sm leading-5 text-black">
                  <span className="font-semibold text-amber-600">Current Usage:</span> {currentUsage.toLocaleString()} / {limit.toLocaleString()}
                </Text>
                {rejectedRecipient && (
                  <Text className="mb-0 mt-1 text-sm leading-5 text-black">
                    <span className="font-semibold">Rejected Email To:</span> {rejectedRecipient}
                  </Text>
                )}
                {domain && (
                  <Text className="mb-0 mt-1 text-sm leading-5 text-black">
                    <span className="font-semibold">Domain:</span> {domain}
                  </Text>
                )}
                <Text className="mb-0 mt-1 text-sm leading-5 text-black">
                  <span className="font-semibold">Time:</span> {triggeredAt}
                </Text>
              </div>
            </Section>

            <Section className="my-3">
              <div className="rounded-lg border border-[#e6ebf1] bg-slate-50 p-3">
                <Text className="m-0 text-sm font-semibold leading-5 text-black">💡 What You Can Do</Text>
                <Text className="mb-0 mt-1 text-sm leading-5 text-black">• Upgrade your plan to increase your limits</Text>
                <Text className="mb-0 mt-1 text-sm leading-5 text-black">• Wait for your usage to reset at the start of your billing cycle</Text>
                <Text className="mb-0 mt-1 text-sm leading-5 text-black">• Review your email routing rules to optimize usage</Text>
              </div>
            </Section>

            <Section className="my-4">
              <Link className="rounded-lg bg-brand px-6 py-3 text-center text-[12px] font-semibold text-white no-underline" href="https://inbound.new/settings">
                Upgrade Your Plan
              </Link>
            </Section>

            <Text className="my-2 text-sm leading-5 text-black">
              Need help? Check out our{' '}
              <Link className="font-medium text-brand no-underline" href="https://inbound.new/docs/pricing">pricing guide</Link>{' '}
              or contact{' '}
              <Link className="font-medium text-brand no-underline" href="mailto:support@inbound.new">support</Link>.
            </Text>
            <Text className="my-2 text-sm leading-5 text-black">— the inbound team</Text>

            <Section className="mt-4">
              <Text className="text-xs leading-4 text-neutral-500">
                inbound by exon
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

export default LimitReachedEmail;

