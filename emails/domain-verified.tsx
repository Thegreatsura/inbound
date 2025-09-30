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

interface DomainVerifiedEmailProps {
  userFirstname?: string;
  domain?: string;
  verifiedAt?: string;
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "https://inbound.new";

export const DomainVerifiedEmail = ({
  userFirstname = 'User',
  domain = 'example.com',
  verifiedAt = new Date().toLocaleDateString(),
}: DomainVerifiedEmailProps) => (
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
      <Preview>🎉 {domain} is verified and ready - inbound</Preview>
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
            🎉 Congratulations, {userFirstname}!
          </Text>
          <Text style={paragraph}>
            Your domain <strong>{domain}</strong> is now verified and ready to receive emails through inbound.
          </Text>
          <div style={detailsBlock}>
            <Text style={paragraph}>
              ✅ Verified on {verifiedAt}<br />
              ✅ Email receiving active<br />
              ✅ Email sending active
            </Text>
          </div>
          <Button style={button} href="https://inbound.new/dashboard">
            Open Dashboard
          </Button>
          <Hr style={hr} />
          <Text style={paragraph}>
            Your domain is now ready to start receiving emails. Check out your{" "}
            <Link
              style={anchor}
              href="https://inbound.new/dashboard"
            >
              dashboard
            </Link>{" "}
            or view our{" "}
            <Link
              style={anchor}
              href="https://docs.inbound.new"
            >
              docs
            </Link>{" "}
            to get started.
          </Text>
          <Text style={paragraph}>
            Reply to this email if you have any questions, we read every email.
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

export default DomainVerifiedEmail;

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

const detailsBlock = {
  background: "#f8fafc",
  border: "1px solid #e6ebf1",
  borderRadius: "8px",
  padding: "16px",
  margin: "16px 0",
}; 