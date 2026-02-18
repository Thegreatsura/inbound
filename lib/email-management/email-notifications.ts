import Inbound from "inboundemail";
import { render } from "@react-email/render";
import DomainVerifiedEmail from "@/emails/domain-verified";
import LimitReachedEmail from "@/emails/limit-reached";
import ReputationAlertEmail from "@/emails/reputation-alert";
import { redis } from "@/lib/redis";

const inbound = new Inbound({
	apiKey: process.env.INBOUND_API_KEY!,
});

// Slack webhook for admin notifications
const SLACK_ADMIN_WEBHOOK_URL = process.env.SLACK_ADMIN_WEBHOOK_URL;

export interface DomainVerificationNotificationData {
	userEmail: string;
	userName: string | null;
	domain: string;
	verifiedAt: Date;
}

export interface ReputationAlertNotificationData {
	userEmail: string;
	userName: string | null;
	alertType: "bounce" | "complaint" | "delivery_delay";
	severity: "warning" | "critical";
	currentRate: number;
	threshold: number;
	configurationSet: string;
	tenantName: string;
	triggeredAt: Date;
	recommendations?: string[];
	sendingPaused?: boolean; // True if sending was auto-paused due to critical threshold
}

export interface LimitReachedNotificationData {
	userEmail: string;
	userName: string | null;
	userId: string;
	limitType: "inbound_triggers" | "emails_sent" | "domains";
	currentUsage?: number;
	limit?: number;
	rejectedEmailCount?: number;
	rejectedRecipient?: string;
	domain?: string;
	triggeredAt: Date;
}

/**
 * Send domain verification notification email to the domain owner
 */
export async function sendDomainVerificationNotification(
	data: DomainVerificationNotificationData,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
	try {
		console.log(
			`📧 sendDomainVerificationNotification - Sending notification for domain: ${data.domain} to ${data.userEmail}`,
		);

		// Validate required environment variable
		if (!process.env.INBOUND_API_KEY) {
			console.error(
				"❌ sendDomainVerificationNotification - INBOUND_API_KEY not configured",
			);
			return {
				success: false,
				error: "Email service not configured",
			};
		}

		// Prepare email template props
		const templateProps = {
			userFirstname: data.userName?.split(" ")[0] || "User",
			domain: data.domain,
			verifiedAt: data.verifiedAt.toLocaleDateString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				timeZoneName: "short",
			}),
		};

		// Render the email template
		const html = await render(DomainVerifiedEmail(templateProps));

		// Determine the from address
		// Use a verified domain if available, otherwise use the default
		const fromEmail = "notifications@inbound.new";

		// Format sender with name - Resend accepts "Name <email@domain.com>" format
		const fromWithName = `inbound support <${fromEmail}>`;

		// Send the email
		const response = await inbound.emails.send({
			from: fromWithName,
			to: data.userEmail,
			subject: `🎉 ${data.domain} has been successfully verified - inbound`,
			html: html,
			tags: [
				{ name: "type", value: "domain-verification" },
				{ name: "domain", value: data.domain.replace(/[^a-zA-Z0-9_-]/g, "_") },
			],
		});

		console.log(
			`✅ sendDomainVerificationNotification - Email sent successfully to ${data.userEmail}`,
		);
		console.log(`   📧 Message ID: ${response.id}`);

		return {
			success: true,
			messageId: response.id,
		};
	} catch (error) {
		console.error(
			"❌ sendDomainVerificationNotification - Unexpected error:",
			error,
		);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

/**
 * Send a test domain verification email (for testing purposes)
 */
export async function sendTestDomainVerificationEmail(
	testEmail: string,
	testDomain: string = "example.com",
): Promise<{ success: boolean; messageId?: string; error?: string }> {
	return sendDomainVerificationNotification({
		userEmail: testEmail,
		userName: "Test User",
		domain: testDomain,
		verifiedAt: new Date(),
	});
}

// Redis key prefix for reputation alert rate limiting
const REPUTATION_ALERT_REDIS_PREFIX = "reputation-alert:";
const REPUTATION_ALERT_COOLDOWN_SECONDS = 24 * 60 * 60; // 24 hour cooldown per alert type
const REPUTATION_CRITICAL_COOLDOWN_SECONDS = 4 * 60 * 60; // 4 hour cooldown for critical (more frequent)

/**
 * Send reputation alert notification email to the tenant owner
 * Includes rate limiting to prevent spamming users (uses Redis for persistence)
 */
export async function sendReputationAlertNotification(
	data: ReputationAlertNotificationData,
): Promise<{
	success: boolean;
	messageId?: string;
	error?: string;
	skipped?: boolean;
}> {
	try {
		// Rate limit key: unique per user + alert type + severity
		// This allows critical alerts to come through even if a warning was sent
		const redisKey = `${REPUTATION_ALERT_REDIS_PREFIX}${data.userEmail}:${data.alertType}:${data.severity}`;
		const cooldownSeconds =
			data.severity === "critical"
				? REPUTATION_CRITICAL_COOLDOWN_SECONDS
				: REPUTATION_ALERT_COOLDOWN_SECONDS;

		// Check if we should skip due to rate limiting (using Redis for persistence)
		try {
			const lastNotification = await redis.get<number>(redisKey);
			if (lastNotification) {
				const now = Date.now();
				const timeSinceLastMs = now - lastNotification;
				const cooldownMs = cooldownSeconds * 1000;

				if (timeSinceLastMs < cooldownMs) {
					const hoursRemaining = Math.ceil(
						(cooldownMs - timeSinceLastMs) / (60 * 60 * 1000),
					);
					console.log(
						`⏭️ sendReputationAlertNotification - Skipping ${data.alertType} ${data.severity} notification for ${data.userEmail} - cooldown active, ~${hoursRemaining} hours remaining`,
					);
					return {
						success: true,
						skipped: true,
						error: `Notification skipped due to rate limiting (cooldown: ~${hoursRemaining} hours remaining)`,
					};
				}
			}
		} catch (redisError) {
			// If Redis fails, log but continue sending (better to occasionally double-send than never send)
			console.warn(
				"⚠️ sendReputationAlertNotification - Redis check failed, proceeding with notification:",
				redisError,
			);
		}

		console.log(
			`🚨 sendReputationAlertNotification - Sending ${data.alertType} ${data.severity} alert for ${data.configurationSet} to ${data.userEmail}`,
		);

		// Validate required environment variable
		if (!process.env.INBOUND_API_KEY) {
			console.error(
				"❌ sendReputationAlertNotification - INBOUND_API_KEY not configured",
			);
			return {
				success: false,
				error: "Email service not configured",
			};
		}

		// Default recommendations based on alert type
		const defaultRecommendations = {
			bounce: [
				"Remove invalid email addresses from your mailing lists",
				"Verify email addresses before adding them to your lists",
				"Consider implementing double opt-in to improve list quality",
				"Check if your email content triggers spam filters",
			],
			complaint: [
				"Review your email content for potential spam triggers",
				"Ensure you have clear unsubscribe links in all emails",
				"Verify that recipients have opted in to receive your emails",
				"Consider reducing email frequency",
			],
			delivery_delay: [
				"Check your email sending patterns for unusual spikes",
				"Monitor your sender reputation across all domains",
				"Consider spreading email sends across longer time periods",
				"Verify your DNS and authentication settings",
			],
		};

		// Prepare email template props
		const templateProps = {
			userFirstname: data.userName?.split(" ")[0] || "User",
			alertType: data.alertType,
			severity: data.severity,
			currentRate: data.currentRate,
			threshold: data.threshold,
			configurationSet: data.configurationSet,
			tenantName: data.tenantName,
			triggeredAt: data.triggeredAt.toLocaleString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				timeZoneName: "short",
			}),
			recommendations:
				data.recommendations || defaultRecommendations[data.alertType],
			sendingPaused: data.sendingPaused || false,
		};

		// Render the email template
		const html = await render(ReputationAlertEmail(templateProps));

		// Create subject line based on alert type and severity
		const alertEmoji = data.severity === "critical" ? "🚨" : "⚠️";
		const metricName =
			data.alertType === "bounce"
				? "Bounce Rate"
				: data.alertType === "complaint"
					? "Complaint Rate"
					: "Delivery Delay";
		const percentageDisplay =
			data.alertType !== "delivery_delay"
				? `${(data.currentRate * 100).toFixed(2)}%`
				: `${data.currentRate.toFixed(0)} emails`;

		const subject = `${alertEmoji} ${data.severity.toUpperCase()}: ${metricName} Alert (${percentageDisplay}) - ${data.tenantName}`;

		// Determine the from address
		const fromEmail = "alerts@inbound.new";
		const fromWithName = `Inbound Security <${fromEmail}>`;

		// Send the email
		const response = await inbound.emails.send({
			from: fromWithName,
			to: data.userEmail,
			subject: subject,
			html: html,
			tags: [
				{ name: "type", value: "reputation-alert" },
				{ name: "alert_type", value: data.alertType },
				{ name: "severity", value: data.severity },
				{
					name: "tenant",
					value: data.configurationSet.replace(/[^a-zA-Z0-9_-]/g, "_"),
				},
			],
		});

		// Update Redis to prevent future spam (set with TTL for automatic cleanup)
		try {
			await redis.set(redisKey, Date.now(), { ex: cooldownSeconds });
		} catch (redisError) {
			console.warn(
				"⚠️ sendReputationAlertNotification - Failed to set Redis cooldown:",
				redisError,
			);
		}

		console.log(
			`✅ sendReputationAlertNotification - Alert email sent successfully to ${data.userEmail}`,
		);
		console.log(`   📧 Message ID: ${response.id}`);
		console.log(
			`   🏷️ Alert: ${data.alertType} ${data.severity} (${percentageDisplay})`,
		);

		return {
			success: true,
			messageId: response.id,
		};
	} catch (error) {
		console.error(
			"❌ sendReputationAlertNotification - Unexpected error:",
			error,
		);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

/**
 * Send a test reputation alert email (for testing purposes)
 */
export async function sendTestReputationAlertEmail(
	testEmail: string,
	alertType: "bounce" | "complaint" | "delivery_delay" = "bounce",
	severity: "warning" | "critical" = "warning",
): Promise<{ success: boolean; messageId?: string; error?: string }> {
	return sendReputationAlertNotification({
		userEmail: testEmail,
		userName: "Test User",
		alertType: alertType,
		severity: severity,
		currentRate:
			alertType === "bounce" ? 0.06 : alertType === "complaint" ? 0.002 : 150,
		threshold:
			alertType === "bounce" ? 0.05 : alertType === "complaint" ? 0.001 : 100,
		configurationSet: "test-tenant-123",
		tenantName: "Test Tenant",
		triggeredAt: new Date(),
	});
}

// Redis key prefix for limit notification rate limiting
const LIMIT_NOTIFICATION_REDIS_PREFIX = "limit-notification:";
const LIMIT_NOTIFICATION_COOLDOWN_SECONDS = 24 * 60 * 60; // 24 hour cooldown

/**
 * Send Slack notification when a user hits their limit
 */
async function sendLimitReachedSlackNotification(
	data: LimitReachedNotificationData,
): Promise<void> {
	if (!SLACK_ADMIN_WEBHOOK_URL) {
		console.log(
			"⚠️ SLACK_ADMIN_WEBHOOK_URL not configured, skipping limit reached Slack notification",
		);
		return;
	}

	try {
		const limitName =
			data.limitType === "inbound_triggers"
				? "Inbound Email"
				: data.limitType === "emails_sent"
					? "Outbound Email"
					: "Domain";

		const slackMessage = {
			blocks: [
				{
					type: "header",
					text: {
						type: "plain_text",
						text: `⚠️ ${limitName} Limit Reached`,
						emoji: true,
					},
				},
				{
					type: "section",
					fields: [
						{
							type: "mrkdwn",
							text: `*User:*\n${data.userName || "Unknown"}`,
						},
						{
							type: "mrkdwn",
							text: `*Email:*\n${data.userEmail}`,
						},
						{
							type: "mrkdwn",
							text: `*User ID:*\n\`${data.userId}\``,
						},
						{
							type: "mrkdwn",
							text: `*Limit Type:*\n${limitName}`,
						},
						{
							type: "mrkdwn",
							text: `*Usage:*\n${data.currentUsage?.toLocaleString() ?? "N/A"} / ${data.limit?.toLocaleString() ?? "N/A"}`,
						},
						{
							type: "mrkdwn",
							text: `*Rejected:*\n${data.rejectedEmailCount ?? 1} email(s)`,
						},
					],
				},
				...(data.domain
					? [
							{
								type: "section" as const,
								text: {
									type: "mrkdwn" as const,
									text: `*Domain:* ${data.domain}`,
								},
							},
						]
					: []),
				{
					type: "context",
					elements: [
						{
							type: "mrkdwn",
							text: `Triggered at ${data.triggeredAt.toLocaleString()} • <https://inbound.new/admin|View Admin Dashboard>`,
						},
					],
				},
			],
		};

		const response = await fetch(SLACK_ADMIN_WEBHOOK_URL, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(slackMessage),
		});

		if (!response.ok) {
			console.error(
				`❌ Slack limit reached notification failed: ${response.status} ${response.statusText}`,
			);
		} else {
			console.log(
				`✅ Slack notification sent for limit reached: ${data.userEmail} (${data.limitType})`,
			);
		}
	} catch (error) {
		console.error("❌ Failed to send Slack limit reached notification:", error);
	}
}

/**
 * Send limit reached notification email to the user
 * Includes rate limiting to prevent spamming users (uses Redis for persistence)
 */
export async function sendLimitReachedNotification(
	data: LimitReachedNotificationData,
): Promise<{
	success: boolean;
	messageId?: string;
	error?: string;
	skipped?: boolean;
}> {
	try {
		const redisKey = `${LIMIT_NOTIFICATION_REDIS_PREFIX}${data.userId}:${data.limitType}`;

		// Check if we should skip due to rate limiting (using Redis for persistence across serverless invocations)
		try {
			const lastNotification = await redis.get<number>(redisKey);
			if (lastNotification) {
				const now = Date.now();
				const timeSinceLastMs = now - lastNotification;
				const cooldownMs = LIMIT_NOTIFICATION_COOLDOWN_SECONDS * 1000;

				if (timeSinceLastMs < cooldownMs) {
					const hoursRemaining = Math.ceil(
						(cooldownMs - timeSinceLastMs) / (60 * 60 * 1000),
					);
					console.log(
						`⏭️ sendLimitReachedNotification - Skipping notification for user ${data.userId} (${data.limitType}) - cooldown active, ~${hoursRemaining} hours remaining`,
					);
					return {
						success: true,
						skipped: true,
						error: `Notification skipped due to rate limiting (cooldown: ~${hoursRemaining} hours remaining)`,
					};
				}
			}
		} catch (redisError) {
			// If Redis fails, log but continue sending (better to occasionally double-send than never send)
			console.warn(
				"⚠️ sendLimitReachedNotification - Redis check failed, proceeding with notification:",
				redisError,
			);
		}

		console.log(
			`⚠️ sendLimitReachedNotification - Sending ${data.limitType} limit notification to ${data.userEmail}`,
		);

		// Validate required environment variable
		if (!process.env.INBOUND_API_KEY) {
			console.error(
				"❌ sendLimitReachedNotification - INBOUND_API_KEY not configured",
			);
			return {
				success: false,
				error: "Email service not configured",
			};
		}

		// Prepare email template props
		const templateProps = {
			userFirstname: data.userName?.split(" ")[0] || "User",
			limitType: data.limitType,
			currentUsage: data.currentUsage,
			limit: data.limit,
			rejectedEmailCount: data.rejectedEmailCount || 1,
			rejectedRecipient: data.rejectedRecipient,
			domain: data.domain,
			triggeredAt: data.triggeredAt.toLocaleString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
				timeZoneName: "short",
			}),
		};

		// Render the email template
		const html = await render(LimitReachedEmail(templateProps));

		// Create subject line based on limit type
		const limitName =
			data.limitType === "inbound_triggers"
				? "Inbound Email"
				: data.limitType === "emails_sent"
					? "Outbound Email"
					: "Domain";

		const subject = `⚠️ ${limitName} Limit Reached - Action Required`;

		// Determine the from address
		const fromEmail = "notifications@inbound.new";
		const fromWithName = `inbound alerts <${fromEmail}>`;

		// Send the email
		const response = await inbound.emails.send({
			from: fromWithName,
			to: data.userEmail,
			subject: subject,
			html: html,
			tags: [
				{ name: "type", value: "limit-reached" },
				{ name: "limit_type", value: data.limitType },
				{ name: "user_id", value: data.userId.replace(/[^a-zA-Z0-9_-]/g, "_") },
			],
		});

		// Update Redis to prevent future spam (set with TTL for automatic cleanup)
		try {
			await redis.set(redisKey, Date.now(), {
				ex: LIMIT_NOTIFICATION_COOLDOWN_SECONDS,
			});
		} catch (redisError) {
			console.warn(
				"⚠️ sendLimitReachedNotification - Failed to set Redis cooldown:",
				redisError,
			);
		}

		console.log(
			`✅ sendLimitReachedNotification - Alert email sent successfully to ${data.userEmail}`,
		);
		console.log(`   📧 Message ID: ${response.id}`);
		console.log(`   🏷️ Limit type: ${data.limitType}`);

		// Send Slack notification to admin channel (fire and forget, don't block on this)
		sendLimitReachedSlackNotification(data).catch((err) => {
			console.error(
				"❌ sendLimitReachedNotification - Slack notification error:",
				err,
			);
		});

		return {
			success: true,
			messageId: response.id,
		};
	} catch (error) {
		console.error("❌ sendLimitReachedNotification - Unexpected error:", error);
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error occurred",
		};
	}
}

/**
 * Send a test limit reached email (for testing purposes)
 */
export async function sendTestLimitReachedEmail(
	testEmail: string,
	limitType:
		| "inbound_triggers"
		| "emails_sent"
		| "domains" = "inbound_triggers",
): Promise<{
	success: boolean;
	messageId?: string;
	error?: string;
	skipped?: boolean;
}> {
	return sendLimitReachedNotification({
		userEmail: testEmail,
		userName: "Test User",
		userId: "test-user-123",
		limitType: limitType,
		currentUsage: 100,
		limit: 100,
		rejectedEmailCount: 1,
		rejectedRecipient: "test@example.com",
		domain: "example.com",
		triggeredAt: new Date(),
	});
}
