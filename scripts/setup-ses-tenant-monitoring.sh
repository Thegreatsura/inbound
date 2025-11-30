#!/bin/bash

# SES Configuration Set Monitoring Setup Script
# Usage: ./setup-ses-tenant-monitoring.sh <REGION> <ACCOUNT_ID> <CONFIG_SET_NAME> <WEBHOOK_URL>

set -e

if [ "$#" -ne 4 ]; then
    echo "Usage: $0 <REGION> <ACCOUNT_ID> <CONFIG_SET_NAME> <WEBHOOK_URL>"
    echo "Example: $0 us-east-1 123456789012 user-john-doe-config https://inbound.new/api/inbound/health/tenant"
    echo ""
    echo "CONFIG_SET_NAME should be the AWS SES Configuration Set name for the user/tenant"
    echo "This is typically in format: user-<userId>-config or tenant-<tenantId>"
    exit 1
fi

REGION=$1
ACCT_ID=$2
CONFIG_SET_NAME=$3
WEBHOOK_URL=$4

echo "🚀 Setting up SES monitoring for configuration set: $CONFIG_SET_NAME in region: $REGION"

# 1) SNS topics
echo "📢 Creating SNS topics..."
aws sns create-topic --name "ses-${CONFIG_SET_NAME}-events" --region $REGION
aws sns create-topic --name "ses-${CONFIG_SET_NAME}-alerts" --region $REGION

# 2) Subscribe your webhook (HTTPS) to both topics
echo "🔗 Subscribing webhook to SNS topics..."
aws sns subscribe --topic-arn "arn:aws:sns:${REGION}:${ACCT_ID}:ses-${CONFIG_SET_NAME}-events" \
  --protocol https --notification-endpoint "${WEBHOOK_URL}" \
  --region $REGION

aws sns subscribe --topic-arn "arn:aws:sns:${REGION}:${ACCT_ID}:ses-${CONFIG_SET_NAME}-alerts" \
  --protocol https --notification-endpoint "${WEBHOOK_URL}" \
  --region $REGION

# 3) SES → SNS for raw bounces/complaints on the configuration set
echo "📧 Setting up SES event publishing..."
aws sesv2 create-configuration-set-event-destination \
  --configuration-set-name $CONFIG_SET_NAME \
  --event-destination "{
    \"Name\":\"sns-events\",
    \"Enabled\":true,
    \"MatchingEventTypes\":[\"BOUNCE\",\"COMPLAINT\",\"DELIVERY\",\"SEND\",\"REJECT\"],
    \"SnsDestination\":{\"TopicArn\":\"arn:aws:sns:${REGION}:${ACCT_ID}:ses-${CONFIG_SET_NAME}-events\"}
  }" \
  --region $REGION

# 4) CloudWatch Alarms (per-configuration-set) on reputation metrics
echo "⏰ Setting up CloudWatch alarms..."

# Bounce warning at 5%
aws cloudwatch put-metric-alarm \
  --alarm-name "SES-BounceRate-5%-${CONFIG_SET_NAME}" \
  --alarm-description "Bounce rate >= 5% for configuration set ${CONFIG_SET_NAME}" \
  --namespace AWS/SES --metric-name Reputation.BounceRate \
  --dimensions Name=ConfigurationSet,Value=$CONFIG_SET_NAME \
  --statistic Maximum --period 300 --evaluation-periods 2 \
  --datapoints-to-alarm 2 \
  --threshold 0.05 --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "arn:aws:sns:${REGION}:${ACCT_ID}:ses-${CONFIG_SET_NAME}-alerts" \
  --region $REGION

# Bounce critical at 7%
aws cloudwatch put-metric-alarm \
  --alarm-name "SES-BounceRate-7%-${CONFIG_SET_NAME}" \
  --alarm-description "CRITICAL: Bounce rate >= 7% for configuration set ${CONFIG_SET_NAME}" \
  --namespace AWS/SES --metric-name Reputation.BounceRate \
  --dimensions Name=ConfigurationSet,Value=$CONFIG_SET_NAME \
  --statistic Maximum --period 300 --evaluation-periods 1 \
  --datapoints-to-alarm 1 \
  --threshold 0.07 --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "arn:aws:sns:${REGION}:${ACCT_ID}:ses-${CONFIG_SET_NAME}-alerts" \
  --region $REGION

# Complaint warning at 0.1%
aws cloudwatch put-metric-alarm \
  --alarm-name "SES-ComplaintRate-0.1%-${CONFIG_SET_NAME}" \
  --alarm-description "Complaint rate >= 0.1% for configuration set ${CONFIG_SET_NAME}" \
  --namespace AWS/SES --metric-name Reputation.ComplaintRate \
  --dimensions Name=ConfigurationSet,Value=$CONFIG_SET_NAME \
  --statistic Maximum --period 300 --evaluation-periods 2 \
  --datapoints-to-alarm 2 \
  --threshold 0.001 --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "arn:aws:sns:${REGION}:${ACCT_ID}:ses-${CONFIG_SET_NAME}-alerts" \
  --region $REGION

# Complaint critical at 0.3%
aws cloudwatch put-metric-alarm \
  --alarm-name "SES-ComplaintRate-0.3%-${CONFIG_SET_NAME}" \
  --alarm-description "CRITICAL: Complaint rate >= 0.3% for configuration set ${CONFIG_SET_NAME}" \
  --namespace AWS/SES --metric-name Reputation.ComplaintRate \
  --dimensions Name=ConfigurationSet,Value=$CONFIG_SET_NAME \
  --statistic Maximum --period 300 --evaluation-periods 1 \
  --datapoints-to-alarm 1 \
  --threshold 0.003 --comparison-operator GreaterThanOrEqualToThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "arn:aws:sns:${REGION}:${ACCT_ID}:ses-${CONFIG_SET_NAME}-alerts" \
  --region $REGION

# Optional: Delivery delay alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "SES-DeliveryDelay-${CONFIG_SET_NAME}" \
  --alarm-description "High delivery delay for configuration set ${CONFIG_SET_NAME}" \
  --namespace AWS/SES --metric-name Send \
  --dimensions Name=ConfigurationSet,Value=$CONFIG_SET_NAME \
  --statistic Sum --period 900 --evaluation-periods 3 \
  --datapoints-to-alarm 2 \
  --threshold 100 --comparison-operator GreaterThanThreshold \
  --treat-missing-data notBreaching \
  --alarm-actions "arn:aws:sns:${REGION}:${ACCT_ID}:ses-${CONFIG_SET_NAME}-alerts" \
  --region $REGION

echo "✅ SES monitoring setup completed for configuration set: $CONFIG_SET_NAME"
echo "📧 Events will be sent to: ${WEBHOOK_URL}"
echo "📊 Monitor alarms in CloudWatch console: https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#alarmsV2:"
