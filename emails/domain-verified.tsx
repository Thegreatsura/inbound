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
    <Preview>🎉 {domain} verified and ready</Preview>
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
          <Heading className="mx-0 my-7 p-0 text-2xl font-semibold text-black">Domain verified</Heading>
          <Text className="text-sm leading-6 text-black">🎉 Congratulations, {userFirstname}!</Text>
          <Text className="text-sm leading-6 text-black">Your domain <strong>{domain}</strong> is now verified and ready to receive emails through inbound.</Text>

          <Section className="my-6">
            <div className="rounded-lg border border-[#e6ebf1] bg-slate-50 p-4">
              <Text className="text-sm leading-6 text-black">✅ Verified on {verifiedAt}</Text>
              <Text className="text-sm leading-6 text-black">✅ Email receiving active</Text>
              <Text className="text-sm leading-6 text-black">✅ Email sending active</Text>
          </div>
          </Section>

          <Section className="my-8">
            <Link
              className="rounded-lg bg-brand px-6 py-3 text-center text-[12px] font-semibold text-white no-underline"
              href="https://inbound.new/dashboard"
            >
              Open Dashboard
            </Link>
          </Section>

          <Text className="text-sm leading-6 text-black">
            Your domain is ready. Visit your{' '}
            <Link className="font-medium text-brand no-underline" href="https://inbound.new/dashboard">dashboard</Link>{' '}
            or read the{' '}
            <Link className="font-medium text-brand no-underline" href="https://docs.inbound.new">docs</Link> to get started.
          </Text>
          <Text className="text-sm leading-6 text-black">Reply to this email if you have any questions—we read every email.</Text>
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

export default DomainVerifiedEmail;