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

interface DnsRecord {
  type: "TXT" | "MX" | string;
  name: string;
  value: string;
  isVerified?: boolean;
}

interface DnsSetupInstructionsEmailProps {
  recipientName?: string;
  recipientEmail: string;
  domain: string;
  dnsRecords: DnsRecord[];
  provider?: string;
  senderName?: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "https://inbound.new";

export const DnsSetupInstructionsEmail = ({
  recipientName = 'IT Team',
  recipientEmail,
  domain,
  dnsRecords,
  provider = 'your DNS provider',
  senderName = 'Team Member',
}: DnsSetupInstructionsEmailProps) => (
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
    <Body style={main}>
      <Preview>DNS Setup Instructions for {domain} - inbound</Preview>
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
            Hi {recipientName},
          </Text>
          <Text style={paragraph}>
            {senderName} has requested DNS setup for <strong>{domain}</strong> to enable email services through inbound.
          </Text>
          <Text style={paragraph}>
            Please add the following DNS records to <strong>{provider}</strong>:
          </Text>

          {/* DNS Records Table */}
          <div style={dnsBlock}>
            <Text style={{...paragraph, fontWeight: "600", marginBottom: "12px"}}>
              📋 DNS Records to Add
            </Text>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Type</th>
                  <th style={th}>Name/Host</th>
                  <th style={th}>Value</th>
                </tr>
              </thead>
              <tbody>
                {dnsRecords.map((record, index) => (
                  <tr key={index}>
                    <td style={td}>
                      <span style={recordType}>{record.type}</span>
                    </td>
                    <td style={td}>
                      <code style={recordValue}>{record.name}</code>
                    </td>
                    <td style={td}>
                      <code style={recordValue}>{record.value}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Important Notes */}
          <div style={notesBlock}>
            <Text style={{...paragraph, fontWeight: "600"}}>
              ⚠️ Important Notes:
            </Text>
            <Text style={paragraph}>
              • DNS changes can take up to 48 hours to propagate globally
            </Text>
            <Text style={paragraph}>
              • Some DNS providers may require you to enter the full domain name (e.g., "_amazonses.{domain}" instead of just "_amazonses")
            </Text>
            <Text style={paragraph}>
              • MX records should have a priority value (usually 10)
            </Text>
            <Text style={paragraph}>
              • TXT records should include the quotes if your provider requires them
            </Text>
          </div>

          <Button style={button} href={`https://inbound.new/emails`}>
            View Setup Progress
          </Button>
          
          <Hr style={hr} />
          <Text style={paragraph}>
            Once you've added these DNS records, the verification will happen automatically. You can check the status in the{" "}
            <Link
              style={anchor}
              href="https://inbound.new/emails"
            >
              inbound dashboard
            </Link>.
          </Text>
          <Text style={paragraph}>
            If you need help with DNS setup for {provider}, check out our{" "}
            <Link
              style={anchor}
              href="https://docs.inbound.new/"
            >
              DNS setup guides
            </Link>{" "}
            or reply to this email for assistance.
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

export default DnsSetupInstructionsEmail;

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
  margin: "16px 0",
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

const dnsBlock = {
  background: "#f8fafc",
  border: "1px solid #e6ebf1",
  borderRadius: "8px",
  padding: "16px",
  margin: "16px 0",
};

const notesBlock = {
  background: "#fef3cd",
  border: "1px solid #fbbf24",
  borderRadius: "8px",
  padding: "16px",
  margin: "16px 0",
};

const table = {
  width: "100%",
  borderCollapse: "collapse" as const,
  margin: "16px 0",
};

const th = {
  textAlign: "left" as const,
  fontSize: "12px",
  color: "#8898aa",
  borderBottom: "1px solid #e6ebf1",
  padding: "8px 6px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  fontWeight: "600",
};

const td = {
  fontSize: "14px",
  color: "#525f7f",
  borderBottom: "1px solid #e6ebf1",
  padding: "10px 6px",
  verticalAlign: "top" as const,
};

const recordType = {
  backgroundColor: "#4A0198",
  color: "#fff",
  fontSize: "12px",
  fontWeight: "600",
  padding: "4px 8px",
  borderRadius: "4px",
  textTransform: "uppercase" as const,
};

const recordValue = {
  backgroundColor: "#f1f5f9",
  color: "#334155",
  fontSize: "12px",
  fontFamily: "Monaco, Consolas, 'Courier New', monospace",
  padding: "2px 4px",
  borderRadius: "3px",
  wordBreak: "break-all" as const,
};
