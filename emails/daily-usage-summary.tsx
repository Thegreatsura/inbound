import {
  Body,
  Container,
  Font,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Tailwind,
  Heading,
  Section,
  Text,
} from '@react-email/components';
import { INBOUND_WORDMARK } from './utils';
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
      <Preview>Daily usage summary • {dateLabel}</Preview>
    <Tailwind
      config={{
        theme: {
          extend: {
            colors: {
              brand: '#7C3AED',
            },
            fontFamily: {
              outfit: ['Outfit', 'Arial', 'sans-serif'],
              geist: ['Geist', 'Arial', 'sans-serif'],
            },
          },
        },
      }}
    >
      <Body className="mx-auto my-auto font-geist text-slate-700">
        <Container className="mx-auto my-10 max-w-[600px] rounded border border-solid border-neutral-200 bg-white px-10 py-5">
          <Section className="mt-8">
            <Img src={INBOUND_WORDMARK} height="32" alt="inbound" className="rounded-[12px]" />
          </Section>
          <Heading className="mx-0 my-7 p-0 text-2xl font-semibold text-black">
            Daily Usage Summary
          </Heading>
          <Text className="text-sm leading-6 text-black">
            Report date: {dateLabel}
          </Text>
          
          <Section className="my-6">
            <div className="rounded-lg border border-[#e6ebf1] bg-slate-50 px-4 py-3 text-center">
              <Text className="m-0 text-base leading-6 text-neutral-700">
                <span className="inline-block whitespace-nowrap">
                  <span className="uppercase tracking-wider text-neutral-500">{'TOTAL\u00A0SENT'}</span>
                  <span className="ml-2 font-semibold text-neutral-900">{(totals?.sent || 0).toLocaleString()}</span>
                </span>
                <span className="mx-3 text-neutral-300">•</span>
                <span className="inline-block whitespace-nowrap">
                  <span className="uppercase tracking-wider text-neutral-500">{'TOTAL\u00A0RECEIVED'}</span>
                  <span className="ml-2 font-semibold text-neutral-900">{(totals?.received || 0).toLocaleString()}</span>
                </span>
                <span className="mx-3 text-neutral-300">•</span>
                <span className="inline-block whitespace-nowrap">
                  <span className="uppercase tracking-wider text-neutral-500">{'UNIQUE\u00A0SENDERS'}</span>
                  <span className="ml-2 font-semibold text-neutral-900">{(totals?.uniqueSenders || 0).toLocaleString()}</span>
                </span>
                <span className="mx-3 text-neutral-300">•</span>
                <span className="inline-block whitespace-nowrap">
                  <span className="uppercase tracking-wider text-neutral-500">{'UNIQUE\u00A0RECIPIENTS'}</span>
                  <span className="ml-2 font-semibold text-neutral-900">{(totals?.uniqueRecipients || 0).toLocaleString()}</span>
                </span>
              </Text>
            </div>
          </Section>

          {insights.length > 0 && (
            <Section className="my-8">
              <div className="rounded-lg border border-[#e6ebf1] bg-slate-50 p-4">
                <Text className="text-sm font-semibold leading-6 text-black">🤖 AI Insights</Text>
              {insights.map((insight, idx) => (
                  <Text key={idx} className="text-sm leading-6 text-black">• {insight}</Text>
              ))}
            </div>
            </Section>
          )}

          <Heading className="mx-0 my-6 p-0 text-base font-semibold text-black">
            Top Users
          </Heading>
          {topUsers.length === 0 ? (
            <Text className="text-sm leading-6 text-black">No user activity recorded for this period.</Text>
          ) : (
            <table className="my-4 w-full border-collapse">
              <thead>
                <tr>
                  <th className="border-b border-[#e6ebf1] px-[6px] py-2 text-left text-[12px] uppercase tracking-wider text-neutral-500">User</th>
                  <th className="border-b border-[#e6ebf1] px-[6px] py-2 text-left text-[12px] uppercase tracking-wider text-neutral-500">Sent</th>
                  <th className="border-b border-[#e6ebf1] px-[6px] py-2 text-left text-[12px] uppercase tracking-wider text-neutral-500">Received</th>
                  <th className="border-b border-[#e6ebf1] px-[6px] py-2 text-left text-[12px] uppercase tracking-wider text-neutral-500">Total</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u, i) => (
                  <tr key={`${u.userEmail}-${i}`}>
                    <td className="border-b border-[#e6ebf1] px-[6px] py-[10px] text-[14px] text-black">
                      <div className="font-semibold">{u.userName || 'No name'}</div>
                      <div className="text-[14px] text-neutral-600">{u.userEmail}</div>
                    </td>
                    <td className="border-b border-[#e6ebf1] px-[6px] py-[10px] text-[14px] text-black">{u.sent.toLocaleString()}</td>
                    <td className="border-b border-[#e6ebf1] px-[6px] py-[10px] text-[14px] text-black">{u.received.toLocaleString()}</td>
                    <td className="border-b border-[#e6ebf1] px-[6px] py-[10px] text-[14px] text-black">{u.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Section className="my-8">
            <Link
              className="rounded-lg bg-brand px-6 py-3 text-center text-[12px] font-semibold text-white no-underline"
              href="https://inbound.new/admin/user-information"
            >
              Open Dashboard
            </Link>
          </Section>

          <Text className="text-sm leading-6 text-black">
            Check out your{' '}
            <Link className="font-medium text-brand no-underline" href="https://inbound.new/admin/user-information">
              admin dashboard
            </Link>{' '}
            for more detailed analytics.
          </Text>
          <Text className="text-sm leading-6 text-black">— the inbound team</Text>

          <Section className="mt-8">
            <Text className="text-xs leading-4 text-neutral-500">
            inbound by exon
            <br />
            <br />
            4674 Town Center Parkway, Jacksonville, FL 32246
          </Text>
        </Section>
      </Container>
    </Body>
    </Tailwind>
  </Html>
);

export default DailyUsageSummaryEmail;
