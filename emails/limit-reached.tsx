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

interface LimitReachedEmailProps {
  userFirstname?: string;
  limitType?: "inbound_triggers" | "emails_sent" | "domains";
  currentUsage?: number;
  limit?: number;
  rejectedEmailCount?: number;
  rejectedRecipient?: string;
  domain?: string;
  triggeredAt?: string;
}

export const LimitReachedEmail = ({
  userFirstname = "User",
  limitType = "inbound_triggers",
  currentUsage = 100,
  limit = 100,
  rejectedEmailCount = 1,
  rejectedRecipient,
  domain,
  triggeredAt = new Date().toLocaleDateString(),
}: LimitReachedEmailProps) => {
  const limitName =
    limitType === "inbound_triggers"
      ? "Inbound Email"
      : limitType === "emails_sent"
        ? "Outbound Email"
        : "Domain";

  const limitDescription =
    limitType === "inbound_triggers"
      ? "inbound emails that can be processed"
      : limitType === "emails_sent"
        ? "outbound emails that can be sent"
        : "domains that can be verified";

  return (
    <Html>
      <Head />
      <Preview>
        {limitName} limit reached - upgrade to continue
      </Preview>
      <Tailwind>
        <Body className="bg-white font-sans text-neutral-800" style={{ margin: "32px" }}>
          <Container style={{ maxWidth: "480px", margin: "0", padding: "0 16px" }}>
            <Text className="text-base font-semibold leading-7">
              {limitName} Limit Reached
            </Text>

            <Text className="text-base leading-7">
              Hi {userFirstname}, you've reached your plan's limit for {limitDescription}.
              {rejectedEmailCount === 1
                ? " An incoming email was rejected."
                : ` ${rejectedEmailCount} incoming emails were rejected.`}
            </Text>

            <Text className="m-0 mt-4 text-sm leading-6">
              Current usage: {currentUsage.toLocaleString()} / {limit.toLocaleString()}
            </Text>
            {rejectedRecipient && (
              <Text className="m-0 text-sm leading-6">Rejected email to: {rejectedRecipient}</Text>
            )}
            {domain && <Text className="m-0 text-sm leading-6">Domain: {domain}</Text>}
            <Text className="m-0 text-sm leading-6">Time: {triggeredAt}</Text>

            <Text className="mt-6 text-sm font-semibold leading-6">What you can do:</Text>
            <Text className="m-0 text-sm leading-6">- Upgrade your plan to increase limits</Text>
            <Text className="m-0 text-sm leading-6">- Wait for usage to reset at your billing cycle</Text>
            <Text className="m-0 text-sm leading-6">- Review email routing rules to optimize usage</Text>

            <Text className="my-6">
              <Link href="https://inbound.new/settings" className="text-violet-600 underline">
                Upgrade Your Plan →
              </Link>
            </Text>

            <Text className="text-base leading-7">
              Need help? Check our{" "}
              <Link href="https://inbound.new/docs/pricing" className="text-violet-600 underline">
                pricing guide
              </Link>{" "}
              or contact{" "}
              <Link href="mailto:support@inbound.new" className="text-violet-600 underline">
                support
              </Link>
              .
            </Text>

            <Text className="mt-8 text-sm text-neutral-500">— inbound</Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default LimitReachedEmail;
