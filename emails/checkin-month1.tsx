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
import * as React from "react";
import { INBOUND_WORDMARK } from "./utils";

interface CheckinMonth1EmailProps {
  userFirstname?: string;
  webhooksConfigured?: number;
}

export const CheckinMonth1Email = ({
  userFirstname = "there",
  webhooksConfigured = 0,
}: CheckinMonth1EmailProps) => (
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
    <Preview>One month with inbound — ready to scale?</Preview>
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: { brand: "#7C3AED" },
            fontFamily: {
              outfit: ["Outfit", "Arial", "sans-serif"],
              geist: ["Geist", "Arial", "sans-serif"],
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
            One month in — let's optimize
          </Heading>
          <Text className="text-sm leading-6 text-black">
            Hi {userFirstname}, you've been with inbound for a month. This is a
            great time to add team workflows and improve reliability.
          </Text>

          <Section className="my-6">
            <div className="rounded-lg border border-[#e6ebf1] bg-slate-50 p-4">
              <Text className="text-sm font-semibold leading-6 text-black">
                What teams are doing now
              </Text>
              <Text className="text-sm leading-6 text-black">
                • Add more routes and auto-labels for triage
              </Text>
              <Text className="text-sm leading-6 text-black">
                • Configure webhooks for analytics and storage
              </Text>
              <Text className="text-sm leading-6 text-black">
                • Enable retries and timeouts for resilient pipelines
              </Text>
            </div>
          </Section>

          <Section className="my-6">
            <Img
              src="https://placehold.co/560x220"
              alt="scale features"
              width="560"
              height="220"
            />
          </Section>

          <Section className="my-6">
            <div className="rounded-lg border border-[#e6ebf1] bg-slate-50 p-4 text-center">
              <Text className="m-0 text-base leading-6 text-neutral-700">
                <span className="inline-block whitespace-nowrap">
                  <span className="uppercase tracking-wider text-neutral-500">
                    WEBHOOKS CONFIGURED
                  </span>
                  <span className="ml-2 font-semibold text-neutral-900">
                    {(webhooksConfigured || 0).toLocaleString()}
                  </span>
                </span>
              </Text>
            </div>
          </Section>

          <Section className="my-8">
            <Link
              className="rounded-lg bg-brand px-6 py-3 text-center text-[12px] font-semibold text-white no-underline"
              href="https://inbound.new/logs"
            >
              Review setup
            </Link>
          </Section>

          <Text className="text-sm leading-6 text-black">
            Want a quick review? Reply to this email and we'll help optimize
            your workflows.
          </Text>
          <Text className="text-sm leading-6 text-black">
            — the inbound team
          </Text>

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

export default CheckinMonth1Email;
