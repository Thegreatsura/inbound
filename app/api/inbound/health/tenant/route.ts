import { NextRequest, NextResponse } from 'next/server';
import { getTenantOwnerByConfigurationSet } from '@/lib/db/tenants';
import { sendReputationAlertNotification } from '@/lib/email-management/email-notifications';

// Types for AWS SNS notifications
interface SNSNotification {
  Type: 'Notification' | 'SubscriptionConfirmation' | 'UnsubscribeConfirmation';
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  UnsubscribeURL?: string;
  SubscribeURL?: string;
  Token?: string;
}

// CloudWatch Alarm notification format
interface CloudWatchAlarmMessage {
  AlarmName: string;
  AlarmDescription: string;
  AWSAccountId: string;
  Region: string;
  NewStateValue: 'ALARM' | 'OK' | 'INSUFFICIENT_DATA';
  NewStateReason: string;
  StateChangeTime: string;
  MetricName: string;
  Namespace: string;
  Statistic: string;
  Dimensions: Array<{
    name: string;
    value: string;
  }>;
  Period: number;
  EvaluationPeriods: number;
  ComparisonOperator: string;
  Threshold: number;
  TreatMissingData: string;
  EvaluatedDatapoints: Array<{
    timestamp: string;
    sampleCount: number;
    value: number;
  }>;
}

// SES Event notification format  
interface SESEvent {
  eventType: 'send' | 'reject' | 'bounce' | 'complaint' | 'delivery';
  mail: {
    timestamp: string;
    messageId: string;
    source: string;
    sourceArn: string;
    sourceIp: string;
    sendingAccountId: string;
    callerIdentity: string;
    configurationSetName?: string;
    tags: {
      [key: string]: string[];
    };
    commonHeaders: {
      from: string[];
      to: string[];
      messageId: string;
      subject: string;
    };
    destination: string[];
  };
  bounce?: {
    bounceType: 'Undetermined' | 'Permanent' | 'Transient';
    bounceSubType: string;
    bouncedRecipients: Array<{
      emailAddress: string;
      action: string;
      status: string;
      diagnosticCode: string;
    }>;
    timestamp: string;
    feedbackId: string;
    reportingMTA: string;
  };
  complaint?: {
    complainedRecipients: Array<{
      emailAddress: string;
    }>;
    timestamp: string;
    feedbackId: string;
    userAgent: string;
    complaintFeedbackType: string;
    arrivalDate: string;
  };
}

interface SESEventMessage {
  Records: SESEvent[];
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚨 POST /api/inbound/health/tenant - Received SNS notification');
    
    // Get the request body
    const body = await request.json() as SNSNotification;
    
    // Parse the SNS notification
    const parsedNotification = parseSNSNotification(body);
    
    if (parsedNotification.messageType === 'SubscriptionConfirmation') {
      console.log('✅ SubscriptionConfirmation received for tenant health monitoring');
      console.log('   Topic ARN:', parsedNotification.topicArn);
      console.log('   Subscribe URL:', body.SubscribeURL);
      
      // In production, you might want to automatically confirm subscriptions
      // For now, we'll just log and return success
      return NextResponse.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'Subscription confirmation received - please manually confirm via AWS console',
        subscribeUrl: body.SubscribeURL
      });
    }
    
    // Log the notification
    console.log('=== AWS SNS Tenant Health Notification ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('SNS Message Type:', parsedNotification.messageType);
    console.log('Topic ARN:', parsedNotification.topicArn);

    // Handle CloudWatch Alarms
    if (parsedNotification.cloudWatchAlarm) {
      console.log('--- CloudWatch Alarm Details ---');
      const alarm = parsedNotification.cloudWatchAlarm;
      console.log('Alarm Name:', alarm.AlarmName);
      console.log('State:', alarm.NewStateValue);
      console.log('Metric:', alarm.MetricName);
      console.log('Threshold:', alarm.Threshold);
      
      if (alarm.NewStateValue === 'ALARM') {
        await handleCloudWatchAlarm(alarm);
      } else {
        console.log('⏭️ Ignoring non-ALARM state:', alarm.NewStateValue);
      }
    }
    
    // Handle SES Events
    if (parsedNotification.sesEvents) {
      console.log('--- SES Events Details ---');
      console.log(`Received ${parsedNotification.sesEvents.Records.length} SES event(s)`);
      
      for (const event of parsedNotification.sesEvents.Records) {
        console.log(`Event Type: ${event.eventType}`);
        console.log(`Configuration Set: ${event.mail.configurationSetName || 'N/A'}`);
        console.log(`Message ID: ${event.mail.messageId}`);
        
        // For now, just log SES events - individual events don't trigger alerts
        // Alarms are triggered by CloudWatch based on aggregate metrics
        if (event.eventType === 'bounce' || event.eventType === 'complaint') {
          console.log(`📊 ${event.eventType} event logged for monitoring`);
        }
      }
    }
    
    // Log raw data for debugging (limit size for large payloads)
    const rawDataPreview = JSON.stringify(parsedNotification, null, 2).substring(0, 1000);
    console.log('--- Raw SNS Data Preview ---');
    console.log(rawDataPreview + (rawDataPreview.length >= 1000 ? '...[truncated]' : ''));

    // Return success response
    return NextResponse.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'Tenant health notification processed successfully',
      messageType: parsedNotification.messageType,
      hasCloudWatchAlarm: !!parsedNotification.cloudWatchAlarm,
      hasSESEvents: !!parsedNotification.sesEvents,
      eventsProcessed: parsedNotification.sesEvents?.Records.length || 0
    });

  } catch (error) {
    console.error('❌ Error processing tenant health notification:', error);
    
    return NextResponse.json(
      { 
        status: 'error',
        timestamp: new Date().toISOString(),
        message: 'Tenant health notification processing failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function parseSNSNotification(snsData: SNSNotification) {
  const result = {
    messageType: snsData.Type,
    messageId: snsData.MessageId,
    topicArn: snsData.TopicArn,
    timestamp: snsData.Timestamp,
    cloudWatchAlarm: null as CloudWatchAlarmMessage | null,
    sesEvents: null as SESEventMessage | null
  };

  // Parse the Message field if it's a Notification
  if (snsData.Type === 'Notification' && snsData.Message) {
    try {
      const parsedMessage = JSON.parse(snsData.Message);
      
      // Check if it's a CloudWatch Alarm
      if (parsedMessage.AlarmName && parsedMessage.MetricName) {
        result.cloudWatchAlarm = parsedMessage as CloudWatchAlarmMessage;
      }
      // Check if it's SES Events
      else if (parsedMessage.Records && Array.isArray(parsedMessage.Records)) {
        result.sesEvents = parsedMessage as SESEventMessage;
      }
      else {
        console.log('🤔 Unknown message format:', Object.keys(parsedMessage));
      }
    } catch (error) {
      console.error('❌ Failed to parse SNS Message field:', error);
    }
  }

  return result;
}

async function handleCloudWatchAlarm(alarm: CloudWatchAlarmMessage) {
  try {
    console.log(`🚨 handleCloudWatchAlarm - Processing alarm: ${alarm.AlarmName}`);
    
    // Extract configuration set from dimensions
    const configSetDimension = alarm.Dimensions.find(d => d.name === 'ConfigurationSet');
    if (!configSetDimension) {
      console.log('⚠️ No ConfigurationSet dimension found in alarm');
      return;
    }
    
    const configurationSet = configSetDimension.value;
    console.log(`🔍 Configuration Set: ${configurationSet}`);
    
    // Look up tenant and user information
    const tenantOwner = await getTenantOwnerByConfigurationSet(configurationSet);
    if (!tenantOwner) {
      console.log(`❌ No tenant owner found for configuration set: ${configurationSet}`);
      return;
    }
    
    console.log(`✅ Found tenant owner: ${tenantOwner.userEmail} (${tenantOwner.tenantName})`);
    
    // Determine alert type and severity from alarm name and metric
    const alertInfo = parseAlarmInfo(alarm);
    if (!alertInfo) {
      console.log('⚠️ Could not parse alert information from alarm');
      return;
    }
    
    console.log(`📊 Alert Info: ${alertInfo.alertType} ${alertInfo.severity} (${alertInfo.currentRate})`);
    
    // Send notification email
    const emailResult = await sendReputationAlertNotification({
      userEmail: tenantOwner.userEmail,
      userName: tenantOwner.userName,
      alertType: alertInfo.alertType,
      severity: alertInfo.severity,
      currentRate: alertInfo.currentRate,
      threshold: alarm.Threshold,
      configurationSet: configurationSet,
      tenantName: tenantOwner.tenantName,
      triggeredAt: new Date(alarm.StateChangeTime)
    });
    
    if (emailResult.success) {
      console.log(`✅ handleCloudWatchAlarm - Alert email sent successfully`);
      console.log(`   📧 Email sent to: ${tenantOwner.userEmail}`);
      console.log(`   📧 Message ID: ${emailResult.messageId}`);
    } else {
      console.error(`❌ handleCloudWatchAlarm - Failed to send alert email`);
      console.error(`   Error: ${emailResult.error}`);
    }
    
  } catch (error) {
    console.error('❌ handleCloudWatchAlarm - Unexpected error:', error);
  }
}

function parseAlarmInfo(alarm: CloudWatchAlarmMessage): {
  alertType: 'bounce' | 'complaint' | 'delivery_delay';
  severity: 'warning' | 'critical';
  currentRate: number;
} | null {
  try {
    // Get the most recent datapoint value
    const latestDatapoint = alarm.EvaluatedDatapoints
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    
    if (!latestDatapoint) {
      console.log('⚠️ No evaluated datapoints found in alarm');
      return null;
    }
    
    const currentRate = latestDatapoint.value;
    
    // Parse alert type from metric name
    let alertType: 'bounce' | 'complaint' | 'delivery_delay';
    if (alarm.MetricName === 'Reputation.BounceRate') {
      alertType = 'bounce';
    } else if (alarm.MetricName === 'Reputation.ComplaintRate') {
      alertType = 'complaint';  
    } else if (alarm.MetricName === 'Send') {
      alertType = 'delivery_delay';
    } else {
      console.log(`⚠️ Unknown metric name: ${alarm.MetricName}`);
      return null;
    }
    
    // Parse severity from alarm name or threshold
    let severity: 'warning' | 'critical';
    const alarmNameLower = alarm.AlarmName.toLowerCase();
    if (alarmNameLower.includes('critical') || alarmNameLower.includes('7%') || alarmNameLower.includes('0.3%')) {
      severity = 'critical';
    } else {
      severity = 'warning';
    }
    
    return {
      alertType,
      severity,
      currentRate
    };
    
  } catch (error) {
    console.error('❌ parseAlarmInfo - Error parsing alarm info:', error);
    return null;
  }
}

// Optional: Add GET method for basic health checks
export async function GET() {
  console.log('GET request to /api/inbound/health/tenant:', {
    timestamp: new Date().toISOString(),
    message: 'Tenant health check via GET'
  });

  return NextResponse.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Tenant health check successful (GET)',
    service: 'SES Tenant Reputation Monitoring'
  });
}
