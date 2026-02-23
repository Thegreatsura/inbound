import { readFile } from "node:fs/promises";

export type DraftEmailPayload = {
	from?: string;
	to?: string | string[];
	cc?: string | string[];
	bcc?: string | string[];
	reply_to?: string | string[];
	reply_to_id?: string;
	subject?: string;
	text?: string;
	html?: string;
	scheduled_at?: string;
	timezone?: string;
};

const SUPPORTED_HEADERS = new Set([
	"from",
	"to",
	"cc",
	"bcc",
	"reply-to",
	"replyto",
	"reply-to-id",
	"in-reply-to",
	"subject",
	"text",
	"html",
	"scheduled-at",
	"timezone",
	"content-type",
]);

const MULTI_VALUE_HEADERS = new Set(["to", "cc", "bcc", "reply-to"]);

export async function readInboundDraftFile(
	path: string,
): Promise<DraftEmailPayload> {
	try {
		const raw = await readFile(path, "utf8");
		return parseInboundDraft(raw, path);
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "ENOENT"
		) {
			throw new Error(`Draft file not found: ${path}`);
		}

		if (error instanceof Error) {
			throw new Error(`Failed to read draft file ${path}: ${error.message}`);
		}

		throw new Error(`Failed to read draft file ${path}`);
	}
}

export function parseInboundDraft(
	raw: string,
	source = "draft",
): DraftEmailPayload {
	const lines = raw.split(/\r?\n/);
	const headers: Record<string, string> = {};
	let bodyStart = lines.length;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === "") {
			bodyStart = i + 1;
			break;
		}

		const match = /^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/.exec(line);
		if (!match) {
			throw new Error(
				`Invalid draft header in ${source} at line ${i + 1}. Expected 'Key: value'.`,
			);
		}

		const key = normalizeHeaderName(match[1]);
		if (!SUPPORTED_HEADERS.has(key)) {
			throw new Error(`Unsupported draft header '${match[1]}' in ${source}.`);
		}

		const value = match[2]?.trim();
		if (!value) continue;

		if (MULTI_VALUE_HEADERS.has(key) && headers[key]) {
			headers[key] = `${headers[key]}, ${value}`;
			continue;
		}

		headers[key] = value;
	}

	const body = lines.slice(bodyStart).join("\n").trim();
	const payload: DraftEmailPayload = {
		from: headers.from,
		to: parseAddressHeader(headers.to),
		cc: parseAddressHeader(headers.cc),
		bcc: parseAddressHeader(headers.bcc),
		reply_to: parseAddressHeader(headers["reply-to"]),
		reply_to_id:
			headers.replyto || headers["reply-to-id"] || headers["in-reply-to"],
		subject: headers.subject,
		scheduled_at: headers["scheduled-at"],
		timezone: headers.timezone,
	};

	const contentType = (headers["content-type"] || "text/plain").toLowerCase();
	if (body) {
		if (contentType.includes("html")) {
			payload.html = body;
		} else {
			payload.text = body;
		}
	}

	if (headers.text) payload.text = headers.text;
	if (headers.html) payload.html = headers.html;

	return compactObject(payload);
}

export function validateSendPayload(payload: Record<string, unknown>): void {
	const missing: string[] = [];

	if (!hasNonEmptyString(payload.from)) {
		missing.push("from");
	}

	if (!hasRecipient(payload.to)) {
		missing.push("to");
	}

	if (!hasNonEmptyString(payload.subject)) {
		missing.push("subject");
	}

	if (missing.length > 0) {
		throw new Error(
			`Missing required send field(s): ${missing.join(", ")}. Include them in flags, --data, or your .inbound draft.`,
		);
	}
}

export function createInboundDraftTemplate(input?: {
	from?: string;
	replyToAddress?: string;
}): string {
	const from = input?.from?.trim() || "Support <support@inbound.new>";
	const replyToAddress = input?.replyToAddress?.trim() || "";

	return [
		`From: ${from}`,
		"To: recipient@example.com",
		"Cc: ",
		"Bcc: ",
		"ReplyTo: ",
		`Reply-To: ${replyToAddress}`,
		"Subject: Your subject here",
		"Scheduled-At: ",
		"Timezone: ",
		"Content-Type: text/plain",
		"",
		"Hello,",
		"",
		"Write your message here.",
	].join("\n");
}

function parseAddressHeader(
	value: string | undefined,
): string | string[] | undefined {
	if (!value) return undefined;

	const addresses = value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean);

	if (addresses.length === 0) return undefined;
	if (addresses.length === 1) return addresses[0];
	return addresses;
}

function normalizeHeaderName(header: string): string {
	return header.trim().toLowerCase().replaceAll("_", "-");
}

function hasNonEmptyString(value: unknown): boolean {
	return typeof value === "string" && value.trim().length > 0;
}

function hasRecipient(value: unknown): boolean {
	if (hasNonEmptyString(value)) return true;
	if (!Array.isArray(value)) return false;
	return value.some((item) => hasNonEmptyString(item));
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
	return Object.fromEntries(
		Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
	) as T;
}
