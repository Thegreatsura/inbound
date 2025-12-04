/**
 * AWS SES SMTP Example Script
 *
 * Sends emails via AWS SES using SMTP with Nodemailer and tenant isolation.
 * Tests against AWS SES Mailbox Simulator addresses to see different SMTP responses.
 *
 * Usage: bun run scripts/smtp-ses-example.ts
 *
 * @see https://docs.aws.amazon.com/ses/latest/dg/tenants.html#using-smtp-with-tenants
 * @see https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html#send-email-simulator
 */

import * as nodemailer from "nodemailer";
import type { SentMessageInfo } from "nodemailer";
import * as dotenv from "dotenv";

dotenv.config();

// AWS SES Mailbox Simulator addresses for testing
// @see https://docs.aws.amazon.com/ses/latest/dg/send-an-email-from-console.html#send-email-simulator
const SES_SIMULATOR = {
	// Email is accepted and delivered successfully
	SUCCESS: "success@simulator.amazonses.com",
	// Generates a hard bounce (recipient doesn't exist)
	BOUNCE: "bounce@simulator.amazonses.com",
	// Generates a complaint (recipient marked as spam)
	COMPLAINT: "complaint@simulator.amazonses.com",
	// Generates an out-of-office auto-reply
	OUT_OF_OFFICE: "ooto@simulator.amazonses.com",
	// Address is on the SES suppression list
	SUPPRESSION_LIST: "suppressionlist@simulator.amazonses.com",
};

// Configuration
const config = {
	region: process.env.AWS_REGION || "us-east-2",
	smtpUser: process.env.AWS_SES_SMTP_USER,
	smtpPassword: process.env.AWS_SES_SMTP_PASSWORD,
	tenantName: "inbound-testing-tenant",
	verifiedDomain: "testing.inbound.new",
};

const colors = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	cyan: "\x1b[36m",
	magenta: "\x1b[35m",
	dim: "\x1b[2m",
};

function log(message: string, color: keyof typeof colors = "reset") {
	console.log(`${colors[color]}${message}${colors.reset}`);
}

function getSmtpEndpoint(region: string): string {
	return `email-smtp.${region}.amazonaws.com`;
}

function createSesTransporter() {
	return nodemailer.createTransport({
		host: getSmtpEndpoint(config.region),
		port: 587,
		secure: false,
		auth: {
			user: config.smtpUser!,
			pass: config.smtpPassword!,
		},
	});
}

/**
 * Log detailed SMTP response information
 */
function logSmtpResponse(info: SentMessageInfo, label: string) {
	log(`\n${"─".repeat(50)}`, "dim");
	log(`📬 ${label} - SMTP Response Details:`, "bright");
	log(`${"─".repeat(50)}`, "dim");

	log(`Message ID:      ${info.messageId}`, "green");
	log(`Accepted:        ${JSON.stringify(info.accepted)}`, "cyan");
	log(`Rejected:        ${JSON.stringify(info.rejected)}`, info.rejected?.length ? "red" : "cyan");
	log(`Envelope From:   ${info.envelope?.from}`, "blue");
	log(`Envelope To:     ${JSON.stringify(info.envelope?.to)}`, "blue");
	log(`Response:        ${info.response}`, "yellow");

	// Parse the response for SES message ID
	const sesMessageIdMatch = info.response?.match(/Ok\s+(\S+)/);
	if (sesMessageIdMatch) {
		log(`SES Message ID:  ${sesMessageIdMatch[1]}`, "magenta");
	}

	log(`${"─".repeat(50)}\n`, "dim");
}

/**
 * Send email with tenant header to a specific recipient
 */
async function sendTenantEmail(
	transporter: nodemailer.Transporter,
	to: string,
	label: string,
): Promise<{ success: boolean; info?: SentMessageInfo; error?: Error }> {
	const from = `Inbound SMTP <noreply@${config.verifiedDomain}>`;
	const subject = `[Tenant Test] ${label} - ${new Date().toISOString()}`;

	log(`\n📧 Test: ${label}`, "cyan");
	log(`   To: ${to}`, "blue");
	log(`   Tenant: ${config.tenantName}`, "magenta");

	try {
		const info = await transporter.sendMail({
			from,
			to,
			subject,
			text: `SES Mailbox Simulator Test\n\nTest Type: ${label}\nRecipient: ${to}\nTenant: ${config.tenantName}\nTimestamp: ${new Date().toISOString()}`,
			headers: {
				"X-SES-TENANT": config.tenantName,
			},
		});

		return { success: true, info };
	} catch (error: any) {
		return { success: false, error };
	}
}

async function main() {
	log("\n🚀 AWS SES SMTP + Mailbox Simulator Test", "bright");
	log(`Region: ${config.region} | Tenant: ${config.tenantName}`, "dim");
	log(`Testing against SES Mailbox Simulator addresses\n`, "dim");

	if (!config.smtpUser || !config.smtpPassword) {
		log("❌ Missing AWS_SES_SMTP_USER or AWS_SES_SMTP_PASSWORD", "red");
		process.exit(1);
	}

	const transporter = createSesTransporter();

	// Test scenarios using SES Mailbox Simulator + real address
	const testCases = [
		{ to: "ryan@rwheeler121.xyz", label: "REAL ADDRESS" },
		{ to: SES_SIMULATOR.SUCCESS, label: "SUCCESS (delivered)" },
		{ to: SES_SIMULATOR.BOUNCE, label: "BOUNCE (hard bounce)" },
		{ to: SES_SIMULATOR.COMPLAINT, label: "COMPLAINT (spam report)" },
		{ to: SES_SIMULATOR.OUT_OF_OFFICE, label: "OUT OF OFFICE (auto-reply)" },
		{ to: SES_SIMULATOR.SUPPRESSION_LIST, label: "SUPPRESSION LIST" },
	];

	const results: { label: string; success: boolean; response?: string; error?: string }[] = [];

	try {
		// Verify connection
		log("🔌 Verifying SMTP connection...", "cyan");
		await transporter.verify();
		log("✅ Connected to SES SMTP", "green");

		log("\n" + "═".repeat(60), "bright");
		log("📬 SENDING TO MAILBOX SIMULATOR ADDRESSES", "bright");
		log("═".repeat(60), "bright");

		for (const testCase of testCases) {
			const result = await sendTenantEmail(transporter, testCase.to, testCase.label);

			if (result.success && result.info) {
				logSmtpResponse(result.info, testCase.label);
				results.push({
					label: testCase.label,
					success: true,
					response: result.info.response,
				});
			} else {
				log(`   ❌ SMTP Error: ${result.error?.message}`, "red");
				results.push({
					label: testCase.label,
					success: false,
					error: result.error?.message,
				});
			}
		}

		// Summary
		log("\n" + "═".repeat(60), "bright");
		log("📊 SUMMARY - SMTP RESPONSES BY SCENARIO", "bright");
		log("═".repeat(60), "bright");

		for (const result of results) {
			const icon = result.success ? "✅" : "❌";
			const color = result.success ? "green" : "red";
			log(`\n${icon} ${result.label}`, color);
			if (result.response) {
				log(`   Response: ${result.response}`, "dim");
			}
			if (result.error) {
				log(`   Error: ${result.error}`, "red");
			}
		}

		log("\n" + "═".repeat(60), "bright");
		log("💡 Note: Bounces/complaints are processed asynchronously via SNS", "yellow");
		log("   The SMTP response will be '250 Ok' for all accepted emails.", "yellow");
		log("   Check your SNS notifications or SES event destinations for", "yellow");
		log("   the actual bounce/complaint events.", "yellow");
		log("═".repeat(60) + "\n", "bright");

	} catch (error: any) {
		log(`❌ Error: ${error.message}`, "red");
		process.exit(1);
	} finally {
		transporter.close();
	}
}

main();
