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

export const MagicLinkEmail = (magicLinkUrl: string) => (
  <Html>
    <Head />
    <Preview>Sign in to inbound</Preview>
    <Tailwind>
      <Body className="bg-white font-sans text-neutral-800" style={{ margin: "32px" }}>
        <Container style={{ maxWidth: "480px", margin: "0", padding: "0 16px" }}>
          <Text className="text-base leading-7">
            Click the link below to sign in to your inbound account:
          </Text>
          <Text className="my-6">
            <Link
              href={magicLinkUrl}
              className="text-violet-600 underline"
            >
              Sign in to inbound →
            </Link>
          </Text>
          <Text className="text-sm leading-6 text-neutral-600">
            This link expires in 5 minutes. If you didn't request this, ignore this email.
          </Text>
          <Text className="mt-8 text-sm text-neutral-500">
            — inbound
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default MagicLinkEmail;
