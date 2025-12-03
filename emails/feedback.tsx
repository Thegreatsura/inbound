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

interface FeedbackEmailProps {
  userFirstname?: string;
  userEmail: string;
  feedback: string;
  submittedAt?: string;
}

export const FeedbackEmail = ({
  userFirstname = "User",
  userEmail = "user@example.com",
  feedback = "This is some example feedback from a user.",
  submittedAt = new Date().toLocaleDateString(),
}: FeedbackEmailProps) => (
  <Html>
    <Head />
    <Preview>New feedback from {userFirstname}</Preview>
    <Tailwind>
      <Body className="bg-white font-sans text-neutral-800" style={{ margin: "32px" }}>
        <Container style={{ maxWidth: "480px", margin: "0", padding: "0 16px" }}>
          <Text className="text-base font-semibold leading-7">
            New feedback
          </Text>
          <Text className="text-sm text-neutral-600">
            From {userFirstname} ({userEmail}) · {submittedAt}
          </Text>

          <Text className="my-4 whitespace-pre-wrap text-base leading-7" style={{ fontStyle: "italic" }}>
            "{feedback}"
          </Text>

          <Text className="text-base leading-7">
            Reply directly to this email to respond to {userFirstname}.
          </Text>

          <Text className="my-6">
            <Link
              href="https://inbound.new/logs"
              className="text-violet-600 underline"
            >
              View Dashboard →
            </Link>
          </Text>

          <Text className="mt-8 text-sm text-neutral-500">
            — inbound
          </Text>
        </Container>
      </Body>
    </Tailwind>
  </Html>
);

export default FeedbackEmail;
