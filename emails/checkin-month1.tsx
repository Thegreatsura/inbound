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

interface CheckinMonth1EmailProps {
  userFirstname?: string;
  webhooksConfigured?: number;
}

export const CheckinMonth1Email = ({
  userFirstname = "there",
  webhooksConfigured = 0,
}: CheckinMonth1EmailProps) => (
  <Html>
    <Head />
    <Preview>One month with inbound — ready to scale?</Preview>
    <Tailwind>
      <Body className="bg-white font-sans text-neutral-800" style={{ margin: "32px" }}>
        <Container style={{ maxWidth: "480px", margin: "0", padding: "0 16px" }}>
          <Text className="text-base leading-7">
            Hi {userFirstname}, you've been with inbound for a month now.
          </Text>
          <Text className="text-base leading-7">
            This is a great time to add team workflows and improve reliability:
          </Text>
          <Text className="m-0 text-base leading-7">- Add more routes and auto-labels for triage</Text>
          <Text className="m-0 text-base leading-7">- Configure webhooks for analytics and storage</Text>
          <Text className="m-0 mb-4 text-base leading-7">- Enable retries and timeouts for resilient pipelines</Text>
          <Text className="text-sm text-neutral-600">
            Webhooks configured: {(webhooksConfigured || 0).toLocaleString()}
          </Text>
          <Text className="my-6">
            <Link
              href="https://inbound.new/logs"
              className="text-violet-600 underline"
            >
              Review your setup →
            </Link>
          </Text>
          <Text className="text-base leading-7">
            Want a quick review? Reply to this email and we'll help optimize your workflows.
          </Text>
          <Text className="mt-8 text-sm text-neutral-500">
            — inbound
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default CheckinMonth1Email;
