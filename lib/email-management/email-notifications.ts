import { Resend } from 'resend';
import { render } from '@react-email/render';
import DomainVerifiedEmail from '@/emails/domain-verified';
import ReputationAlertEmail from '@/emails/reputation-alert';
import { Inbound } from '@inboundemail/sdk';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);
const inbound = new Inbound(process.env.INBOUND_API_KEY!);

export interface DomainVerificationNotificationData {
  userEmail: string;
  userName: string | null;
  domain: string;
  verifiedAt: Date;
}

export interface ReputationAlertNotificationData {
  userEmail: string;
  userName: string | null;
  alertType: 'bounce' | 'complaint' | 'delivery_delay';
  severity: 'warning' | 'critical';
  currentRate: number;
  threshold: number;
  configurationSet: string;
  tenantName: string;
  triggeredAt: Date;
  recommendations?: string[];
}

/**
 * Send domain verification notification email to the domain owner
 */
export async function sendDomainVerificationNotification(
  data: DomainVerificationNotificationData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log(`📧 sendDomainVerificationNotification - Sending notification for domain: ${data.domain} to ${data.userEmail}`);

    // Validate required environment variable
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ sendDomainVerificationNotification - RESEND_API_KEY not configured');
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    // Prepare email template props
    const templateProps = {
      userFirstname: data.userName?.split(' ')[0] || 'User',
      domain: data.domain,
      verifiedAt: data.verifiedAt.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      })
    };

    // Render the email template
    const html = await render(DomainVerifiedEmail(templateProps));

    // Determine the from address
    // Use a verified domain if available, otherwise use the default
    const fromEmail = 'notifications@inbound.new';
    
    // Format sender with name - Resend accepts "Name <email@domain.com>" format
    const fromWithName = `inbound support <${fromEmail}>`;

    // Send the email
    const response = await inbound.emails.send({
      from: fromWithName,
      to: data.userEmail,
      subject: `🎉 ${data.domain} has been successfully verified - inbound`,
      html: html,
      tags: [
        { name: 'type', value: 'domain-verification' },
        { name: 'domain', value: data.domain.replace(/[^a-zA-Z0-9_-]/g, '_') }
      ]
    });

    if (response.error) {
      console.error('❌ sendDomainVerificationNotification - Resend API error:', response.error);
      return {
        success: false,
        error: `Email sending failed: ${response.error}`
      };
    }

    console.log(`✅ sendDomainVerificationNotification - Email sent successfully to ${data.userEmail}`);
    console.log(`   📧 Message ID: ${response.data?.id}`);

    return {
      success: true,
      messageId: response.data?.id
    };

  } catch (error) {
    console.error('❌ sendDomainVerificationNotification - Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Send a test domain verification email (for testing purposes)
 */
export async function sendTestDomainVerificationEmail(
  testEmail: string,
  testDomain: string = 'example.com'
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendDomainVerificationNotification({
    userEmail: testEmail,
    userName: 'Test User',
    domain: testDomain,
    verifiedAt: new Date()
  });
}

/**
 * Send reputation alert notification email to the tenant owner
 */
export async function sendReputationAlertNotification(
  data: ReputationAlertNotificationData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    console.log(`🚨 sendReputationAlertNotification - Sending ${data.alertType} ${data.severity} alert for ${data.configurationSet} to ${data.userEmail}`);

    // Validate required environment variable
    if (!process.env.INBOUND_API_KEY) {
      console.error('❌ sendReputationAlertNotification - INBOUND_API_KEY not configured');
      return {
        success: false,
        error: 'Email service not configured'
      };
    }

    // Default recommendations based on alert type
    const defaultRecommendations = {
      bounce: [
        'Remove invalid email addresses from your mailing lists',
        'Verify email addresses before adding them to your lists',
        'Consider implementing double opt-in to improve list quality',
        'Check if your email content triggers spam filters'
      ],
      complaint: [
        'Review your email content for potential spam triggers',
        'Ensure you have clear unsubscribe links in all emails',
        'Verify that recipients have opted in to receive your emails',
        'Consider reducing email frequency'
      ],
      delivery_delay: [
        'Check your email sending patterns for unusual spikes',
        'Monitor your sender reputation across all domains',
        'Consider spreading email sends across longer time periods',
        'Verify your DNS and authentication settings'
      ]
    };

    // Prepare email template props
    const templateProps = {
      userFirstname: data.userName?.split(' ')[0] || 'User',
      alertType: data.alertType,
      severity: data.severity,
      currentRate: data.currentRate,
      threshold: data.threshold,
      configurationSet: data.configurationSet,
      tenantName: data.tenantName,
      triggeredAt: data.triggeredAt.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      }),
      recommendations: data.recommendations || defaultRecommendations[data.alertType]
    };

    // Render the email template
    const html = await render(ReputationAlertEmail(templateProps));

    // Create subject line based on alert type and severity
    const alertEmoji = data.severity === 'critical' ? '🚨' : '⚠️';
    const metricName = data.alertType === 'bounce' ? 'Bounce Rate' : 
                      data.alertType === 'complaint' ? 'Complaint Rate' : 'Delivery Delay';
    const percentageDisplay = data.alertType !== 'delivery_delay' 
      ? `${(data.currentRate * 100).toFixed(2)}%` 
      : `${data.currentRate.toFixed(0)} emails`;
    
    const subject = `${alertEmoji} SES ${data.severity.toUpperCase()}: ${metricName} Alert (${percentageDisplay}) - ${data.tenantName}`;

    // Determine the from address
    const fromEmail = 'alerts@inbound.new';
    const fromWithName = `inbound alerts <${fromEmail}>`;

    // Send the email
    const response = await inbound.emails.send({
      from: fromWithName,
      to: data.userEmail,
      subject: subject,
      html: html,
      tags: [
        { name: 'type', value: 'reputation-alert' },
        { name: 'alert_type', value: data.alertType },
        { name: 'severity', value: data.severity },
        { name: 'tenant', value: data.configurationSet.replace(/[^a-zA-Z0-9_-]/g, '_') }
      ]
    });

    if (response.error) {
      console.error('❌ sendReputationAlertNotification - Inbound API error:', response.error);
      return {
        success: false,
        error: `Email sending failed: ${response.error}`
      };
    }

    console.log(`✅ sendReputationAlertNotification - Alert email sent successfully to ${data.userEmail}`);
    console.log(`   📧 Message ID: ${response.data?.id}`);
    console.log(`   🏷️ Alert: ${data.alertType} ${data.severity} (${percentageDisplay})`);

    return {
      success: true,
      messageId: response.data?.id
    };

  } catch (error) {
    console.error('❌ sendReputationAlertNotification - Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Send a test reputation alert email (for testing purposes)
 */
export async function sendTestReputationAlertEmail(
  testEmail: string,
  alertType: 'bounce' | 'complaint' | 'delivery_delay' = 'bounce',
  severity: 'warning' | 'critical' = 'warning'
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  return sendReputationAlertNotification({
    userEmail: testEmail,
    userName: 'Test User',
    alertType: alertType,
    severity: severity,
    currentRate: alertType === 'bounce' ? 0.06 : alertType === 'complaint' ? 0.002 : 150,
    threshold: alertType === 'bounce' ? 0.05 : alertType === 'complaint' ? 0.001 : 100,
    configurationSet: 'test-tenant-123',
    tenantName: 'Test Tenant',
    triggeredAt: new Date()
  });
} 