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

interface DnsRecord {
  type: 'TXT' | 'MX' | string;
  name: string;
  value: string;
  isVerified?: boolean;
}

interface DnsSetupInstructionsEmailProps {
  recipientName?: string;
  recipientEmail: string;
  domain: string;
  dnsRecords: DnsRecord[];
  provider?: string;
  senderName?: string;
}

export const DnsSetupInstructionsEmail = ({
  recipientName = 'IT Team',
  recipientEmail,
  domain = 'your-domain.com',
  dnsRecords = [],
  provider = 'your DNS provider',
  senderName = 'Team Member',
}: DnsSetupInstructionsEmailProps) => (
  <Html>
    <Head>
      <Font
        fontFamily="Outfit"
        fallbackFontFamily="Arial"
        webFont={{
          url: 'https://fonts.gstatic.com/s/outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4e6yO4a0FQItq6fNIg.woff',
          format: 'woff',
        }}
        fontWeight={600}
        fontStyle="normal"
      />
      <Font
        fontFamily="Geist"
        fallbackFontFamily="Arial"
        webFont={{
          url: 'https://fonts.gstatic.com/s/geist/v4/gyBhhwUxId8gMGYQMKR3pzfaWI_RnOMImpnc6VEdtaiL.woff',
          format: 'woff',
        }}
        fontWeight={500}
        fontStyle="normal"
      />
    </Head>
    <Preview>DNS setup instructions • {domain}</Preview>
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              brand: '#7C3AED',
            },
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

          <Heading className="mx-0 my-7 p-0 text-2xl font-semibold text-black">
            DNS Setup Instructions
          </Heading>

          <Text className="text-sm leading-6 text-black">Hi {recipientName},</Text>
          <Text className="text-sm leading-6 text-black">
            {senderName} has requested DNS setup for <strong>{domain}</strong> to enable email services through inbound.
          </Text>
          <Text className="text-sm leading-6 text-black">
            Please add the following DNS records to <strong>{provider}</strong>:
          </Text>

          <Section className="my-6">
            <div className="rounded-lg border border-[#e6ebf1] bg-slate-50 p-4">
              <Text className="text-sm font-semibold leading-6 text-black">📋 DNS Records to Add</Text>
              {dnsRecords.length === 0 ? (
                <Text className="text-sm leading-6 text-black">No DNS records were provided. Please check the dashboard for your domain’s current records.</Text>
              ) : (
                <table className="my-4 w-full border-collapse">
              <thead>
                <tr>
                      <th className="border-b border-[#e6ebf1] px-[6px] py-2 text-left text-[12px] uppercase tracking-wider text-neutral-500">Type</th>
                      <th className="border-b border-[#e6ebf1] px-[6px] py-2 text-left text-[12px] uppercase tracking-wider text-neutral-500">Name/Host</th>
                      <th className="border-b border-[#e6ebf1] px-[6px] py-2 text-left text-[12px] uppercase tracking-wider text-neutral-500">Value</th>
                </tr>
              </thead>
              <tbody>
                {dnsRecords.map((record, index) => (
                  <tr key={index}>
                        <td className="border-b border-[#e6ebf1] px-[6px] py-[10px] text-[14px] text-black">
                          <span className="rounded bg-brand px-2 py-1 text-[12px] font-semibold uppercase text-white">{record.type}</span>
                    </td>
                        <td className="border-b border-[#e6ebf1] px-[6px] py-[10px] text-[14px] text-black">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-700">{record.name}</code>
                    </td>
                        <td className="border-b border-[#e6ebf1] px-[6px] py-[10px] text-[14px] text-black">
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-700 break-all">{record.value}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              )}
          </div>
          </Section>

          <Section className="my-6">
            <div className="rounded-lg border border-[#e6ebf1] bg-slate-50 p-4">
              <Text className="text-sm font-semibold leading-6 text-black">⚠️ Important Notes</Text>
              <Text className="text-sm leading-6 text-black">• DNS changes can take up to 48 hours to propagate globally</Text>
              <Text className="text-sm leading-6 text-black">• Some DNS providers may require the full domain (e.g., "_amazonses.{domain}")</Text>
              <Text className="text-sm leading-6 text-black">• MX records should include a priority value (usually 10)</Text>
              <Text className="text-sm leading-6 text-black">• TXT records may require quotes, depending on your provider</Text>
          </div>
          </Section>
          
          <Section className="my-8">
            <Link
              className="rounded-lg bg-brand px-6 py-3 text-center text-[12px] font-semibold text-white no-underline"
              href={`https://inbound.new/emails`}
            >
              View Setup Progress
            </Link>
          </Section>

          <Text className="text-sm leading-6 text-black">
            Once you've added these DNS records, verification will happen automatically. You can check status in the{' '}
            <Link className="font-medium text-brand no-underline" href="https://inbound.new/emails">inbound dashboard</Link>.
          </Text>
          <Text className="text-sm leading-6 text-black">
            Need help with {provider}? See our{' '}
            <Link className="font-medium text-brand no-underline" href="https://docs.inbound.new/">DNS setup guides</Link>{' '}or reply to this email for assistance.
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

export default DnsSetupInstructionsEmail;
