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
import { INBOUND_WORDMARK } from './utils';

export const MagicLinkEmail = (
    magicLinkUrl: string
) => (
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
      <Preview>Sign in to inbound</Preview>
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
          <Heading className="mx-0 my-7 p-0 text-2xl font-semibold text-black">Sign in to inbound</Heading>
          <Text className="text-sm leading-6 text-black">Click the button below to sign in to your account.</Text>
          <Section className="my-8">
            <Link
              className="rounded-lg bg-brand px-6 py-3 text-center text-[12px] font-semibold text-white no-underline"
              href={magicLinkUrl}
            >
              Sign in to inbound
            </Link>
          </Section>
          <Text className="text-sm leading-6 text-black">This link will expire in 5 minutes for your security.</Text>
          <Text className="text-sm leading-6 text-black">If you didn't request this, you can safely ignore this email.</Text>
          <Text className="text-sm leading-6 text-black">
            Still integrating? Our{' '}
            <Link className="font-medium text-brand no-underline" href="https://docs.inbound.new">docs</Link>{' '}can help.
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

export default MagicLinkEmail;
