import { and, count, eq, gte, isNull, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import {
	emailAddresses,
	emailDomains,
	rateLimitOverrides,
	sentEmails,
	sesTenants,
} from "@/lib/db/schema";
import { getRootDomain, isSubdomain } from "@/lib/domains-and-dns/domain-utils";

type GuardReasonCode =
	| "user_not_found"
	| "user_banned"
	| "domain_not_verified"
	| "tenant_inactive"
	| "sender_address_disabled"
	| "hourly_send_limit_exceeded"
	| "guard_check_failed";

export interface OutboundSendGuardResult {
	allowed: boolean;
	statusCode: number;
	error?: string;
	reasonCode?: GuardReasonCode;
	resolvedDomain?: string;
}

interface OutboundSendGuardInput {
	userId: string;
	fromAddress: string;
	fromDomain: string;
	isAgentEmail: boolean;
}

const ONE_HOUR_IN_MS = 60 * 60 * 1000;
const DEFAULT_HOURLY_SEND_LIMIT = 500;
const parsedHourlyLimit = Number.parseInt(
	process.env.OUTBOUND_HOURLY_SEND_LIMIT || "",
	10,
);
const HOURLY_SEND_LIMIT =
	Number.isFinite(parsedHourlyLimit) && parsedHourlyLimit > 0
		? parsedHourlyLimit
		: DEFAULT_HOURLY_SEND_LIMIT;
const SLACK_ADMIN_WEBHOOK_URL = process.env.SLACK_ADMIN_WEBHOOK_URL;
const hourlyLimitAlertCache = new Set<string>();

function buildHourlyLimitCacheKey(userId: string, timestamp: Date): string {
	const hourBucket = Math.floor(timestamp.getTime() / ONE_HOUR_IN_MS);
	return `${userId}:${hourBucket}`;
}

function trimHourlyLimitAlertCache(maxEntries = 2000): void {
	if (hourlyLimitAlertCache.size <= maxEntries) {
		return;
	}

	const iterator = hourlyLimitAlertCache.values();
	const entriesToRemove = Math.max(1, hourlyLimitAlertCache.size - maxEntries);
	for (let index = 0; index < entriesToRemove; index++) {
		const next = iterator.next();
		if (next.done) {
			break;
		}
		hourlyLimitAlertCache.delete(next.value);
	}
}

async function sendHourlyLimitSlackAlert(params: {
	userId: string;
	userEmail: string | null;
	tenantId: string;
	sentLastHour: number;
	limit: number;
	windowStart: Date;
	windowEnd: Date;
}): Promise<void> {
	if (!SLACK_ADMIN_WEBHOOK_URL) {
		return;
	}

	const cacheKey = buildHourlyLimitCacheKey(params.userId, params.windowEnd);
	if (hourlyLimitAlertCache.has(cacheKey)) {
		return;
	}

	hourlyLimitAlertCache.add(cacheKey);
	trimHourlyLimitAlertCache();

	const message = {
		text: "Outbound hourly send limit reached",
		blocks: [
			{
				type: "header",
				text: {
					type: "plain_text",
					text: "Outbound hourly send limit reached",
				},
			},
			{
				type: "section",
				fields: [
					{
						type: "mrkdwn",
						text: `*User ID:*\n${params.userId}`,
					},
					{
						type: "mrkdwn",
						text: `*User Email:*\n${params.userEmail || "unknown"}`,
					},
					{
						type: "mrkdwn",
						text: `*Tenant ID:*\n${params.tenantId}`,
					},
					{
						type: "mrkdwn",
						text: `*Last 1h Sent:*\n${params.sentLastHour}`,
					},
					{
						type: "mrkdwn",
						text: `*Limit:*\n${params.limit}`,
					},
					{
						type: "mrkdwn",
						text: `*Window:*\n${params.windowStart.toISOString()} to ${params.windowEnd.toISOString()}`,
					},
				],
			},
		],
	};

	try {
		const response = await fetch(SLACK_ADMIN_WEBHOOK_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(message),
		});

		if (!response.ok) {
			console.error(
				"❌ Failed to send hourly send limit Slack alert:",
				response.status,
				response.statusText,
			);
		}
	} catch (error) {
		console.error("❌ Failed to send hourly send limit Slack alert:", error);
	}
}

function deny(
	statusCode: number,
	error: string,
	reasonCode: GuardReasonCode,
): OutboundSendGuardResult {
	return {
		allowed: false,
		statusCode,
		error,
		reasonCode,
	};
}

export async function enforceOutboundSendGuard(
	input: OutboundSendGuardInput,
): Promise<OutboundSendGuardResult> {
	const { userId, fromAddress, fromDomain, isAgentEmail } = input;

	try {
		const [userRecord] = await db
			.select({
				email: user.email,
				banned: user.banned,
				banReason: user.banReason,
				banExpires: user.banExpires,
			})
			.from(user)
			.where(eq(user.id, userId))
			.limit(1);

		if (!userRecord) {
			return deny(
				403,
				"You do not have permission to send email from this account.",
				"user_not_found",
			);
		}

		if (userRecord.banned) {
			const banExpiresAt = userRecord.banExpires
				? new Date(userRecord.banExpires)
				: null;
			const banStillActive = banExpiresAt
				? banExpiresAt.getTime() >= Date.now()
				: true;

			if (banStillActive) {
				return deny(
					403,
					`Account suspended${userRecord.banReason ? `: ${userRecord.banReason}` : ""}`,
					"user_banned",
				);
			}
		}

		const [userTenant] = await db
			.select({
				id: sesTenants.id,
				status: sesTenants.status,
			})
			.from(sesTenants)
			.where(eq(sesTenants.userId, userId))
			.limit(1);

		if (!userTenant || userTenant.status !== "active") {
			return deny(
				403,
				"Email sending is disabled for this account.",
				"tenant_inactive",
			);
		}

		const windowEnd = new Date();
		const windowStart = new Date(windowEnd.getTime() - ONE_HOUR_IN_MS);
		const [hourlyCountResult] = await db
			.select({
				total: count(),
			})
			.from(sentEmails)
			.where(
				and(
					eq(sentEmails.userId, userId),
					eq(sentEmails.status, "sent"),
					or(
						gte(sentEmails.sentAt, windowStart),
						and(
							isNull(sentEmails.sentAt),
							gte(sentEmails.createdAt, windowStart),
						),
					),
				),
			)
			.limit(1);

		const sentLastHour = Number(hourlyCountResult?.total || 0);

		const [override] = await db
			.select({
				hourlyLimit: rateLimitOverrides.hourlyLimit,
				expiresAt: rateLimitOverrides.expiresAt,
			})
			.from(rateLimitOverrides)
			.where(
				and(
					eq(rateLimitOverrides.userId, userId),
					eq(rateLimitOverrides.isActive, true),
				),
			)
			.limit(1);

		const isOverrideValid =
			override &&
			(!override.expiresAt || override.expiresAt.getTime() > Date.now());

		// null hourlyLimit = unlimited (no cap)
		const effectiveLimit = isOverrideValid
			? override.hourlyLimit
			: HOURLY_SEND_LIMIT;

		// effectiveLimit === null means unlimited — skip the check entirely
		if (effectiveLimit !== null && sentLastHour >= effectiveLimit) {
			await sendHourlyLimitSlackAlert({
				userId,
				userEmail: userRecord.email,
				tenantId: userTenant.id,
				sentLastHour,
				limit: effectiveLimit,
				windowStart,
				windowEnd,
			});

			return deny(
				429,
				`Hourly sending limit reached (${effectiveLimit} emails per hour). Please contact support to request a higher limit.`,
				"hourly_send_limit_exceeded",
			);
		}

		if (isAgentEmail) {
			return { allowed: true, statusCode: 200 };
		}

		let [verifiedDomain] = await db
			.select({
				id: emailDomains.id,
				domain: emailDomains.domain,
				tenantId: emailDomains.tenantId,
			})
			.from(emailDomains)
			.where(
				and(
					eq(emailDomains.userId, userId),
					eq(emailDomains.domain, fromDomain),
					eq(emailDomains.status, "verified"),
				),
			)
			.limit(1);

		if (!verifiedDomain && isSubdomain(fromDomain)) {
			const rootDomain = getRootDomain(fromDomain);
			if (rootDomain) {
				[verifiedDomain] = await db
					.select({
						id: emailDomains.id,
						domain: emailDomains.domain,
						tenantId: emailDomains.tenantId,
					})
					.from(emailDomains)
					.where(
						and(
							eq(emailDomains.userId, userId),
							eq(emailDomains.domain, rootDomain),
							eq(emailDomains.status, "verified"),
						),
					)
					.limit(1);
			}
		}

		if (!verifiedDomain) {
			return deny(
				403,
				`You don't have permission to send from domain: ${fromDomain}`,
				"domain_not_verified",
			);
		}

		if (verifiedDomain.tenantId && verifiedDomain.tenantId !== userTenant.id) {
			return deny(
				403,
				"Email sending is disabled for this account.",
				"tenant_inactive",
			);
		}

		const [senderAddressRecord] = await db
			.select({
				isActive: emailAddresses.isActive,
			})
			.from(emailAddresses)
			.where(
				and(
					eq(emailAddresses.userId, userId),
					eq(emailAddresses.address, fromAddress),
				),
			)
			.limit(1);

		if (senderAddressRecord && senderAddressRecord.isActive === false) {
			return deny(
				403,
				`Sender address is disabled: ${fromAddress}`,
				"sender_address_disabled",
			);
		}

		return {
			allowed: true,
			statusCode: 200,
			resolvedDomain: verifiedDomain.domain,
		};
	} catch (error) {
		console.error("❌ Outbound send guard check failed:", error);
		return deny(
			503,
			"Email sending is temporarily unavailable while security checks are running.",
			"guard_check_failed",
		);
	}
}
