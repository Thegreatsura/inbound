type Row = Record<string, unknown>;

const ICON_UNREAD = "[*]";
const ICON_READ = "[ ]";
const ICON_UNKNOWN = "[-]";

const EMAIL_NAME_WIDTH = 44;

export function printOutput(data: unknown, asJson: boolean) {
	if (asJson) {
		console.log(JSON.stringify(data, null, 2));
		return;
	}

	if (typeof data === "string") {
		console.log(data);
		return;
	}

	if (Array.isArray(data)) {
		if (isArrayOfObjects(data)) {
			printCollection("data", data);
			return;
		}
		for (const item of data) {
			console.log(formatValue(item));
		}
		return;
	}

	if (isRecord(data)) {
		if (typeof data.message === "string") {
			console.log(data.message);
		}

		if (isEmailDetailObject(data)) {
			printEmailDetail(data);
			return;
		}

		const collectionKey = findCollectionKey(data);
		if (collectionKey) {
			const rows = data[collectionKey];
			let isEmailCollection = false;
			if (Array.isArray(rows) && isArrayOfObjects(rows)) {
				printCollection(collectionKey, rows);
				isEmailCollection =
					collectionKey === "data" && rows.some((row) => isEmailListRow(row));
			}

			const meta = { ...data };
			delete meta[collectionKey];
			delete meta.message;
			if (isEmailCollection) {
				printEmailLegend(meta);
				return;
			}
			printMetadata(meta);
			return;
		}

		printObject(data);
		return;
	}

	console.log(String(data));
}

function findCollectionKey(data: Record<string, unknown>): string | null {
	for (const key of ["data", "threads", "mailboxes", "matches", "messages"]) {
		if (Array.isArray(data[key])) {
			return key;
		}
	}
	return null;
}

function printCollection(collectionKey: string, rows: Row[]) {
	if (rows.length === 0) {
		console.log("No results.");
		return;
	}

	if (collectionKey === "data" && rows.some(isEmailListRow)) {
		printEmailRows(rows);
		return;
	}

	if (collectionKey === "threads" && rows.some(isThreadListRow)) {
		printThreadRows(rows);
		return;
	}

	if (
		(collectionKey === "mailboxes" || collectionKey === "matches") &&
		rows.some(isMailboxRow)
	) {
		printMailboxRows(rows);
		return;
	}

	if (collectionKey === "messages" && rows.some(isThreadMessageRow)) {
		printThreadMessageRows(rows);
		return;
	}

	printGenericRows(rows);
}

function printEmailDetail(email: Row) {
	const id = valueAsString(email.id) || "-";
	const subject = valueAsString(email.subject) || "(no subject)";
	const from = valueAsString(email.from) || "unknown";
	const to = valueAsStringArray(email.to);
	const cc = valueAsStringArray(email.cc);
	const bcc = valueAsStringArray(email.bcc);
	const replyTo = valueAsStringArray(email.reply_to);
	const type = valueAsString(email.type);
	const status = valueAsString(email.status);
	const createdAt = valueAsString(email.created_at);
	const sentAt = valueAsString(email.sent_at);
	const scheduledAt = valueAsString(email.scheduled_at);
	const threadId = valueAsString(email.thread_id);
	const threadPosition = valueAsNumber(email.thread_position);
	const isRead = valueAsBoolean(email.is_read);
	const readIcon =
		isRead === undefined ? ICON_UNKNOWN : isRead ? ICON_READ : ICON_UNREAD;

	console.log(`${readIcon} ${subject}`);
	console.log(`ID: ${id}`);

	const metaParts: string[] = [];
	if (type) metaParts.push(`type=${type}`);
	if (status) metaParts.push(`status=${status}`);
	if (isRead !== undefined) metaParts.push(`read=${isRead ? "yes" : "no"}`);
	if (metaParts.length > 0) {
		console.log(`Meta: ${metaParts.join(" | ")}`);
	}

	console.log(`From: ${from}`);
	if (to.length > 0) console.log(`To: ${to.join(", ")}`);
	if (cc.length > 0) console.log(`Cc: ${cc.join(", ")}`);
	if (bcc.length > 0) console.log(`Bcc: ${bcc.join(", ")}`);
	if (replyTo.length > 0) console.log(`Reply-To: ${replyTo.join(", ")}`);

	const timeParts: string[] = [];
	if (createdAt) timeParts.push(`created=${createdAt}`);
	if (sentAt) timeParts.push(`sent=${sentAt}`);
	if (scheduledAt) timeParts.push(`scheduled=${scheduledAt}`);
	if (timeParts.length > 0) {
		console.log(`Time: ${timeParts.join(" | ")}`);
	}

	if (threadId) {
		const threadText =
			typeof threadPosition === "number"
				? `${threadId} (position ${threadPosition})`
				: threadId;
		console.log(`Thread: ${threadText}`);
	}

	const attachments = attachmentSummaries(email.attachments);
	if (attachments.length > 0) {
		console.log(`Attachments: ${attachments.length}`);
		for (const attachment of attachments) {
			console.log(`  - ${attachment}`);
		}
	} else if (valueAsBoolean(email.has_attachments) === true) {
		console.log("Attachments: yes");
	}

	const textBody = normalizeBody(valueAsString(email.text));
	const htmlBody = normalizeBody(valueAsString(email.html));
	const body = textBody || (htmlBody ? htmlToText(htmlBody) : "");

	if (body) {
		console.log("");
		console.log("Body:");
		printBody(body);
	}

	const hasHeaders = isRecord(email.headers) || Array.isArray(email.headers);
	const hasTags = Array.isArray(email.tags) && email.tags.length > 0;
	if (hasHeaders || hasTags) {
		console.log("");
		console.log("Tip: use --json to view full headers/tags/raw payload.");
	}
}

function printEmailRows(rows: Row[]) {
	for (const row of rows) {
		const id = valueAsString(row.id) || "-";
		const from = valueAsString(row.from) || "unknown";
		const fromName = valueAsString(row.from_name);
		const subject = valueAsString(row.subject) || "(no subject)";

		const name = fromName ? `${fromName} <${from}>` : from;
		const icon = emailReadIcon(row);
		const nameCol = fixedWidth(name, EMAIL_NAME_WIDTH);

		console.log(`${icon} ${id}  ${nameCol}  ${truncate(subject, 72)}`);
	}
}

function printThreadRows(rows: Row[]) {
	for (const row of rows) {
		const id = valueAsString(row.id) || "-";
		const subject =
			valueAsString(row.normalized_subject) ||
			valueAsString(getNested(row, "latest_message", "subject")) ||
			"(no subject)";
		const count = valueAsNumber(row.message_count);
		const unreadCount = valueAsNumber(row.unread_count);
		const hasUnread = valueAsBoolean(row.has_unread);
		const icon =
			hasUnread === undefined
				? ICON_UNKNOWN
				: hasUnread
					? ICON_UNREAD
					: ICON_READ;

		const countText =
			typeof count === "number"
				? unreadCount && unreadCount > 0
					? `(${count} msgs, ${unreadCount} unread)`
					: `(${count} msgs)`
				: "";

		console.log(`${icon} ${id}  ${truncate(subject, 72)} ${countText}`.trim());
	}
}

function printMailboxRows(rows: Row[]) {
	for (const row of rows) {
		const key = valueAsString(row.key) || "-";
		const name = valueAsString(row.name) || "Mailbox";
		const email = valueAsString(row.email) || "";
		const isDefault = valueAsBoolean(row.is_default) === true;
		const marker = isDefault ? "*" : "-";

		const headline = email ? `${name} <${email}>` : name;
		console.log(`${marker} ${key}  ${headline}`);
	}
}

function printThreadMessageRows(rows: Row[]) {
	for (const row of rows) {
		const id = valueAsString(row.id) || "-";
		const kind = valueAsString(row.type) || "message";
		const from =
			valueAsString(row.from) || valueAsString(row.from_address) || "unknown";
		const subject = valueAsString(row.subject) || "(no subject)";
		const isRead = valueAsBoolean(row.is_read);
		const icon =
			isRead === undefined ? ICON_UNKNOWN : isRead ? ICON_READ : ICON_UNREAD;
		console.log(
			`${icon} ${id}  ${kind}  ${truncate(from, 36)}  ${truncate(subject, 56)}`,
		);
	}
}

function printGenericRows(rows: Row[]) {
	const columns = inferGenericColumns(rows).slice(0, 5);

	for (const row of rows) {
		const fields = columns
			.map((column) => {
				const value = formatValue(row[column]);
				if (!value) return null;
				return `${column}=${truncate(value, 40)}`;
			})
			.filter(Boolean);

		if (fields.length === 0) {
			console.log("- (item)");
			continue;
		}

		console.log(`- ${fields.join("  ")}`);
	}
}

function printMetadata(meta: Record<string, unknown>) {
	const entries = Object.entries(meta).filter(
		([, value]) => value !== undefined && value !== null,
	);
	if (entries.length === 0) return;

	for (const [key, value] of entries) {
		if (isRecord(value) || Array.isArray(value)) {
			console.log(`${key}: ${JSON.stringify(value)}`);
		} else {
			console.log(`${key}: ${formatValue(value)}`);
		}
	}
}

function printEmailLegend(meta: Record<string, unknown>) {
	const pagination = isRecord(meta.pagination) ? meta.pagination : {};
	const filters = isRecord(meta.filters) ? meta.filters : {};

	const total = valueAsNumber(pagination.total);
	const limit = valueAsNumber(pagination.limit);
	const offset = valueAsNumber(pagination.offset);
	const hasMore = valueAsBoolean(pagination.has_more);

	const type = valueAsString(filters.type) || "received";
	const status = valueAsString(filters.status);
	const search = valueAsString(filters.search);
	const mailbox = valueAsString(filters.mailbox);
	const timeRange = valueAsString(filters.time_range);
	const addresses = valueAsStringArray(filters.addresses);
	const domains = valueAsStringArray(filters.domains);

	console.log("");
	console.log(
		`Legend: ${ICON_UNREAD} unread  ${ICON_READ} read  ${ICON_UNKNOWN} unknown`,
	);

	const paginationParts: string[] = [];
	if (typeof total === "number") paginationParts.push(`total=${total}`);
	if (typeof limit === "number") paginationParts.push(`limit=${limit}`);
	if (typeof offset === "number") paginationParts.push(`offset=${offset}`);
	if (typeof hasMore === "boolean") paginationParts.push(`has_more=${hasMore}`);
	if (paginationParts.length > 0) {
		console.log(`Pagination: ${paginationParts.join(" | ")}`);
	}

	const filterParts: string[] = [`type=${type}`];
	if (status) filterParts.push(`status=${status}`);
	if (timeRange) filterParts.push(`time_range=${timeRange}`);
	if (search) filterParts.push(`search=${search}`);
	if (mailbox) filterParts.push(`mailbox=${mailbox}`);
	if (addresses.length > 0)
		filterParts.push(`addresses=${addresses.join(",")}`);
	if (domains.length > 0) filterParts.push(`domains=${domains.join(",")}`);
	console.log(`Filters: ${filterParts.join(" | ")}`);

	if (type === "received") {
		console.log(
			"Tip: add --type sent|scheduled|all to include non-received emails.",
		);
	}
}

function printObject(data: Record<string, unknown>) {
	const primitiveEntries = Object.entries(data).filter(
		([, value]) => !isRecord(value) && !Array.isArray(value),
	);
	for (const [key, value] of primitiveEntries) {
		console.log(`${key}: ${formatValue(value)}`);
	}

	const complexEntries = Object.entries(data).filter(
		([, value]) => isRecord(value) || Array.isArray(value),
	);
	if (complexEntries.length > 0) {
		console.log(JSON.stringify(Object.fromEntries(complexEntries), null, 2));
	}
}

function isEmailDetailObject(value: Row): boolean {
	return (
		value.object === "email" &&
		typeof value.id === "string" &&
		typeof value.from === "string" &&
		typeof value.subject === "string" &&
		Array.isArray(value.to)
	);
}

function attachmentSummaries(value: unknown): string[] {
	if (!Array.isArray(value)) return [];

	const summaries: string[] = [];
	for (const item of value) {
		if (!isRecord(item)) continue;
		const filename = valueAsString(item.filename) || "attachment";
		const contentType =
			valueAsString(item.contentType) || valueAsString(item.content_type);
		const size = valueAsNumber(item.size);

		const details: string[] = [];
		if (typeof size === "number") details.push(`${size} bytes`);
		if (contentType) details.push(contentType);

		summaries.push(
			details.length > 0 ? `${filename} (${details.join(", ")})` : filename,
		);
	}

	return summaries;
}

function inferGenericColumns(rows: Row[]): string[] {
	const keys = new Set<string>();
	for (const row of rows.slice(0, 25)) {
		for (const [key, value] of Object.entries(row)) {
			if (
				typeof value === "string" ||
				typeof value === "number" ||
				typeof value === "boolean"
			) {
				keys.add(key);
			}
		}
	}

	const preferred = [
		"id",
		"name",
		"email",
		"subject",
		"status",
		"type",
		"created_at",
	];
	const sorted = preferred.filter((key) => keys.has(key));

	for (const key of keys) {
		if (!sorted.includes(key)) sorted.push(key);
	}

	return sorted;
}

function emailReadIcon(row: Row): string {
	const isRead = valueAsBoolean(row.is_read);
	if (isRead !== undefined) {
		return isRead ? ICON_READ : ICON_UNREAD;
	}

	const status = valueAsString(row.status)?.toLowerCase();
	if (status === "unread") return ICON_UNREAD;
	if (status === "read") return ICON_READ;

	return ICON_UNKNOWN;
}

function isEmailListRow(row: Row): boolean {
	return (
		typeof row.id === "string" &&
		typeof row.from === "string" &&
		typeof row.subject === "string"
	);
}

function isThreadListRow(row: Row): boolean {
	return typeof row.id === "string" && row.message_count !== undefined;
}

function isMailboxRow(row: Row): boolean {
	return typeof row.key === "string" && typeof row.name === "string";
}

function isThreadMessageRow(row: Row): boolean {
	return typeof row.id === "string" && typeof row.type === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArrayOfObjects(value: unknown[]): value is Row[] {
	return value.every((item) => isRecord(item));
}

function valueAsString(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function valueAsNumber(value: unknown): number | undefined {
	return typeof value === "number" ? value : undefined;
}

function valueAsBoolean(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}

function valueAsStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => (typeof item === "string" ? item : null))
		.filter((item): item is string => item !== null);
}

function normalizeBody(value: string | undefined): string {
	if (!value) return "";
	return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

function htmlToText(html: string): string {
	const withoutScript = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
	const withoutStyle = withoutScript.replace(
		/<style[^>]*>[\s\S]*?<\/style>/gi,
		"",
	);
	const withLineBreaks = withoutStyle
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<\/p>/gi, "\n")
		.replace(/<\/div>/gi, "\n")
		.replace(/<\/li>/gi, "\n")
		.replace(/<li>/gi, "- ");
	const stripped = withLineBreaks.replace(/<[^>]+>/g, "");
	const decoded = stripped
		.replace(/&nbsp;/gi, " ")
		.replace(/&amp;/gi, "&")
		.replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">")
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'");

	return decoded
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function printBody(body: string) {
	const maxChars = 12000;
	if (body.length <= maxChars) {
		console.log(body);
		return;
	}

	console.log(body.slice(0, maxChars));
	console.log("");
	console.log(
		`[body truncated: showing ${maxChars} of ${body.length} chars; use --json for full payload]`,
	);
}

function truncate(value: string, max: number): string {
	if (value.length <= max) return value;
	if (max <= 3) return value.slice(0, max);
	return `${value.slice(0, max - 3)}...`;
}

function fixedWidth(value: string, width: number): string {
	return truncate(value, width).padEnd(width, " ");
}

function formatValue(value: unknown): string {
	if (value === null || value === undefined) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean")
		return String(value);
	if (Array.isArray(value)) {
		const stringable = value.every(
			(item) =>
				typeof item === "string" ||
				typeof item === "number" ||
				typeof item === "boolean" ||
				item === null,
		);
		if (stringable) {
			return value.map((item) => String(item ?? "")).join(", ");
		}
		return `[${value.length} items]`;
	}
	return "[object]";
}

function getNested(row: Row, first: string, second: string): unknown {
	const nested = row[first];
	if (!isRecord(nested)) return undefined;
	return nested[second];
}
