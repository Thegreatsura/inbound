import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as dotenv from "dotenv";

dotenv.config();

const DEFAULT_AUDIT_DIR = ".opencode/audit/abuse-actions";

type EnforcementAction = "pause" | "suspend" | "cascade";
type ActionType =
	| "pause_tenant"
	| "suspend_tenant"
	| "ban_user"
	| "block_signup_domains";

type StepResult = {
	action: ActionType;
	target: string;
	success: boolean;
	httpStatus: number | null;
	outcome: "planned" | "executed" | "already_exists" | "skipped" | "failed";
	message: string;
};

type TenantInsight = {
	id: string;
	tenantName: string;
	status: string;
	user: {
		id: string;
		email: string | null;
		banned?: boolean | null;
	};
	domains: Array<{
		domain: string;
		status: string;
	}>;
	stats?: {
		timeRange?: string;
		sent?: number;
		bounces?: number;
		complaints?: number;
		bounceRate?: number;
		complaintRate?: number;
	};
};

type AdminTenantsResponse = {
	data: TenantInsight[];
};

type CliOptions = {
	tenantId: string;
	action: EnforcementAction;
	userId?: string;
	domains?: string[];
	reason?: string;
	execute: boolean;
	autoConfirm: boolean;
	confirm?: string;
	json: boolean;
	baseUrl: string;
};

type DomainStatusSnapshot = {
	domain: string;
	sendingDomainStatus: string | null;
	blockedSignup: boolean;
};

type ViolationSummary = {
	sent: number;
	bounces: number;
	complaints: number;
	bounceRate: number;
	complaintRate: number;
	flags: string[];
};

type ActionReport = {
	actionId: string;
	mode: "dry_run" | "execute";
	generatedAt: string;
	baseUrl: string;
	action: EnforcementAction;
	confirmationToken: string;
	auditLogPath: string | null;
	targets: {
		tenantId: string;
		userId: string | null;
		domains: string[];
	};
	reason: string;
	violation: ViolationSummary;
	currentStatus: {
		tenantStatus: string | null;
		userBanned: boolean | null;
		domains: DomainStatusSnapshot[];
	};
	postActionStatus: {
		tenantStatus: string | null;
		userBanned: boolean | null;
		domains: DomainStatusSnapshot[];
	} | null;
	steps: StepResult[];
};

function getArgValue(args: string[], flag: string): string | undefined {
	const inline = args.find((arg) => arg.startsWith(`${flag}=`));
	if (inline) {
		return inline.slice(flag.length + 1);
	}

	const index = args.indexOf(flag);
	if (index === -1 || index === args.length - 1) {
		return undefined;
	}

	return args[index + 1];
}

function hasFlag(args: string[], flag: string): boolean {
	return args.includes(flag);
}

function parseCsv(value?: string): string[] {
	if (!value) {
		return [];
	}

	return Array.from(
		new Set(
			value
				.split(",")
				.map((part) => part.trim())
				.filter((part) => part.length > 0),
		),
	);
}

function normalizeBaseUrl(baseUrl: string): string {
	return baseUrl.replace(/\/+$/, "");
}

function usage(): void {
	console.log(`Admin abuse block helper

Usage:
  bun run scripts/admin-abuse-block.ts --tenant-id <id> [options]

Options:
  --tenant-id <id>         Tenant ID to target (required)
  --action <mode>          Action mode: pause | suspend | cascade (default: cascade)
  --user-id <id>           Optional user ID override
  --domains <a.com,b.com>  Optional domain overrides
  --reason <text>          Required when using --execute
  --execute                Execute actions (default is dry-run)
  --confirm <token>        Required with --execute unless --auto-confirm is set
  --auto-confirm           Bypass confirmation token check (cron-safe)
  --base-url <url>         API base URL (default: https://inbound.new/api/e2)
  --json                   Print JSON output
  --help                   Show help

Default cascade actions:
  1) suspend tenant
  2) ban user
  3) add domains to blocked signup list

Audit logs:
  - written per run to .opencode/audit/abuse-actions/<actionId>.json
  - override directory with ABUSE_ACTION_AUDIT_DIR
`);
}

function parseOptions(args: string[]): CliOptions {
	if (hasFlag(args, "--help")) {
		usage();
		process.exit(0);
	}

	const tenantId = getArgValue(args, "--tenant-id");
	if (!tenantId) {
		console.error("Missing required --tenant-id");
		usage();
		process.exit(1);
	}

	const baseUrl = normalizeBaseUrl(
		getArgValue(args, "--base-url") ||
			process.env.INBOUND_API_BASE_URL ||
			"https://inbound.new/api/e2",
	);

	const actionArg = (getArgValue(args, "--action") || "cascade").toLowerCase();
	if (
		actionArg !== "pause" &&
		actionArg !== "suspend" &&
		actionArg !== "cascade"
	) {
		console.error(`Invalid --action value: ${actionArg}`);
		console.error("Expected one of: pause, suspend, cascade");
		process.exit(1);
	}

	return {
		tenantId,
		action: actionArg,
		userId: getArgValue(args, "--user-id"),
		domains: parseCsv(getArgValue(args, "--domains")).map((domain) =>
			domain.toLowerCase(),
		),
		reason: getArgValue(args, "--reason"),
		execute: hasFlag(args, "--execute"),
		autoConfirm: hasFlag(args, "--auto-confirm"),
		confirm: getArgValue(args, "--confirm"),
		json: hasFlag(args, "--json"),
		baseUrl,
	};
}

function computeConfirmationToken(params: {
	tenantId: string;
	action: EnforcementAction;
	userId: string | null;
	domains: string[];
	reason: string;
}): string {
	const seed = JSON.stringify({
		tenantId: params.tenantId,
		action: params.action,
		userId: params.userId,
		domains: [...params.domains].sort(),
		reason: params.reason,
	});
	return createHash("sha256").update(seed).digest("hex").slice(0, 16);
}

function getAuditDirectory(): string {
	const configured = process.env.ABUSE_ACTION_AUDIT_DIR?.trim();
	return resolve(process.cwd(), configured || DEFAULT_AUDIT_DIR);
}

async function writeAuditLog(params: {
	report: ActionReport;
	args: string[];
}): Promise<string> {
	const auditDirectory = getAuditDirectory();
	await mkdir(auditDirectory, { recursive: true });

	const filePath = resolve(auditDirectory, `${params.report.actionId}.json`);
	const payload = {
		...params.report,
		auditLogPath: filePath,
		invocationArgs: params.args,
	};
	await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
	return filePath;
}

function getApiKey(): string {
	const apiKey = process.env.INBOUND_API_KEY?.trim();
	if (!apiKey) {
		console.error("Missing INBOUND_API_KEY in environment");
		process.exit(1);
	}
	return apiKey;
}

async function apiRequest<T>(params: {
	method: "GET" | "POST";
	url: string;
	apiKey: string;
	body?: unknown;
}): Promise<{ status: number; data: T }> {
	const response = await fetch(params.url, {
		method: params.method,
		headers: {
			Authorization: `Bearer ${params.apiKey}`,
			"Content-Type": "application/json",
		},
		body: params.body ? JSON.stringify(params.body) : undefined,
	});

	const text = await response.text();
	let parsed: unknown = null;
	if (text.length > 0) {
		try {
			parsed = JSON.parse(text);
		} catch {
			parsed = { error: text };
		}
	}

	return {
		status: response.status,
		data: parsed as T,
	};
}

async function resolveTenant(
	baseUrl: string,
	apiKey: string,
	tenantId: string,
): Promise<TenantInsight> {
	const query = new URLSearchParams({
		search: tenantId,
		limit: "50",
		offset: "0",
		timeRange: "7d",
	}).toString();

	const { status, data } = await apiRequest<AdminTenantsResponse>({
		method: "GET",
		url: `${baseUrl}/admin/tenants?${query}`,
		apiKey,
	});

	if (status !== 200 || !data || !Array.isArray(data.data)) {
		throw new Error(`Failed to load tenant from admin API (status ${status})`);
	}

	const matched = data.data.find((item) => item.id === tenantId);
	if (!matched) {
		throw new Error(`Tenant ${tenantId} not found in admin API response`);
	}

	return matched;
}

async function getBlockedSignupDomainSet(
	baseUrl: string,
	apiKey: string,
	domains: string[],
): Promise<Set<string>> {
	const blocked = new Set<string>();

	for (const domain of domains) {
		const query = new URLSearchParams({
			search: domain,
			active: "true",
			limit: "100",
			offset: "0",
		}).toString();
		const { status, data } = await apiRequest<{
			data?: Array<{ domain?: string; isActive?: boolean }>;
		}>({
			method: "GET",
			url: `${baseUrl}/admin/blocked-signup-domains?${query}`,
			apiKey,
		});

		if (status !== 200 || !data?.data) {
			continue;
		}

		const exactMatch = data.data.some(
			(item) =>
				item.isActive === true &&
				typeof item.domain === "string" &&
				item.domain.toLowerCase() === domain,
		);
		if (exactMatch) {
			blocked.add(domain);
		}
	}

	return blocked;
}

function buildViolationSummary(tenant: TenantInsight): ViolationSummary {
	const sent = Number(tenant.stats?.sent || 0);
	const bounces = Number(tenant.stats?.bounces || 0);
	const complaints = Number(tenant.stats?.complaints || 0);
	const bounceRate = Number(tenant.stats?.bounceRate || 0);
	const complaintRate = Number(tenant.stats?.complaintRate || 0);
	const flags: string[] = [];

	if (sent >= 200 && bounceRate >= 2.5) {
		flags.push("critical_bounce_threshold");
	}
	if (sent >= 1000 && complaintRate >= 0.1) {
		flags.push("critical_complaint_threshold");
	}
	if (sent >= 500 && bounceRate >= 1.0) {
		flags.push("medium_high_volume_threshold");
	}
	if (flags.length === 0) {
		flags.push("no_threshold_violation_detected");
	}

	return {
		sent,
		bounces,
		complaints,
		bounceRate,
		complaintRate,
		flags,
	};
}

function buildDomainSnapshot(params: {
	domains: string[];
	tenant: TenantInsight;
	blockedSet: Set<string>;
}): DomainStatusSnapshot[] {
	return params.domains.map((domain) => {
		const matchedDomain = params.tenant.domains.find(
			(item) => item.domain.toLowerCase() === domain,
		);
		return {
			domain,
			sendingDomainStatus: matchedDomain?.status || null,
			blockedSignup: params.blockedSet.has(domain),
		};
	});
}

function printHuman(report: ActionReport): void {
	console.log("Admin abuse block report");
	console.log(`action_id=${report.actionId}`);
	console.log(`mode=${report.mode}`);
	console.log(`action=${report.action}`);
	console.log(`tenant_id=${report.targets.tenantId}`);
	console.log(`user_id=${report.targets.userId || "null"}`);
	console.log(`domains=${report.targets.domains.join(",") || "none"}`);
	console.log(`confirmation_token=${report.confirmationToken}`);
	console.log(`reason=${report.reason}`);
	console.log(`audit_log_path=${report.auditLogPath || "pending"}`);
	console.log(
		`violation=sent:${report.violation.sent} bounces:${report.violation.bounces} complaints:${report.violation.complaints} bounce_rate:${report.violation.bounceRate}% complaint_rate:${report.violation.complaintRate}% flags:${report.violation.flags.join(",")}`,
	);
	console.log(
		`current_status=tenant:${report.currentStatus.tenantStatus || "unknown"} user_banned:${report.currentStatus.userBanned ?? "unknown"}`,
	);
	if (report.postActionStatus) {
		console.log(
			`post_action_status=tenant:${report.postActionStatus.tenantStatus || "unknown"} user_banned:${report.postActionStatus.userBanned ?? "unknown"}`,
		);
	}
	const userLabel = report.targets.userId || "unresolved_user";
	const domainsLabel = report.targets.domains.join(",") || "no_domains";
	const executionVerb = report.mode === "execute" ? "executed" : "planned";
	console.log(
		`enforcement_summary=user:${userLabel} domains:${domainsLabel} sent:${report.violation.sent} bounce_rate:${report.violation.bounceRate}% complaint_rate:${report.violation.complaintRate}% flags:${report.violation.flags.join(",")} action:${report.action} ${executionVerb}`,
	);
	console.log("\n[STEPS]");
	for (const step of report.steps) {
		console.log(
			`action=${step.action} target=${step.target} outcome=${step.outcome} success=${step.success} status=${step.httpStatus ?? "null"} message=${step.message}`,
		);
	}
}

async function main(): Promise<void> {
	const options = parseOptions(process.argv.slice(2));
	const apiKey = getApiKey();

	const tenant = await resolveTenant(options.baseUrl, apiKey, options.tenantId);
	const resolvedUserId = options.userId || tenant.user.id || null;
	const resolvedDomains =
		options.domains && options.domains.length > 0
			? options.domains
			: tenant.domains
					.map((domainEntry) => domainEntry.domain.toLowerCase())
					.filter((domainName) => domainName.length > 0);

	const reason =
		options.reason?.trim() ||
		`Abuse enforcement action for tenant ${options.tenantId}`;

	const violation = buildViolationSummary(tenant);
	const currentBlockedSet = await getBlockedSignupDomainSet(
		options.baseUrl,
		apiKey,
		resolvedDomains,
	);
	const currentDomainSnapshot = buildDomainSnapshot({
		domains: resolvedDomains,
		tenant,
		blockedSet: currentBlockedSet,
	});

	const confirmationToken = computeConfirmationToken({
		tenantId: options.tenantId,
		action: options.action,
		userId: resolvedUserId,
		domains: resolvedDomains,
		reason,
	});

	if (options.execute && !options.reason?.trim()) {
		console.error("--reason is required when using --execute");
		process.exit(1);
	}

	if (
		options.execute &&
		!options.autoConfirm &&
		options.confirm !== confirmationToken
	) {
		console.error(
			"Invalid --confirm token. Run dry-run first and reuse token, or pass --auto-confirm for non-interactive automation.",
		);
		console.error(`expected_confirmation_token=${confirmationToken}`);
		process.exit(1);
	}

	const report: ActionReport = {
		actionId: `abuse_${Date.now()}`,
		mode: options.execute ? "execute" : "dry_run",
		generatedAt: new Date().toISOString(),
		baseUrl: options.baseUrl,
		action: options.action,
		confirmationToken,
		auditLogPath: null,
		targets: {
			tenantId: options.tenantId,
			userId: resolvedUserId,
			domains: resolvedDomains,
		},
		reason,
		violation,
		currentStatus: {
			tenantStatus: tenant.status || null,
			userBanned: tenant.user.banned ?? null,
			domains: currentDomainSnapshot,
		},
		postActionStatus: null,
		steps: [],
	};

	const tenantEndpointAction = options.action === "pause" ? "pause" : "suspend";
	const tenantStepAction: ActionType =
		options.action === "pause" ? "pause_tenant" : "suspend_tenant";
	const tenantPlannedMessage =
		tenantEndpointAction === "pause"
			? "Would call POST /admin/tenants/:tenantId/pause"
			: "Would call POST /admin/tenants/:tenantId/suspend";
	const tenantAlreadyInDesiredState =
		(tenantEndpointAction === "pause" && tenant.status === "paused") ||
		(tenantEndpointAction === "suspend" && tenant.status === "suspended");

	if (!options.execute) {
		report.steps.push({
			action: tenantStepAction,
			target: options.tenantId,
			success: true,
			httpStatus: null,
			outcome: tenantAlreadyInDesiredState ? "already_exists" : "planned",
			message: tenantAlreadyInDesiredState
				? tenantEndpointAction === "pause"
					? "Tenant already paused"
					: "Tenant already suspended"
				: tenantPlannedMessage,
		});

		if (options.action === "cascade") {
			report.steps.push({
				action: "ban_user",
				target: resolvedUserId || "unresolved",
				success: resolvedUserId !== null,
				httpStatus: null,
				outcome:
					resolvedUserId === null
						? "skipped"
						: tenant.user.banned === true
							? "already_exists"
							: "planned",
				message:
					resolvedUserId === null
						? "No userId resolved"
						: tenant.user.banned === true
							? "User already banned"
							: "Would call POST /admin/users/:userId/ban",
			});

			for (const domainName of resolvedDomains) {
				const alreadyBlocked = currentBlockedSet.has(domainName);
				report.steps.push({
					action: "block_signup_domains",
					target: domainName,
					success: true,
					httpStatus: null,
					outcome: alreadyBlocked ? "already_exists" : "planned",
					message: alreadyBlocked
						? "Domain already blocked in signup list"
						: "Would call POST /admin/blocked-signup-domains",
				});
			}
		}
	} else {
		if (tenantAlreadyInDesiredState) {
			report.steps.push({
				action: tenantStepAction,
				target: options.tenantId,
				success: true,
				httpStatus: null,
				outcome: "already_exists",
				message:
					tenantEndpointAction === "pause"
						? "Tenant already paused"
						: "Tenant already suspended",
			});
		} else {
			const tenantActionResult = await apiRequest<{ error?: string }>({
				method: "POST",
				url: `${options.baseUrl}/admin/tenants/${options.tenantId}/${tenantEndpointAction}`,
				apiKey,
				body: { reason },
			});

			report.steps.push({
				action: tenantStepAction,
				target: options.tenantId,
				success: tenantActionResult.status === 200,
				httpStatus: tenantActionResult.status,
				outcome: tenantActionResult.status === 200 ? "executed" : "failed",
				message:
					tenantActionResult.status === 200
						? tenantEndpointAction === "pause"
							? "Tenant paused"
							: "Tenant suspended"
						: tenantActionResult.data?.error ||
							(tenantEndpointAction === "pause"
								? "Tenant pause failed"
								: "Tenant suspend failed"),
			});
		}

		if (options.action === "cascade") {
			if (resolvedUserId) {
				if (tenant.user.banned === true) {
					report.steps.push({
						action: "ban_user",
						target: resolvedUserId,
						success: true,
						httpStatus: null,
						outcome: "already_exists",
						message: "User already banned",
					});
				} else {
					const banResult = await apiRequest<{ error?: string }>({
						method: "POST",
						url: `${options.baseUrl}/admin/users/${resolvedUserId}/ban`,
						apiKey,
						body: { reason },
					});

					report.steps.push({
						action: "ban_user",
						target: resolvedUserId,
						success: banResult.status === 200,
						httpStatus: banResult.status,
						outcome: banResult.status === 200 ? "executed" : "failed",
						message:
							banResult.status === 200
								? "User banned"
								: banResult.data?.error || "User ban failed",
					});
				}
			} else {
				report.steps.push({
					action: "ban_user",
					target: "unresolved",
					success: false,
					httpStatus: null,
					outcome: "skipped",
					message: "No userId resolved",
				});
			}

			for (const domainName of resolvedDomains) {
				if (currentBlockedSet.has(domainName)) {
					report.steps.push({
						action: "block_signup_domains",
						target: domainName,
						success: true,
						httpStatus: null,
						outcome: "already_exists",
						message: "Domain already blocked",
					});
					continue;
				}

				const blockResult = await apiRequest<{ error?: string }>({
					method: "POST",
					url: `${options.baseUrl}/admin/blocked-signup-domains`,
					apiKey,
					body: {
						domain: domainName,
						reason,
						isActive: true,
					},
				});

				const alreadyExists = blockResult.status === 409;
				report.steps.push({
					action: "block_signup_domains",
					target: domainName,
					success: blockResult.status === 201 || alreadyExists,
					httpStatus: blockResult.status,
					outcome:
						blockResult.status === 201
							? "executed"
							: alreadyExists
								? "already_exists"
								: "failed",
					message:
						blockResult.status === 201
							? "Domain added to blocked signup list"
							: alreadyExists
								? "Domain already blocked"
								: blockResult.data?.error || "Domain block failed",
				});
			}
		}
	}

	if (options.execute) {
		try {
			const refreshedTenant = await resolveTenant(
				options.baseUrl,
				apiKey,
				options.tenantId,
			);
			const postBlockedSet = await getBlockedSignupDomainSet(
				options.baseUrl,
				apiKey,
				resolvedDomains,
			);
			report.postActionStatus = {
				tenantStatus: refreshedTenant.status || null,
				userBanned: refreshedTenant.user.banned ?? null,
				domains: buildDomainSnapshot({
					domains: resolvedDomains,
					tenant: refreshedTenant,
					blockedSet: postBlockedSet,
				}),
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error(`Failed to resolve post-action status: ${message}`);
		}
	}

	try {
		report.auditLogPath = await writeAuditLog({
			report,
			args: process.argv.slice(2),
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Failed to write audit log: ${message}`);
	}

	if (options.json) {
		console.log(JSON.stringify(report, null, 2));
		return;
	}

	printHuman(report);
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : "Unknown error";
	console.error(`admin-abuse-block failed: ${message}`);
	process.exit(1);
});
