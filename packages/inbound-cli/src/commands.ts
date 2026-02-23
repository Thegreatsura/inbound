import { writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { rawE2BinaryRequest, rawE2Request } from "./client/e2-client";
import {
	ensureConfigPath,
	findMailboxes,
	type MailboxConfig,
	saveConfig,
} from "./config/inbound-config";
import {
	getOptionBoolean,
	getOptionString,
	getOptionStrings,
	type ParsedArgv,
} from "./lib/argv";
import {
	defaultAttachmentPath,
	parseBooleanString,
	parseListStrings,
	parseNumberOption,
	parseQueryCommon,
	readBodyInput,
	requirePositional,
	writeDownloadedFile,
} from "./lib/command-utils";
import {
	createInboundDraftTemplate,
	readInboundDraftFile,
	validateSendPayload,
} from "./lib/draft";
import {
	buildFanoutQueries,
	dedupeById,
	resolveMailboxFilters,
} from "./mailbox/resolve";
import type { CliContext } from "./types";

export async function runMailboxCommand(ctx: CliContext): Promise<unknown> {
	const [, action, keyArg] = ctx.parsed.positionals;
	const configPath = ensureConfigPath(
		ctx.configPath || ctx.globals.configPath || null,
	);

	if (action === "init") {
		const force = getOptionBoolean(ctx.parsed, "force");
		if (ctx.configPath && !force) {
			throw new Error(
				`Config already exists at ${ctx.configPath}. Use --force to overwrite.`,
			);
		}
		await saveConfig(configPath, ctx.config);
		return { message: `Wrote ${configPath}` };
	}

	if (action === "list") {
		const mailboxes = Object.entries(ctx.config.mailbox?.mailboxes || {}).map(
			([key, mailbox]) => ({
				key,
				name: mailbox.name,
				email: mailbox.email,
				addresses: mailbox.addresses,
				domains: mailbox.domains,
				is_default: ctx.config.mailbox?.default === key,
			}),
		);
		return {
			mailboxes,
			default: ctx.config.mailbox?.default || null,
			config_path: configPath,
		};
	}

	if (action === "show") {
		return {
			config_path: configPath,
			config: ctx.config,
		};
	}

	if (action === "add") {
		const key = requirePositional(keyArg, "mailbox key");
		const name = getOptionString(ctx.parsed, "name");
		const email = getOptionString(ctx.parsed, "email");
		if (!name || !email) {
			throw new Error("mailbox add requires --name and --email");
		}

		const addresses = parseListStrings(ctx.parsed, "address");
		const domains = parseListStrings(ctx.parsed, "domain");

		const mailbox: MailboxConfig = {
			name,
			email,
			addresses: addresses.length > 0 ? addresses : [email],
			domains,
		};

		ctx.config.mailbox = ctx.config.mailbox || { mailboxes: {} };
		ctx.config.mailbox.mailboxes[key] = mailbox;
		if (!ctx.config.mailbox.default) {
			ctx.config.mailbox.default = key;
		}

		await saveConfig(configPath, ctx.config);
		return {
			message: `Added mailbox '${key}'`,
			mailbox,
			config_path: configPath,
		};
	}

	if (action === "use") {
		const key = requirePositional(keyArg, "mailbox key");
		const mailbox = ctx.config.mailbox?.mailboxes?.[key];
		if (!mailbox) {
			throw new Error(`Unknown mailbox '${key}'`);
		}

		ctx.config.mailbox = ctx.config.mailbox || { mailboxes: {} };
		ctx.config.mailbox.default = key;
		await saveConfig(configPath, ctx.config);
		return {
			message: `Default mailbox set to '${key}'`,
			config_path: configPath,
		};
	}

	if (action === "remove") {
		const key = requirePositional(keyArg, "mailbox key");
		if (!ctx.config.mailbox?.mailboxes?.[key]) {
			throw new Error(`Unknown mailbox '${key}'`);
		}

		delete ctx.config.mailbox.mailboxes[key];
		if (ctx.config.mailbox.default === key) {
			const next = Object.keys(ctx.config.mailbox.mailboxes)[0];
			ctx.config.mailbox.default = next;
		}

		await saveConfig(configPath, ctx.config);
		return {
			message: `Removed mailbox '${key}'`,
			default: ctx.config.mailbox.default || null,
		};
	}

	if (action === "find") {
		const addresses = parseListStrings(ctx.parsed, "address");
		const domains = parseListStrings(ctx.parsed, "domain");
		if (addresses.length === 0 && domains.length === 0) {
			throw new Error(
				"mailbox find requires at least one --address or --domain flag",
			);
		}

		const matches = findMailboxes(ctx.config, addresses, domains).map(
			({ key, mailbox }) => ({
				key,
				name: mailbox.name,
				email: mailbox.email,
				addresses: mailbox.addresses,
				domains: mailbox.domains,
			}),
		);

		return {
			matches,
			query: { addresses, domains },
		};
	}

	throw new Error(
		"Unknown mailbox command. Use: init|list|add|use|remove|show|find",
	);
}

export async function runDraftCommand(ctx: CliContext): Promise<unknown> {
	const [, action, maybePath] = ctx.parsed.positionals;

	if (action !== "init") {
		throw new Error("Unknown draft command. Use: init");
	}

	const draftPath = resolve(
		getOptionString(ctx.parsed, "path", "out") || maybePath || "draft.inbound",
	);
	const force = getOptionBoolean(ctx.parsed, "force");
	const mailbox = resolveActiveMailbox(ctx);
	const defaultFrom = mailbox?.email
		? formatAddressWithName(mailbox.email, mailbox.name)
		: undefined;

	try {
		await writeFile(
			draftPath,
			createInboundDraftTemplate({
				from: defaultFrom,
			}),
			{
				encoding: "utf8",
				flag: force ? "w" : "wx",
			},
		);
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"code" in error &&
			error.code === "EEXIST"
		) {
			throw new Error(
				`Draft already exists at ${draftPath}. Use --force to overwrite.`,
			);
		}

		if (error instanceof Error) {
			throw new Error(
				`Failed to write draft file ${draftPath}: ${error.message}`,
			);
		}

		throw new Error(`Failed to write draft file ${draftPath}`);
	}

	return {
		message: `Created draft template at ${draftPath}`,
		path: draftPath,
		next: `inbound send ${draftPath}`,
	};
}

function resolveActiveMailbox(ctx: CliContext): MailboxConfig | null {
	const mailboxKey = ctx.globals.mailbox || ctx.config.mailbox?.default;
	if (!mailboxKey) return null;

	const mailbox = ctx.config.mailbox?.mailboxes?.[mailboxKey];
	return mailbox || null;
}

function parseEmailWithOptionalName(
	value: string,
): { email: string; name?: string } | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	const match = /^(.*?)\s*<([^>]+)>$/.exec(trimmed);
	if (match) {
		const name = match[1].trim().replace(/^['"]|['"]$/g, "");
		const email = match[2].trim();
		if (!email) return null;
		return name ? { email, name } : { email };
	}

	return { email: trimmed };
}

function formatAddressWithName(email: string, name?: string): string {
	if (!name || !name.trim()) return email;

	const normalizedName = name.trim();
	const escapedName = normalizedName.replaceAll('"', '\\"');
	const needsQuotes = /[,<>()[\]:;@\\"]/.test(normalizedName);
	if (needsQuotes) {
		return `"${escapedName}" <${email}>`;
	}

	return `${normalizedName} <${email}>`;
}

function applyMailboxSenderDefaults(
	ctx: CliContext,
	body: Record<string, unknown>,
): Record<string, unknown> {
	const mailbox = resolveActiveMailbox(ctx);
	if (!mailbox?.email) return body;

	const preferredFrom = formatAddressWithName(mailbox.email, mailbox.name);
	const fromValue = typeof body.from === "string" ? body.from.trim() : "";

	if (!fromValue) {
		return {
			...body,
			from: preferredFrom,
		};
	}

	const parsedFrom = parseEmailWithOptionalName(fromValue);
	if (!parsedFrom || parsedFrom.name) return body;

	if (parsedFrom.email.toLowerCase() !== mailbox.email.toLowerCase()) {
		return body;
	}

	return {
		...body,
		from: preferredFrom,
	};
}

function getReplyTargetId(body: Record<string, unknown>): string | undefined {
	const value = body.reply_to_id;
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed || undefined;
}

function validateReplyModeFields(body: Record<string, unknown>): void {
	const unsupported = ["cc", "bcc", "scheduled_at", "timezone"];
	const present = unsupported.filter((field) => body[field] !== undefined);
	if (present.length > 0) {
		throw new Error(
			`These fields are not supported when ReplyTo targets an inbound email id: ${present.join(", ")}`,
		);
	}
}

function validateReplyPayload(payload: Record<string, unknown>): void {
	const missing: string[] = [];
	if (typeof payload.from !== "string" || payload.from.trim().length === 0) {
		missing.push("from");
	}

	const hasHtml =
		typeof payload.html === "string" && payload.html.trim().length > 0;
	const hasText =
		typeof payload.text === "string" && payload.text.trim().length > 0;
	if (!hasHtml && !hasText) {
		missing.push("text/html");
	}

	if (missing.length > 0) {
		throw new Error(
			`Missing required reply field(s): ${missing.join(", ")}. Include them in flags, --data, or your .inbound draft.`,
		);
	}
}

function requireApiContext(ctx: CliContext): {
	apiKey: string;
	baseUrl: string;
} {
	if (!ctx.globals.apiKey) {
		throw new Error("Missing API key. Pass --api-key or set INBOUND_API_KEY.");
	}
	return {
		apiKey: ctx.globals.apiKey,
		baseUrl: ctx.globals.baseUrl,
	};
}

function readCommonFilterQuery(parsed: ParsedArgv) {
	const query = parseQueryCommon(parsed);
	const status = getOptionString(parsed, "status");
	const type = getOptionString(parsed, "type");
	const timeRange = getOptionString(parsed, "time-range", "time_range");
	if (status) query.status = status;
	if (type) query.type = type;
	if (timeRange) query.time_range = timeRange;
	return query;
}

function parseAddressOption(
	parsed: ParsedArgv,
	...names: string[]
): string | string[] | undefined {
	const addresses = getOptionStrings(parsed, ...names)
		.flatMap((value) => value.split(","))
		.map((value) => value.trim())
		.filter(Boolean);

	if (addresses.length === 0) return undefined;
	if (addresses.length === 1) return addresses[0];
	return addresses;
}

function buildEmailSendFallback(parsed: ParsedArgv): Record<string, unknown> {
	return withDefinedValues({
		from: getOptionString(parsed, "from"),
		to: parseAddressOption(parsed, "to"),
		cc: parseAddressOption(parsed, "cc"),
		bcc: parseAddressOption(parsed, "bcc"),
		reply_to: parseAddressOption(parsed, "reply_to", "reply-to", "replyTo"),
		reply_to_id: getOptionString(
			parsed,
			"reply_to_id",
			"reply-to-id",
			"replyToId",
		),
		subject: getOptionString(parsed, "subject"),
		html: getOptionString(parsed, "html"),
		text: getOptionString(parsed, "text"),
		scheduled_at: getOptionString(
			parsed,
			"scheduled_at",
			"scheduled-at",
			"scheduledAt",
		),
		timezone: getOptionString(parsed, "timezone"),
	});
}

function withDefinedValues(
	value: Record<string, unknown>,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
	);
}

export async function runApiCommand(ctx: CliContext): Promise<unknown> {
	const api = requireApiContext(ctx);
	const [group, action, maybeThird] = ctx.parsed.positionals;
	const sdk = ctx.sdk;

	if (!sdk) {
		throw new Error("Internal error: SDK client unavailable");
	}

	if (group === "domains") {
		if (action === "list") {
			const query = parseQueryCommon(ctx.parsed);
			const status = getOptionString(ctx.parsed, "status");
			const canReceive = parseBooleanString(ctx.parsed, "canReceive");
			const check = parseBooleanString(ctx.parsed, "check");
			if (status) query.status = status;
			if (canReceive) query.canReceive = canReceive;
			if (check) query.check = check;
			return sdk.domains.list(query);
		}
		if (action === "get") {
			const id = requirePositional(maybeThird, "domain id");
			const check = parseBooleanString(ctx.parsed, "check");
			return sdk.domains.retrieve(id, check ? { check: "true" } : {});
		}
		if (action === "create") {
			const body = await readBodyInput(ctx.parsed, {
				domain: getOptionString(ctx.parsed, "domain"),
			});
			return sdk.domains.create(body as { domain: string });
		}
		if (action === "update") {
			const id = requirePositional(maybeThird, "domain id");
			const fallback: Record<string, unknown> = {};
			const isCatchAllEnabled = parseBooleanString(
				ctx.parsed,
				"isCatchAllEnabled",
			);
			if (isCatchAllEnabled) {
				fallback.isCatchAllEnabled = isCatchAllEnabled === "true";
			}
			const catchAllEndpointId = getOptionString(
				ctx.parsed,
				"catchAllEndpointId",
			);
			if (catchAllEndpointId) {
				fallback.catchAllEndpointId = catchAllEndpointId;
			}
			const body = await readBodyInput(ctx.parsed, fallback);
			return sdk.domains.update(
				id,
				body as { isCatchAllEnabled: boolean; catchAllEndpointId?: string },
			);
		}
		if (action === "delete") {
			const id = requirePositional(maybeThird, "domain id");
			return sdk.domains.delete(id);
		}
	}

	if (group === "addresses" || group === "email-addresses") {
		if (action === "list") {
			const query = parseQueryCommon(ctx.parsed);
			const domainId = getOptionString(ctx.parsed, "domainId");
			const isActive = parseBooleanString(ctx.parsed, "isActive");
			const isReceiptRuleConfigured = parseBooleanString(
				ctx.parsed,
				"isReceiptRuleConfigured",
			);
			if (domainId) query.domainId = domainId;
			if (isActive) query.isActive = isActive;
			if (isReceiptRuleConfigured)
				query.isReceiptRuleConfigured = isReceiptRuleConfigured;
			return sdk.emailAddresses.list(query);
		}
		if (action === "get") {
			const id = requirePositional(maybeThird, "address id");
			return sdk.emailAddresses.retrieve(id);
		}
		if (action === "create") {
			const body = await readBodyInput(ctx.parsed, {
				address: getOptionString(ctx.parsed, "address"),
				domainId: getOptionString(ctx.parsed, "domainId"),
				endpointId: getOptionString(ctx.parsed, "endpointId"),
				webhookId: getOptionString(ctx.parsed, "webhookId"),
			});
			return sdk.emailAddresses.create(
				body as { address: string; domainId: string },
			);
		}
		if (action === "update") {
			const id = requirePositional(maybeThird, "address id");
			const body = await readBodyInput(ctx.parsed, {
				endpointId: getOptionString(ctx.parsed, "endpointId"),
				webhookId: getOptionString(ctx.parsed, "webhookId"),
			});
			return sdk.emailAddresses.update(id, body);
		}
		if (action === "delete") {
			const id = requirePositional(maybeThird, "address id");
			return sdk.emailAddresses.delete(id);
		}
	}

	if (group === "emails") {
		if (action === "list") {
			const baseQuery = readCommonFilterQuery(ctx.parsed);
			if (!baseQuery.type) {
				baseQuery.type = "received";
			}
			const unread = parseBooleanString(ctx.parsed, "unread");
			if (unread) baseQuery.unread = unread;

			const mailboxFilters = resolveMailboxFilters({
				config: ctx.config,
				selectedMailbox: ctx.globals.mailbox,
				addressOverrides: ctx.globals.addresses,
				domainOverrides: ctx.globals.domains,
				mergeFilters: ctx.globals.mergeFilters,
			});

			const queries = buildFanoutQueries(mailboxFilters);
			const results = await Promise.all(
				queries.map((filters) =>
					sdk.emails.list({
						...baseQuery,
						address: filters.address,
						domain: filters.domain,
					}),
				),
			);

			if (results.length === 1) {
				const single = results[0];
				return {
					data: single.data || [],
					pagination: single.pagination || {
						limit: Number(baseQuery.limit || single.data?.length || 0),
						offset: Number(baseQuery.offset || 0),
						total: single.data?.length || 0,
						has_more: false,
					},
					filters: {
						...(single.filters || {}),
						mailbox: mailboxFilters.mailboxName,
						addresses: mailboxFilters.addresses,
						domains: mailboxFilters.domains,
					},
				};
			}

			const merged = dedupeById(results.flatMap((result) => result.data || []));
			const aggregatedTotal = results.reduce(
				(sum, result) => sum + asNumber(result.pagination?.total),
				0,
			);
			const aggregatedHasMore = results.some(
				(result) => result.pagination?.has_more === true,
			);
			const fallbackLimit = asNumber(results[0]?.pagination?.limit);
			const fallbackOffset = asNumber(results[0]?.pagination?.offset);
			return {
				data: merged,
				pagination: {
					limit: Number(baseQuery.limit || fallbackLimit || merged.length),
					offset: Number(baseQuery.offset || fallbackOffset || 0),
					total: Math.max(aggregatedTotal, merged.length),
					has_more: aggregatedHasMore,
				},
				filters: {
					...baseQuery,
					mailbox: mailboxFilters.mailboxName,
					addresses: mailboxFilters.addresses,
					domains: mailboxFilters.domains,
				},
			};
		}
		if (action === "get") {
			const id = requirePositional(maybeThird, "email id");
			return sdk.emails.retrieve(id);
		}
		if (action === "send") {
			const draftPath =
				getOptionString(ctx.parsed, "draft", "draft-file", "draftFile") ||
				maybeThird;

			const draftBody = draftPath ? await readInboundDraftFile(draftPath) : {};

			const inputBody = await readBodyInput(ctx.parsed, {
				...draftBody,
				...buildEmailSendFallback(ctx.parsed),
			});
			const body = applyMailboxSenderDefaults(ctx, inputBody);
			const replyTargetId = getReplyTargetId(body);

			if (replyTargetId) {
				validateReplyModeFields(body);
				const replyBody = withDefinedValues({
					from: body.from,
					to: body.to,
					subject: body.subject,
					html: body.html,
					text: body.text,
					headers: body.headers,
					attachments: body.attachments,
					reply_all: body.reply_all,
					tags: body.tags,
				});

				validateReplyPayload(replyBody);
				return sdk.emails.reply(replyTargetId, replyBody as never);
			}

			validateSendPayload(body);
			return sdk.emails.send(
				body as { from: string; to: string | string[]; subject: string },
			);
		}
		if (action === "update") {
			const id = requirePositional(maybeThird, "email id");
			const body = await readBodyInput(ctx.parsed, {
				is_read: parseBooleanString(ctx.parsed, "is_read") === "true",
				is_archived: parseBooleanString(ctx.parsed, "is_archived") === "true",
			});
			return rawE2Request({
				...api,
				path: `/api/e2/emails/${id}`,
				method: "PATCH",
				body,
			});
		}
		if (action === "cancel") {
			const id = requirePositional(maybeThird, "email id");
			return sdk.emails.delete(id);
		}
		if (action === "reply") {
			const id = requirePositional(maybeThird, "email or thread id");
			const inputBody = await readBodyInput(ctx.parsed, {
				from: getOptionString(ctx.parsed, "from"),
				to: getOptionString(ctx.parsed, "to"),
				subject: getOptionString(ctx.parsed, "subject"),
				html: getOptionString(ctx.parsed, "html"),
				text: getOptionString(ctx.parsed, "text"),
				reply_all: getOptionBoolean(ctx.parsed, "reply_all", "reply-all"),
			});
			const body = applyMailboxSenderDefaults(ctx, inputBody);
			validateReplyPayload(body);
			return sdk.emails.reply(id, body as never);
		}
		if (action === "retry") {
			const id = requirePositional(maybeThird, "email id");
			const body = await readBodyInput(ctx.parsed, {
				endpoint_id: getOptionString(ctx.parsed, "endpoint_id", "endpoint-id"),
				delivery_id: getOptionString(ctx.parsed, "delivery_id", "delivery-id"),
			});
			return sdk.emails.retry(id, body);
		}
	}

	if (group === "endpoints") {
		if (action === "list") {
			const query = parseQueryCommon(ctx.parsed);
			const type = getOptionString(ctx.parsed, "type");
			const active = parseBooleanString(ctx.parsed, "active");
			const sortBy = getOptionString(ctx.parsed, "sortBy", "sort-by");
			if (type) query.type = type;
			if (active) query.active = active;
			if (sortBy) query.sortBy = sortBy;
			return sdk.endpoints.list(query);
		}
		if (action === "get") {
			const id = requirePositional(maybeThird, "endpoint id");
			return sdk.endpoints.retrieve(id);
		}
		if (action === "create") {
			const body = await readBodyInput(ctx.parsed);
			return sdk.endpoints.create(body as never);
		}
		if (action === "update") {
			const id = requirePositional(maybeThird, "endpoint id");
			const body = await readBodyInput(ctx.parsed);
			return sdk.endpoints.update(id, body);
		}
		if (action === "delete") {
			const id = requirePositional(maybeThird, "endpoint id");
			return sdk.endpoints.delete(id);
		}
		if (action === "test") {
			const id = requirePositional(maybeThird, "endpoint id");
			const body = await readBodyInput(ctx.parsed, {
				webhookFormat: getOptionString(
					ctx.parsed,
					"webhookFormat",
					"webhook-format",
				),
				overrideUrl: getOptionString(ctx.parsed, "overrideUrl", "override-url"),
			});
			return sdk.endpoints.test(id, body);
		}
	}

	if (group === "attachments" && action === "get") {
		const id = requirePositional(maybeThird, "email id");
		const filename = requirePositional(ctx.parsed.positionals[3], "filename");
		const result = await rawE2BinaryRequest({
			...api,
			path: `/api/e2/attachments/${id}/${filename}`,
		});

		const outputPath = resolve(
			getOptionString(ctx.parsed, "out") || defaultAttachmentPath(filename),
		);
		await writeDownloadedFile(
			outputPath,
			result.bytes,
			getOptionBoolean(ctx.parsed, "force"),
		);

		return {
			message: `Downloaded ${basename(outputPath)}`,
			path: outputPath,
			bytes: result.bytes.length,
			content_type: result.contentType,
		};
	}

	if (group === "mail" && action === "threads") {
		const subAction = maybeThird;
		if (subAction === "list") {
			const baseQuery = parseQueryCommon(ctx.parsed);
			const cursor = getOptionString(ctx.parsed, "cursor");
			const unread = parseBooleanString(ctx.parsed, "unread");
			if (cursor) baseQuery.cursor = cursor;
			if (unread) baseQuery.unread = unread;

			const mailboxFilters = resolveMailboxFilters({
				config: ctx.config,
				selectedMailbox: ctx.globals.mailbox,
				addressOverrides: ctx.globals.addresses,
				domainOverrides: ctx.globals.domains,
				mergeFilters: ctx.globals.mergeFilters,
			});

			const queries = buildFanoutQueries(mailboxFilters);
			const results = await Promise.all(
				queries.map((filters) =>
					sdk.mail.list({
						...baseQuery,
						address: filters.address,
						domain: filters.domain,
					}),
				),
			);

			if (results.length === 1) {
				const single = results[0];
				return {
					threads: single.threads || [],
					pagination: single.pagination || {
						limit: Number(baseQuery.limit || single.threads?.length || 0),
						has_more: false,
						next_cursor: null,
					},
					filters: {
						...(single.filters || {}),
						mailbox: mailboxFilters.mailboxName,
						addresses: mailboxFilters.addresses,
						domains: mailboxFilters.domains,
					},
				};
			}

			const merged = dedupeById(
				results.flatMap((result) => result.threads || []),
			);
			const aggregatedHasMore = results.some(
				(result) => result.pagination?.has_more === true,
			);
			const fallbackLimit = asNumber(results[0]?.pagination?.limit);
			return {
				threads: merged,
				pagination: {
					limit: Number(baseQuery.limit || fallbackLimit || merged.length),
					has_more: aggregatedHasMore,
					next_cursor: null,
				},
				filters: {
					...baseQuery,
					mailbox: mailboxFilters.mailboxName,
					addresses: mailboxFilters.addresses,
					domains: mailboxFilters.domains,
				},
			};
		}

		if (subAction === "get") {
			const id = requirePositional(ctx.parsed.positionals[3], "thread id");
			return sdk.mail.retrieve(id);
		}
	}

	if (group === "guard") {
		if (action === "list") {
			const query = parseQueryCommon(ctx.parsed);
			const type = getOptionString(ctx.parsed, "type");
			const isActive = parseBooleanString(ctx.parsed, "isActive");
			if (type) query.type = type;
			if (isActive) query.isActive = isActive;
			return rawE2Request({ ...api, path: "/api/e2/guard", query });
		}
		if (action === "get") {
			const id = requirePositional(maybeThird, "guard rule id");
			return rawE2Request({ ...api, path: `/api/e2/guard/${id}` });
		}
		if (action === "create") {
			const body = await readBodyInput(ctx.parsed);
			return rawE2Request({
				...api,
				path: "/api/e2/guard",
				method: "POST",
				body,
			});
		}
		if (action === "update") {
			const id = requirePositional(maybeThird, "guard rule id");
			const body = await readBodyInput(ctx.parsed);
			return rawE2Request({
				...api,
				path: `/api/e2/guard/${id}`,
				method: "PUT",
				body,
			});
		}
		if (action === "delete") {
			const id = requirePositional(maybeThird, "guard rule id");
			return rawE2Request({
				...api,
				path: `/api/e2/guard/${id}`,
				method: "DELETE",
			});
		}
		if (action === "check") {
			const id = requirePositional(maybeThird, "guard rule id");
			const body = await readBodyInput(ctx.parsed, {
				structuredEmailId: getOptionString(
					ctx.parsed,
					"structuredEmailId",
					"structured-email-id",
				),
			});
			return rawE2Request({
				...api,
				path: `/api/e2/guard/${id}/check`,
				method: "POST",
				body,
			});
		}
		if (action === "generate") {
			const body = await readBodyInput(ctx.parsed, {
				prompt: getOptionString(ctx.parsed, "prompt"),
			});
			return rawE2Request({
				...api,
				path: "/api/e2/guard/generate",
				method: "POST",
				body,
			});
		}
	}

	throw new Error(
		"Unknown command. Use --help. Onboarding routes are intentionally excluded from CLI v1.",
	);
}

function asNumber(value: unknown): number {
	if (typeof value === "number" && !Number.isNaN(value)) {
		return value;
	}
	if (typeof value === "string") {
		const parsed = Number(value);
		if (!Number.isNaN(parsed)) {
			return parsed;
		}
	}
	return 0;
}

export function parseGlobalFilters(parsed: ParsedArgv): {
	addresses: string[];
	domains: string[];
} {
	const addresses = parseListStrings(parsed, "address");
	const domains = parseListStrings(parsed, "domain");
	return { addresses, domains };
}

export function parseLimitOffset(parsed: ParsedArgv): {
	limit?: string;
	offset?: string;
} {
	return {
		limit: parseNumberOption(parsed, "limit"),
		offset: parseNumberOption(parsed, "offset"),
	};
}
