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

interface TopUserRow {
  userEmail: string;
  userName: string | null;
  sent: number;
  received: number;
  total: number;
}

export interface DailyUsageEmailProps {
  dateLabel: string;
  totals: {
    sent: number;
    received: number;
    uniqueSenders: number;
    uniqueRecipients: number;
  };
  topUsers: TopUserRow[];
  insights?: string[];
}

const baseUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "https://inbound.new";

export const DailyUsageSummaryEmail = ({ 
  dateLabel = 'Today', 
  totals = { sent: 0, received: 0, uniqueSenders: 0, uniqueRecipients: 0 }, 
  topUsers = [], 
  insights = [] 
}: DailyUsageEmailProps) => (
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
      <Preview>Daily usage summary • {dateLabel}</Preview>
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
          <Text style={{...paragraph, fontSize: "20px", fontWeight: "600"}}>
            📊 Daily Usage Summary
          </Text>
          <Text style={paragraph}>
            Report date: {dateLabel}
          </Text>
          
          <div style={statsGrid}>
            <div style={statBox}>
              <Text style={statLabel}>Total Sent</Text>
              <Text style={statValue}>{(totals?.sent || 0).toLocaleString()}</Text>
            </div>
            <div style={statBox}>
              <Text style={statLabel}>Total Received</Text>
              <Text style={statValue}>{(totals?.received || 0).toLocaleString()}</Text>
            </div>
            <div style={statBox}>
              <Text style={statLabel}>Unique Senders</Text>
              <Text style={statValue}>{(totals?.uniqueSenders || 0).toLocaleString()}</Text>
            </div>
            <div style={statBox}>
              <Text style={statLabel}>Unique Recipients</Text>
              <Text style={statValue}>{(totals?.uniqueRecipients || 0).toLocaleString()}</Text>
            </div>
          </div>

          {insights.length > 0 && (
            <div style={insightsBlock}>
              <Text style={{...paragraph, fontWeight: "600"}}>🤖 AI Insights</Text>
              {insights.map((insight, idx) => (
                <Text key={idx} style={paragraph}>• {insight}</Text>
              ))}
            </div>
          )}

          <Hr style={hr} />
          <Text style={{...paragraph, fontWeight: "600"}}>Top Users</Text>
          {topUsers.length === 0 ? (
            <Text style={paragraph}>No user activity recorded for this period.</Text>
          ) : (
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>User</th>
                  <th style={th}>Sent</th>
                  <th style={th}>Received</th>
                  <th style={th}>Total</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u, i) => (
                  <tr key={`${u.userEmail}-${i}`}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{u.userName || 'No name'}</div>
                      <div style={{ color: '#64748b', fontSize: '14px' }}>{u.userEmail}</div>
                    </td>
                    <td style={td}>{u.sent.toLocaleString()}</td>
                    <td style={td}>{u.received.toLocaleString()}</td>
                    <td style={td}>{u.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Button style={button} href="https://inbound.new/admin/user-information">
            Open Dashboard
          </Button>
          
          <Hr style={hr} />
          <Text style={paragraph}>
            Check out your{" "}
            <Link
              style={anchor}
              href="https://inbound.new/admin/user-information"
            >
              admin dashboard
            </Link>{" "}
            for more detailed analytics.
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

export default DailyUsageSummaryEmail;

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

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0,1fr))",
  gap: "12px",
  margin: "16px 0",
} as const;

const statBox = {
  background: "#f8fafc",
  border: "1px solid #e6ebf1",
  borderRadius: "8px",
  padding: "16px",
  textAlign: "center" as const,
};

const statLabel = {
  color: "#8898aa",
  fontSize: "12px",
  margin: "0 0 8px 0",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
};

const statValue = {
  color: "#525f7f",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "0",
};

const insightsBlock = {
  background: "#f8fafc",
  border: "1px solid #e6ebf1",
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
};

const td = {
  fontSize: "14px",
  color: "#525f7f",
  borderBottom: "1px solid #e6ebf1",
  padding: "10px 6px",
};


