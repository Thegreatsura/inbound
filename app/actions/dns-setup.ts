"use server";

import { render } from "@react-email/components";
import { Inbound } from "@inboundemail/sdk";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import DnsSetupInstructionsEmail from "@/emails/dns-setup-instructions";

// Initialize Inbound client
const inbound = new Inbound(process.env.INBOUND_API_KEY!);

interface DnsRecord {
  type: "TXT" | "MX" | string;
  name: string;
  value: string;
  isVerified?: boolean;
}

export interface SendDnsSetupData {
  recipientEmail: string;
  recipientName?: string;
  domain: string;
  dnsRecords: DnsRecord[];
  provider?: string;
}

/**
 * Server action to send DNS setup instructions email
 */
export async function sendDnsSetupInstructions(
  data: SendDnsSetupData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });
    
    if (!session?.user?.id) {
      return {
        success: false,
        error: 'Authentication required'
      };
    }

    // Validate required environment variable
    if (!process.env.INBOUND_API_KEY) {
      console.error('❌ sendDnsSetupInstructions - INBOUND_API_KEY not configured');
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    // Validate required fields
    if (!data.recipientEmail?.trim()) {
      return {
        success: false,
        error: 'Recipient email is required'
      };
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.recipientEmail.trim())) {
      return {
        success: false,
        error: 'Please enter a valid email address'
      };
    }

    if (!data.domain?.trim()) {
      return {
        success: false,
        error: 'Domain is required'
      };
    }

    if (!data.dnsRecords || data.dnsRecords.length === 0) {
      return {
        success: false,
        error: 'DNS records are required'
      };
    }

    console.log(`📧 sendDnsSetupInstructions - Sending DNS setup instructions for ${data.domain} to: ${data.recipientEmail}`);

    // Prepare email template props
    const templateProps = {
      recipientName: data.recipientName || 'IT Team',
      recipientEmail: data.recipientEmail.trim(),
      domain: data.domain.trim(),
      dnsRecords: data.dnsRecords,
      provider: data.provider || 'your DNS provider',
      senderName: session.user.name?.split(' ')[0] || 'Team Member'
    };

    // Render the email template
    const html = await render(DnsSetupInstructionsEmail(templateProps));

    // Determine the from address
    const fromEmail = 'setup@inbound.new';
    
    // Format sender with name - Inbound accepts "Name <email@domain.com>" format
    const fromWithName = `inbound DNS Setup <${fromEmail}>`;

    // Send the email
    const response = await inbound.emails.send({
      from: fromWithName,
      to: data.recipientEmail.trim(),
      replyTo: session.user.email || 'support@inbound.new',
      subject: `DNS Setup Instructions for ${data.domain} - inbound`,
      html: html,
      tags: [
        { name: 'type', value: 'dns-setup-instructions' },
        { name: 'domain', value: data.domain },
        { name: 'user_id', value: session.user.id }
      ]
    });

    if (response.error) {
      console.error('❌ sendDnsSetupInstructions - Inbound API error:', response.error);
      const errMsg = typeof response.error === 'string' ? response.error : (response.error as any)?.message || 'Unknown error';
      return {
        success: false,
        error: `Email sending failed: ${errMsg}`
      };
    }

    console.log(`✅ sendDnsSetupInstructions - DNS setup instructions sent successfully to ${data.recipientEmail}`);
    console.log(`   📧 Message ID: ${response.data?.id}`);
    console.log(`   🌐 Domain: ${data.domain}`);

    return {
      success: true,
      messageId: response.data?.id
    };

  } catch (error) {
    console.error('❌ sendDnsSetupInstructions - Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
