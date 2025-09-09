import { ReputationAlertEmail } from './reputation-alert';

export default function ReputationAlertPreview() {
  return (
    <ReputationAlertEmail 
      userFirstname="John"
      alertType="bounce"
      severity="critical"
      currentRate={0.08}
      threshold={0.05}
      configurationSet="tenant-john-doe-123"
      tenantName="John's Marketing"
      triggeredAt={new Date().toLocaleString()}
      recommendations={[
        'Remove invalid email addresses from your lists',
        'Verify your email content is not triggering spam filters',
        'Consider implementing double opt-in to improve list quality',
        'Check if any recent campaigns had issues'
      ]}
    />
  );
}
