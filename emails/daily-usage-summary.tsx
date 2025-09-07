import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
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

export const DailyUsageSummaryEmail = ({ dateLabel, totals, topUsers, insights = [] }: DailyUsageEmailProps) => (
  <Html>
    <Head />
    <Preview>Daily usage summary • {dateLabel}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={heading}>📊 Daily Usage Summary</Heading>
        <Text style={subtle}>Report date: {dateLabel}</Text>

        <Section style={statsGrid}>
          <div style={statBox}>
            <Text style={statLabel}>Total Sent</Text>
            <Text style={statValue}>{totals.sent.toLocaleString()}</Text>
          </div>
          <div style={statBox}>
            <Text style={statLabel}>Total Received</Text>
            <Text style={statValue}>{totals.received.toLocaleString()}</Text>
          </div>
          <div style={statBox}>
            <Text style={statLabel}>Unique Senders</Text>
            <Text style={statValue}>{totals.uniqueSenders.toLocaleString()}</Text>
          </div>
          <div style={statBox}>
            <Text style={statLabel}>Unique Recipients</Text>
            <Text style={statValue}>{totals.uniqueRecipients.toLocaleString()}</Text>
          </div>
        </Section>

        {insights.length > 0 && (
          <Section style={insightsBox}>
            <Heading as="h2" style={subheading}>AI Insights</Heading>
            {insights.map((i, idx) => (
              <Text key={idx} style={insightItem}>• {i}</Text>
            ))}
          </Section>
        )}

        <Section>
          <Heading as="h2" style={subheading}>Top Users</Heading>
          {topUsers.length === 0 ? (
            <Text>No user activity recorded for this period.</Text>
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
                      <div style={{ color: '#64748b' }}>{u.userEmail}</div>
                    </td>
                    <td style={td}>{u.sent.toLocaleString()}</td>
                    <td style={td}>{u.received.toLocaleString()}</td>
                    <td style={td}>{u.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section style={{ textAlign: 'center', marginTop: 24 }}>
          <Button style={button} href="https://inbound.new/admin/user-information">Open Dashboard</Button>
        </Section>

        <Section style={{ textAlign: 'center', marginTop: 16 }}>
          <Text style={{ color: '#94a3b8', fontSize: 12 }}>
            © {new Date().getFullYear()} inbound • Daily usage email
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
);

export default DailyUsageSummaryEmail;

const main = { backgroundColor: '#0b0b12', color: '#e5e7eb', padding: '20px' };
const container = { backgroundColor: '#11121a', borderRadius: 16, padding: 24 } as const;
const heading = { margin: 0, fontSize: 24, fontWeight: 700 };
const subheading = { margin: '8px 0 12px 0', fontSize: 18, fontWeight: 600 };
const subtle = { color: '#94a3b8', fontSize: 12 };
const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 12 } as const;
const statBox = { background: '#161825', border: '1px solid #1f2337', borderRadius: 12, padding: 12 } as const;
const statLabel = { color: '#a1a1aa', fontSize: 12 };
const statValue = { fontSize: 20, fontWeight: 700 };
const insightsBox = { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: 16 } as const;
const insightItem = { color: '#e5e7eb', fontSize: 14 };
const table = { width: '100%', borderCollapse: 'collapse' } as const;
const th = { textAlign: 'left' as const, fontSize: 12, color: '#94a3b8', borderBottom: '1px solid #1f2337', padding: '8px 6px' };
const td = { fontSize: 14, borderBottom: '1px solid #1f2337', padding: '10px 6px' };
const button = { background: '#8161FF', color: '#fff', padding: '12px 18px', borderRadius: 10, textDecoration: 'none' } as const;


