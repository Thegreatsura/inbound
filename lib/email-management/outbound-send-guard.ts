import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import { emailAddresses, emailDomains, sesTenants } from "@/lib/db/schema";
import { getRootDomain, isSubdomain } from "@/lib/domains-and-dns/domain-utils";

type GuardReasonCode =
	| "user_not_found"
	| "user_banned"
	| "domain_not_verified"
	| "tenant_inactive"
	| "sender_address_disabled"
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
			const banExpired = banExpiresAt ? banExpiresAt < new Date() : false;

			if (!banExpired) {
				return deny(
					403,
					`Account suspended${userRecord.banReason ? `: ${userRecord.banReason}` : ""}`,
					"user_banned",
				);
			}
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

		if (verifiedDomain.tenantId) {
			const [tenantRecord] = await db
				.select({
					status: sesTenants.status,
				})
				.from(sesTenants)
				.where(
					and(
						eq(sesTenants.id, verifiedDomain.tenantId),
						eq(sesTenants.userId, userId),
					),
				)
				.limit(1);

			if (!tenantRecord || tenantRecord.status !== "active") {
				return deny(
					403,
					"Email sending is disabled for this account.",
					"tenant_inactive",
				);
			}
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
