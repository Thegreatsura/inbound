import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Tailwind,
  Text,
} from "@react-email/components";

interface WelcomeSignupEmailProps {
  userFirstname?: string;
}

export const WelcomeSignupEmail = ({
  userFirstname = "there",
}: WelcomeSignupEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to inbound — let's get your first email flowing</Preview>
    <Tailwind>
      <Body className="bg-white font-sans text-neutral-800" style={{ margin: "32px" }}>
        <Container style={{ maxWidth: "480px", margin: "0", padding: "0 16px" }}>
          <Text className="text-base leading-7">
            Hi {userFirstname}, welcome to inbound. You're a few minutes away from parsing and replying to inbound emails with a clean, developer-friendly API.
          </Text>

          <Text className="mt-6 text-sm font-semibold leading-6">Getting started:</Text>
          <Text className="m-0 text-sm leading-6">1. Verify a domain</Text>
          <Text className="m-0 text-sm leading-6">2. Create an inbound address or route</Text>
          <Text className="m-0 text-sm leading-6">3. Send a test email and inspect structured JSON</Text>

          <Text className="my-6">
            <Link href="https://inbound.new/logs" className="text-violet-600 underline">
              Open Dashboard →
            </Link>
          </Text>

          <Text className="text-base leading-7">
            Prefer code? Jump to the{" "}
            <Link href="https://docs.inbound.new" className="text-violet-600 underline">
              docs
            </Link>
            .
          </Text>

          <Text className="mt-8 text-sm text-neutral-500">— inbound</Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default WelcomeSignupEmail;
