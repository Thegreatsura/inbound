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

interface ReputationAlertEmailProps {
  userFirstname?: string;
  alertType?: "bounce" | "complaint" | "delivery_delay";
  severity?: "warning" | "critical";
  currentRate?: number;
  threshold?: number;
  configurationSet?: string;
  tenantName?: string;
  triggeredAt?: string;
  recommendations?: string[];
  sendingPaused?: boolean;
}

export const ReputationAlertEmail = ({
  userFirstname = "User",
  alertType = "bounce",
  severity = "warning",
  currentRate = 0.05,
  threshold = 0.05,
  configurationSet = "tenant-example",
  tenantName = "Example Tenant",
  triggeredAt = new Date().toLocaleDateString(),
  recommendations = [
    "Review your email list for invalid addresses",
    "Check your email content for spam triggers",
    "Consider implementing double opt-in",
  ],
  sendingPaused = false,
}: ReputationAlertEmailProps) => {
  const alertTitle = severity === "critical" ? "Critical Alert" : "Warning Alert";

  const metricName =
    alertType === "bounce"
      ? "Bounce Rate"
      : alertType === "complaint"
        ? "Complaint Rate"
        : "Delivery Delay";

  const percentageDisplay =
    alertType !== "delivery_delay"
      ? `${(currentRate * 100).toFixed(2)}%`
      : `${currentRate.toFixed(0)} emails delayed`;

  return (
    <Html>
      <Head />
      <Preview>
        {alertTitle}: {metricName} reached {percentageDisplay}
      </Preview>
      <Tailwind>
        <Body className="bg-white font-sans text-neutral-800" style={{ margin: "32px" }}>
          <Container style={{ maxWidth: "480px", margin: "0", padding: "0 16px" }}>
            <Text className="text-base font-semibold leading-7">{alertTitle}</Text>

            {sendingPaused && (
              <Text className="my-4 text-base font-semibold leading-7 text-red-600">
                Email sending has been paused. Contact support to resume service after addressing the issues below.
              </Text>
            )}

            <Text className="text-base leading-7">
              Hi {userFirstname}, your <strong>{tenantName}</strong> configuration set exceeded the{" "}
              {metricName.toLowerCase()} threshold.
            </Text>

            <Text className="m-0 mt-4 text-sm leading-6">
              Current {metricName}: {percentageDisplay}
            </Text>
            <Text className="m-0 text-sm leading-6">
              Threshold: {alertType !== "delivery_delay" ? `${(threshold * 100).toFixed(2)}%` : `${threshold} emails`}
            </Text>
            <Text className="m-0 text-sm leading-6">Configuration Set: {configurationSet}</Text>
            <Text className="m-0 text-sm leading-6">Triggered: {triggeredAt}</Text>

            <Text className="mt-6 text-sm font-semibold leading-6">Recommended actions:</Text>
            {recommendations.map((rec, index) => (
              <Text key={index} className="m-0 text-sm leading-6">
                - {rec}
              </Text>
            ))}

            <Text className="my-6">
              <Link href="https://inbound.new/dashboard/reputation" className="text-violet-600 underline">
                View Reputation Dashboard →
              </Link>
            </Text>

            <Text className="text-sm leading-6 text-neutral-600">
              {sendingPaused
                ? "Your email sending has been paused. Contact support@inbound.new to discuss resuming service."
                : severity === "critical"
                  ? "Critical: Email sending will be paused if rates do not improve. Take immediate action."
                  : "Warning: Monitor your reputation closely. Continued high rates may trigger restrictions."}
            </Text>

            <Text className="text-base leading-7">
              Need help? Read our{" "}
              <Link href="https://inbound.new/docs/reputation" className="text-violet-600 underline">
                reputation guide
              </Link>{" "}
              or contact{" "}
              <Link href="https://inbound.new/support" className="text-violet-600 underline">
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

export default ReputationAlertEmail;
