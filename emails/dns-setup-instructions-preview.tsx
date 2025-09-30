import { DnsSetupInstructionsEmail } from './dns-setup-instructions';

export default function DnsSetupInstructionsPreview() {
  return (
    <DnsSetupInstructionsEmail
      recipientName="John Smith"
      recipientEmail="john@company.com"
      domain="company.com"
      provider="Cloudflare"
      senderName="Sarah Johnson"
      dnsRecords={[
        {
          type: "TXT",
          name: "_amazonses",
          value: "abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567"
        },
        {
          type: "TXT", 
          name: "_amazonses.company.com",
          value: "xyz987wvu654tsr321qpo098nml765kji432hgf210edc098ba"
        },
        {
          type: "MX",
          name: "@",
          value: "10 inbound-smtp.us-east-1.amazonaws.com"
        },
        {
          type: "TXT",
          name: "@",
          value: "v=spf1 include:amazonses.com ~all"
        }
      ]}
    />
  );
}
