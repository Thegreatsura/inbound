import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

interface ReputationAlertEmailProps {
  userFirstname?: string;
  alertType?: 'bounce' | 'complaint' | 'delivery_delay';
  severity?: 'warning' | 'critical';
  currentRate?: number;
  threshold?: number;
  configurationSet?: string;
  tenantName?: string;
  triggeredAt?: string;
  recommendations?: string[];
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "https://inbound.new";

export const ReputationAlertEmail = ({
  userFirstname = 'User',
  alertType = 'bounce',
  severity = 'warning',
  currentRate = 0.05,
  threshold = 0.05,
  configurationSet = 'tenant-example',
  tenantName = 'Example Tenant',
  triggeredAt = new Date().toLocaleDateString(),
  recommendations = [
    'Review your email list for invalid addresses',
    'Check your email content for spam triggers',
    'Consider implementing double opt-in'
  ],
}: ReputationAlertEmailProps) => {
  const alertEmoji = severity === 'critical' ? '🚨' : '⚠️';
  const alertColor = severity === 'critical' ? '#dc2626' : '#f59e0b';
  const alertTitle = severity === 'critical' ? 'Critical Alert' : 'Warning Alert';
  
  const metricName = alertType === 'bounce' ? 'Bounce Rate' : 
                    alertType === 'complaint' ? 'Complaint Rate' : 'Delivery Delay';
  
  const percentageDisplay = alertType !== 'delivery_delay' 
    ? `${(currentRate * 100).toFixed(2)}%` 
    : `${currentRate.toFixed(0)} emails delayed`;

  return (
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
      <Preview>{alertEmoji} SES {alertTitle}: {metricName} reached {percentageDisplay} - inbound</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={box}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Img
                src={`${baseUrl}/images/icon-light.png`}
                width="40"
                height="40"
                alt="inbound"
                style={{ borderRadius: "12px" }}
              />
              <p style={{ fontSize: "24px", fontFamily: "Outfit, Arial, sans-serif", fontWeight: "600", margin: 0 }}>inbound</p>
            </div>
            <Hr style={hr} />
            <Text style={paragraph}>
              Hi {userFirstname},
            </Text>
            <Text style={paragraph}>
              We detected that your <strong>{tenantName}</strong> configuration set has exceeded the {metricName.toLowerCase()} threshold and needs immediate attention.
            </Text>
            <div style={alertBlock}>
              <Text style={paragraph}>
                <strong style={{color: alertColor}}>Current {metricName}:</strong> {percentageDisplay}<br />
                <strong>Threshold:</strong> {alertType !== 'delivery_delay' ? `${(threshold * 100).toFixed(2)}%` : `${threshold} emails`}<br />
                <strong>Configuration Set:</strong> {configurationSet}<br />
                <strong>Triggered:</strong> {triggeredAt}
              </Text>
              <Hr style={hr} />
              <Text style={{...paragraph, fontWeight: "600"}}>
                💡 Recommended Actions:
              </Text>
              {recommendations.map((rec, index) => (
                <Text key={index} style={paragraph}>
                  • {rec}
                </Text>
              ))}
            </div>
            <Button style={button} href="https://inbound.new/dashboard/reputation">
              View Reputation Dashboard
            </Button>
            <div style={warningBlock}>
              <Text style={paragraph}>
                {severity === 'critical' ? (
                  '🚨 Critical Alert: Email sending may be automatically paused if rates don\'t improve. Take immediate action.'
                ) : (
                  '⚠️ Warning: Monitor your reputation closely. Continued high rates may trigger automatic restrictions.'
                )}
              </Text>
            </div>
            <Hr style={hr} />
            <Text style={paragraph}>
              Reply to this email if you need help improving your email reputation. Check out our{" "}
              <Link
                style={anchor}
                href="https://inbound.new/docs/reputation"
              >
                reputation guide
              </Link>{" "}
              or contact{" "}
              <Link
                style={anchor}
                href="https://inbound.new/support"
              >
                support
              </Link>.
            </Text>
            <Text style={paragraph}>— the inbound team</Text>
            <Hr style={hr} />
            <Text style={footer}>
              inbound by exon
              <br />
              <br />
              4674 Town Center Parkway, Jacksonville, FL 32246
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

export default ReputationAlertEmail;

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    'Geist, -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
    letterSpacing: "-0.04em",
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};

const box = {
  padding: "0 48px",
};

const hr = {
  borderColor: "#e6ebf1",
  margin: "20px 0",
};

const paragraph = {
  color: "#525f7f",
  fontSize: "16px",
  lineHeight: "24px",
  textAlign: "left" as const,
};

const anchor = {
  color: "#556cd6",
};

const button = {
  backgroundColor: "#4A0198",
  borderRadius: "5px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "10px",
  margin: "20px 0",
};

const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
};

const alertBlock = {
  background: "#f8fafc",
  border: "1px solid #e6ebf1",
  padding: "16px",
  margin: "2px 0",
};

const warningBlock = {
  background: "#fef3cd",
  border: "1px solid #fbbf24",
  padding: "2px 12px",
  margin: "2px 0",
};
