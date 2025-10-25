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
} from "@react-email/components";
import * as React from 'react'
import { INBOUND_WORDMARK } from './utils'

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
    <Preview>New feedback from {userFirstname}</Preview>
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
          <Heading className="mx-0 my-7 p-0 text-2xl font-semibold text-black">New feedback</Heading>
          <Text className="text-sm leading-6 text-black">From <strong>{userFirstname}</strong> ({userEmail})</Text>
          <Text className="text-sm leading-6 text-black">Submitted on {submittedAt}</Text>

          <Section className="my-6">
            <div className="rounded-lg border border-[#e6ebf1] bg-slate-50 p-4">
              <Text className="whitespace-pre-wrap text-sm leading-6 text-black">{feedback}</Text>
          </div>
          </Section>

          <Text className="text-sm leading-6 text-black">
            You can reply directly to this email to respond to {userFirstname}. Check your{' '}
            <Link className="font-medium text-brand no-underline" href="https://inbound.new/logs">dashboard</Link>{' '}or see the{' '}
            <Link className="font-medium text-brand no-underline" href="https://docs.inbound.new">docs</Link>.
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
)

export default FeedbackEmail