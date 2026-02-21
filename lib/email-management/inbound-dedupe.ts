import { createHash } from "crypto";

export function normalizeRecipientForDedupe(recipient: string): string {
	return recipient.trim().toLowerCase();
}

export function normalizeMessageIdForDedupe(
	messageId: string | null | undefined,
): string | null {
	if (!messageId) {
		return null;
	}

	const normalized = messageId.trim().toLowerCase().replace(/^<+|>+$/g, "");
	return normalized.length > 0 ? normalized : null;
}

export function buildInboundDeterministicId(
	prefix: string,
	sesEventId: string,
	recipient: string,
	normalizedMessageId?: string | null,
): string {
	const normalizedRecipient = normalizeRecipientForDedupe(recipient);
	const seed = normalizedMessageId
		? `msg:${normalizedMessageId}:rcpt:${normalizedRecipient}`
		: `ses:${sesEventId}:rcpt:${normalizedRecipient}`;

	const hash = createHash("sha256").update(seed).digest("hex").substring(0, 16);
	return `${prefix}_${hash}`;
}

export function buildInboundDedupeFingerprint(
	userId: string,
	recipient: string,
	normalizedMessageId: string | null,
): string {
	return `${userId}:${normalizeRecipientForDedupe(recipient)}:${normalizedMessageId || "no-message-id"}`;
}
