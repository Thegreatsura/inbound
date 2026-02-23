import type { InferSelectModel } from "drizzle-orm";
import type { blockedSignupDomains } from "@/lib/db/schema";

const domainRegex =
	/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

type BlockedSignupDomainRow = InferSelectModel<typeof blockedSignupDomains>;

export function normalizeDomain(domain: string): string {
	return domain.toLowerCase().trim();
}

export function isValidDomain(domain: string): boolean {
	return domainRegex.test(domain) && domain.length <= 253;
}

export function normalizeReason(reason?: string | null): string | null {
	if (reason === undefined || reason === null) {
		return null;
	}

	const normalizedReason = reason.trim();
	return normalizedReason.length > 0 ? normalizedReason : null;
}

export function isUniqueConstraintViolation(error: unknown): boolean {
	if (!error || typeof error !== "object") {
		return false;
	}

	const dbError = error as {
		code?: string;
		constraint?: string;
		message?: string;
	};

	return (
		dbError.code === "23505" ||
		dbError.constraint === "blocked_signup_domains_domain_unique" ||
		dbError.message?.includes("blocked_signup_domains_domain_unique") === true
	);
}

export function formatBlockedSignupDomain(row: BlockedSignupDomainRow) {
	return {
		id: row.id,
		domain: row.domain,
		reason: row.reason,
		isActive: row.isActive,
		blockedBy: row.blockedBy,
		createdAt: row.createdAt ? row.createdAt.toISOString() : null,
		updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
	};
}
