import {
	GetConfigurationSetCommand,
	GetEmailIdentityCommand,
	GetReputationEntityCommand,
	GetTenantCommand,
	SESv2Client,
} from "@aws-sdk/client-sesv2";
import * as dotenv from "dotenv";
import { desc, eq, inArray } from "drizzle-orm";
import {
	pauseTenantSending,
	suspendTenantSending,
} from "@/lib/aws-ses/aws-ses-tenants";
import { db } from "@/lib/db";
import { user } from "@/lib/db/auth-schema";
import { emailDomains, sesTenants } from "@/lib/db/schema";

dotenv.config();

type TenantDbRow = {
	tenantId: string;
	userId: string;
	userEmail: string | null;
	tenantName: string;
	dbAwsTenantId: string;
	configurationSetName: string | null;
	dbStatus: string;
	dbReputationPolicy: string;
	updatedAt: Date | null;
};

type DomainDbRow = {
	domainId: string;
	domain: string;
	dbStatus: string;
	canReceiveEmails: boolean | null;
	tenantId: string | null;
	userId: string;
	userEmail: string | null;
	updatedAt: Date | null;
};

type TenantAwsStatus = TenantDbRow & {
	awsTenantFound: boolean;
	awsTenantId: string | null;
	awsTenantSendingStatus: string | null;
	awsConfigurationSetFound: boolean | null;
	awsConfigurationSetSendingEnabled: boolean | null;
	awsReputationPolicy: string | null;
	awsErrors: string[];
};

type DomainAwsStatus = DomainDbRow & {
	awsIdentityFound: boolean;
	awsVerifiedForSending: boolean | null;
	awsDkimStatus: string | null;
	awsMailFromStatus: string | null;
	awsErrors: string[];
};

type TenantAction = "pause" | "suspend";

type TenantActionResult = {
	tenantId: string;
	tenantName: string | null;
	configurationSetName: string | null;
	action: TenantAction;
	executed: boolean;
	success: boolean;
	error: string | null;
};

type OutputPayload = {
	meta: {
		generatedAt: string;
		region: string;
		tenantCount: number;
		domainCount: number;
		actionCount: number;
	};
	actions: TenantActionResult[];
	tenants: TenantAwsStatus[];
	domains: DomainAwsStatus[];
};

const args = process.argv.slice(2);

function getOptionValue(flag: string): string | undefined {
	const inlineArg = args.find((arg) => arg.startsWith(`${flag}=`));
	if (inlineArg) {
		return inlineArg.slice(flag.length + 1);
	}

	const index = args.indexOf(flag);
	if (index === -1 || index === args.length - 1) {
		return undefined;
	}

	return args[index + 1];
}

function getCsvOption(flag: string): string[] {
	const raw = getOptionValue(flag);
	if (!raw) {
		return [];
	}

	return raw
		.split(",")
		.map((value) => value.trim())
		.filter((value) => value.length > 0);
}

function hasFlag(flag: string): boolean {
	return args.includes(flag);
}

function getNumberOption(flag: string, fallback: number): number {
	const raw = getOptionValue(flag);
	if (!raw) {
		return fallback;
	}

	const parsed = Number.parseInt(raw, 10);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return fallback;
	}

	return parsed;
}

function usage(): void {
	console.log(`AWS SES status helper

Usage:
  bun run scripts/aws-ses-status-helper.ts [options]

Options:
  --tenant-ids <id1,id2>    Check specific tenant IDs (ses_tenants.id)
  --domain-ids <id1,id2>    Check specific domain IDs (email_domains.id)
  --domains <a.com,b.com>   Check specific domain names
  --pause-tenant-ids <csv>  Pause tenant sending (requires --execute)
  --suspend-tenant-ids <csv> Suspend tenant sending (requires --execute)
  --execute                 Execute pause/suspend actions
  --all-tenants             Check all tenants (limited by --limit)
  --all-domains             Check all domains (limited by --limit)
  --limit <n>               Max rows for --all-* modes (default: 100)
  --json                    Print JSON output
  --help                    Show this help text

Examples:
  bun run scripts/aws-ses-status-helper.ts --tenant-ids tenant_abc,tenant_def --json
  bun run scripts/aws-ses-status-helper.ts --domain-ids indm_123,indm_456
  bun run scripts/aws-ses-status-helper.ts --all-tenants --limit 25
  bun run scripts/aws-ses-status-helper.ts --suspend-tenant-ids tenant_abc --execute --json
`);
}

function getErrorName(error: unknown): string {
	if (typeof error !== "object" || error === null || !("name" in error)) {
		return "UnknownError";
	}

	const name = (error as { name?: unknown }).name;
	return typeof name === "string" ? name : "UnknownError";
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error !== "object" || error === null || !("message" in error)) {
		return "Unknown error";
	}

	const message = (error as { message?: unknown }).message;
	return typeof message === "string" ? message : "Unknown error";
}

function isNotFoundError(error: unknown): boolean {
	return getErrorName(error).toLowerCase().includes("notfound");
}

function extractPolicyName(policyArn: string | undefined): string | null {
	if (!policyArn) {
		return null;
	}

	const parts = policyArn.split("/");
	return parts.length > 0 ? (parts[parts.length - 1] ?? null) : null;
}

function makeTenantArn(
	region: string,
	accountId: string,
	tenantName: string,
	tenantAwsId: string,
): string {
	return `arn:aws:ses:${region}:${accountId}:tenant/${tenantName}/${tenantAwsId}`;
}

async function loadTenantRows(
	tenantIds: string[],
	allTenants: boolean,
	limit: number,
): Promise<TenantDbRow[]> {
	if (tenantIds.length > 0) {
		const rows = await db
			.select({
				tenantId: sesTenants.id,
				userId: sesTenants.userId,
				userEmail: user.email,
				tenantName: sesTenants.tenantName,
				dbAwsTenantId: sesTenants.awsTenantId,
				configurationSetName: sesTenants.configurationSetName,
				dbStatus: sesTenants.status,
				dbReputationPolicy: sesTenants.reputationPolicy,
				updatedAt: sesTenants.updatedAt,
			})
			.from(sesTenants)
			.leftJoin(user, eq(sesTenants.userId, user.id))
			.where(inArray(sesTenants.id, tenantIds));

		return rows;
	}

	if (!allTenants) {
		return [];
	}

	return db
		.select({
			tenantId: sesTenants.id,
			userId: sesTenants.userId,
			userEmail: user.email,
			tenantName: sesTenants.tenantName,
			dbAwsTenantId: sesTenants.awsTenantId,
			configurationSetName: sesTenants.configurationSetName,
			dbStatus: sesTenants.status,
			dbReputationPolicy: sesTenants.reputationPolicy,
			updatedAt: sesTenants.updatedAt,
		})
		.from(sesTenants)
		.leftJoin(user, eq(sesTenants.userId, user.id))
		.orderBy(desc(sesTenants.updatedAt))
		.limit(limit);
}

function dedupeDomainRows(rows: DomainDbRow[]): DomainDbRow[] {
	const map = new Map<string, DomainDbRow>();
	for (const row of rows) {
		map.set(row.domainId, row);
	}
	return Array.from(map.values());
}

async function loadDomainRows(
	domainIds: string[],
	domainNames: string[],
	allDomains: boolean,
	limit: number,
): Promise<DomainDbRow[]> {
	const queries: Promise<DomainDbRow[]>[] = [];

	if (domainIds.length > 0) {
		queries.push(
			db
				.select({
					domainId: emailDomains.id,
					domain: emailDomains.domain,
					dbStatus: emailDomains.status,
					canReceiveEmails: emailDomains.canReceiveEmails,
					tenantId: emailDomains.tenantId,
					userId: emailDomains.userId,
					userEmail: user.email,
					updatedAt: emailDomains.updatedAt,
				})
				.from(emailDomains)
				.leftJoin(user, eq(emailDomains.userId, user.id))
				.where(inArray(emailDomains.id, domainIds)),
		);
	}

	if (domainNames.length > 0) {
		queries.push(
			db
				.select({
					domainId: emailDomains.id,
					domain: emailDomains.domain,
					dbStatus: emailDomains.status,
					canReceiveEmails: emailDomains.canReceiveEmails,
					tenantId: emailDomains.tenantId,
					userId: emailDomains.userId,
					userEmail: user.email,
					updatedAt: emailDomains.updatedAt,
				})
				.from(emailDomains)
				.leftJoin(user, eq(emailDomains.userId, user.id))
				.where(inArray(emailDomains.domain, domainNames)),
		);
	}

	if (queries.length > 0) {
		const settled = await Promise.all(queries);
		return dedupeDomainRows(settled.flat());
	}

	if (!allDomains) {
		return [];
	}

	const rows = await db
		.select({
			domainId: emailDomains.id,
			domain: emailDomains.domain,
			dbStatus: emailDomains.status,
			canReceiveEmails: emailDomains.canReceiveEmails,
			tenantId: emailDomains.tenantId,
			userId: emailDomains.userId,
			userEmail: user.email,
			updatedAt: emailDomains.updatedAt,
		})
		.from(emailDomains)
		.leftJoin(user, eq(emailDomains.userId, user.id))
		.orderBy(desc(emailDomains.updatedAt))
		.limit(limit);

	return rows;
}

async function resolveTenantStatus(
	sesClient: SESv2Client,
	region: string,
	awsAccountId: string | undefined,
	tenant: TenantDbRow,
): Promise<TenantAwsStatus> {
	const errors: string[] = [];

	let awsTenantFound = false;
	let awsTenantId: string | null = null;
	let awsTenantSendingStatus: string | null = null;

	let awsConfigurationSetFound: boolean | null = null;
	let awsConfigurationSetSendingEnabled: boolean | null = null;

	let awsReputationPolicy: string | null = null;

	try {
		const tenantResponse = await sesClient.send(
			new GetTenantCommand({ TenantName: tenant.tenantName }),
		);
		awsTenantFound = true;
		awsTenantId = tenantResponse.Tenant?.TenantId ?? null;
		awsTenantSendingStatus = tenantResponse.Tenant?.SendingStatus ?? null;
	} catch (error) {
		if (!isNotFoundError(error)) {
			errors.push(
				`GetTenant: ${getErrorName(error)} ${getErrorMessage(error)}`,
			);
		}
	}

	if (tenant.configurationSetName) {
		try {
			const configSetResponse = await sesClient.send(
				new GetConfigurationSetCommand({
					ConfigurationSetName: tenant.configurationSetName,
				}),
			);
			awsConfigurationSetFound = true;
			awsConfigurationSetSendingEnabled =
				configSetResponse.SendingOptions?.SendingEnabled ?? null;
		} catch (error) {
			awsConfigurationSetFound = false;
			awsConfigurationSetSendingEnabled = null;
			if (!isNotFoundError(error)) {
				errors.push(
					`GetConfigurationSet: ${getErrorName(error)} ${getErrorMessage(error)}`,
				);
			}
		}
	}

	if (awsAccountId) {
		try {
			const tenantArn = makeTenantArn(
				region,
				awsAccountId,
				tenant.tenantName,
				tenant.dbAwsTenantId,
			);
			const reputationResponse = await sesClient.send(
				new GetReputationEntityCommand({
					ReputationEntityType: "RESOURCE",
					ReputationEntityReference: tenantArn,
				}),
			);

			awsReputationPolicy = extractPolicyName(
				reputationResponse.ReputationEntity?.ReputationManagementPolicy,
			);
		} catch (error) {
			if (!isNotFoundError(error)) {
				errors.push(
					`GetReputationEntity: ${getErrorName(error)} ${getErrorMessage(error)}`,
				);
			}
		}
	}

	return {
		...tenant,
		awsTenantFound,
		awsTenantId,
		awsTenantSendingStatus,
		awsConfigurationSetFound,
		awsConfigurationSetSendingEnabled,
		awsReputationPolicy,
		awsErrors: errors,
	};
}

async function resolveDomainStatus(
	sesClient: SESv2Client,
	domain: DomainDbRow,
): Promise<DomainAwsStatus> {
	const errors: string[] = [];

	let awsIdentityFound = false;
	let awsVerifiedForSending: boolean | null = null;
	let awsDkimStatus: string | null = null;
	let awsMailFromStatus: string | null = null;

	try {
		const response = await sesClient.send(
			new GetEmailIdentityCommand({ EmailIdentity: domain.domain }),
		);
		awsIdentityFound = true;
		awsVerifiedForSending = response.VerifiedForSendingStatus ?? null;
		awsDkimStatus = response.DkimAttributes?.Status ?? null;
		awsMailFromStatus =
			response.MailFromAttributes?.MailFromDomainStatus ?? null;
	} catch (error) {
		if (!isNotFoundError(error)) {
			errors.push(
				`GetEmailIdentity: ${getErrorName(error)} ${getErrorMessage(error)}`,
			);
		}
	}

	return {
		...domain,
		awsIdentityFound,
		awsVerifiedForSending,
		awsDkimStatus,
		awsMailFromStatus,
		awsErrors: errors,
	};
}

async function runTenantActions(params: {
	tenantRows: TenantDbRow[];
	pauseTenantIds: string[];
	suspendTenantIds: string[];
	execute: boolean;
}): Promise<TenantActionResult[]> {
	const results: TenantActionResult[] = [];
	const tenantById = new Map(
		params.tenantRows.map((row) => [row.tenantId, row]),
	);
	const requestedActionMap = new Map<string, TenantAction>();

	for (const tenantId of params.pauseTenantIds) {
		if (!requestedActionMap.has(tenantId)) {
			requestedActionMap.set(tenantId, "pause");
		}
	}

	for (const tenantId of params.suspendTenantIds) {
		requestedActionMap.set(tenantId, "suspend");
	}

	const requestedActions = Array.from(requestedActionMap.entries()).map(
		([tenantId, action]) => ({ tenantId, action }),
	);

	for (const request of requestedActions) {
		const tenant = tenantById.get(request.tenantId) || null;
		if (!tenant) {
			results.push({
				tenantId: request.tenantId,
				tenantName: null,
				configurationSetName: null,
				action: request.action,
				executed: params.execute,
				success: false,
				error: "Tenant not found in database",
			});
			continue;
		}

		if (!tenant.configurationSetName) {
			results.push({
				tenantId: tenant.tenantId,
				tenantName: tenant.tenantName,
				configurationSetName: null,
				action: request.action,
				executed: params.execute,
				success: false,
				error: "Tenant has no configuration set name",
			});
			continue;
		}

		if (!params.execute) {
			results.push({
				tenantId: tenant.tenantId,
				tenantName: tenant.tenantName,
				configurationSetName: tenant.configurationSetName,
				action: request.action,
				executed: false,
				success: true,
				error: null,
			});
			continue;
		}

		const reason =
			request.action === "pause"
				? "Manual pause from aws-ses-status-helper"
				: "Manual suspension from aws-ses-status-helper";

		const actionResult =
			request.action === "pause"
				? await pauseTenantSending(tenant.configurationSetName, reason)
				: await suspendTenantSending(tenant.configurationSetName, reason);

		results.push({
			tenantId: tenant.tenantId,
			tenantName: tenant.tenantName,
			configurationSetName: tenant.configurationSetName,
			action: request.action,
			executed: true,
			success: actionResult.success,
			error: actionResult.error || null,
		});
	}

	return results;
}

function printOutput(output: OutputPayload): void {
	console.log("AWS SES status helper report");
	console.log(`generated_at=${output.meta.generatedAt}`);
	console.log(`region=${output.meta.region}`);
	console.log(`tenant_count=${output.meta.tenantCount}`);
	console.log(`domain_count=${output.meta.domainCount}`);
	console.log(`action_count=${output.meta.actionCount}`);

	console.log("\n[ACTIONS]");
	if (output.actions.length === 0) {
		console.log("none");
	} else {
		for (const action of output.actions) {
			console.log(
				[
					`tenant_id=${action.tenantId}`,
					`tenant_name=${action.tenantName ?? "null"}`,
					`configuration_set_name=${action.configurationSetName ?? "null"}`,
					`action=${action.action}`,
					`executed=${action.executed}`,
					`success=${action.success}`,
					`error=${action.error ?? "none"}`,
				].join(" "),
			);
		}
	}

	console.log("\n[TENANTS]");
	if (output.tenants.length === 0) {
		console.log("none");
	} else {
		for (const row of output.tenants) {
			console.log(
				[
					`tenant_id=${row.tenantId}`,
					`tenant_name=${row.tenantName}`,
					`db_status=${row.dbStatus}`,
					`db_aws_tenant_id=${row.dbAwsTenantId}`,
					`aws_tenant_found=${row.awsTenantFound}`,
					`aws_tenant_id=${row.awsTenantId ?? "null"}`,
					`aws_sending_status=${row.awsTenantSendingStatus ?? "null"}`,
					`config_set=${row.configurationSetName ?? "null"}`,
					`config_set_found=${row.awsConfigurationSetFound ?? "null"}`,
					`config_set_sending_enabled=${row.awsConfigurationSetSendingEnabled ?? "null"}`,
					`aws_reputation_policy=${row.awsReputationPolicy ?? "null"}`,
					`user_id=${row.userId}`,
					`user_email=${row.userEmail ?? "null"}`,
					`errors=${row.awsErrors.length > 0 ? row.awsErrors.join(" | ") : "none"}`,
				].join(" "),
			);
		}
	}

	console.log("\n[DOMAINS]");
	if (output.domains.length === 0) {
		console.log("none");
	} else {
		for (const row of output.domains) {
			console.log(
				[
					`domain_id=${row.domainId}`,
					`domain=${row.domain}`,
					`db_status=${row.dbStatus}`,
					`can_receive_emails=${row.canReceiveEmails ?? "null"}`,
					`tenant_id=${row.tenantId ?? "null"}`,
					`aws_identity_found=${row.awsIdentityFound}`,
					`aws_verified_for_sending=${row.awsVerifiedForSending ?? "null"}`,
					`aws_dkim_status=${row.awsDkimStatus ?? "null"}`,
					`aws_mail_from_status=${row.awsMailFromStatus ?? "null"}`,
					`user_id=${row.userId}`,
					`user_email=${row.userEmail ?? "null"}`,
					`errors=${row.awsErrors.length > 0 ? row.awsErrors.join(" | ") : "none"}`,
				].join(" "),
			);
		}
	}
}

async function main(): Promise<void> {
	if (hasFlag("--help")) {
		usage();
		return;
	}

	const tenantIds = Array.from(new Set(getCsvOption("--tenant-ids")));
	const domainIds = Array.from(new Set(getCsvOption("--domain-ids")));
	const pauseTenantIds = Array.from(
		new Set(getCsvOption("--pause-tenant-ids")),
	);
	const suspendTenantIds = Array.from(
		new Set(getCsvOption("--suspend-tenant-ids")),
	);
	const execute = hasFlag("--execute");
	const domainNames = Array.from(
		new Set(getCsvOption("--domains").map((domain) => domain.toLowerCase())),
	);

	const allTenants = hasFlag("--all-tenants");
	const allDomains = hasFlag("--all-domains");
	const asJson = hasFlag("--json");
	const limit = getNumberOption("--limit", 100);
	const actionTenantIds = Array.from(
		new Set([...pauseTenantIds, ...suspendTenantIds]),
	);
	const tenantIdsForQuery = Array.from(
		new Set([...tenantIds, ...actionTenantIds]),
	);

	if (
		tenantIdsForQuery.length === 0 &&
		domainIds.length === 0 &&
		domainNames.length === 0 &&
		!allTenants &&
		!allDomains
	) {
		console.error("No selectors provided.");
		usage();
		process.exit(1);
	}

	const awsRegion = process.env.AWS_REGION || "us-east-2";
	const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
	const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
	const awsAccountId = process.env.AWS_ACCOUNT_ID;

	if (!awsAccessKeyId || !awsSecretAccessKey) {
		console.error(
			"Missing AWS credentials. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.",
		);
		process.exit(1);
	}

	const sesClient = new SESv2Client({
		region: awsRegion,
		credentials: {
			accessKeyId: awsAccessKeyId,
			secretAccessKey: awsSecretAccessKey,
		},
	});

	const [tenantRows, domainRows] = await Promise.all([
		loadTenantRows(tenantIdsForQuery, allTenants, limit),
		loadDomainRows(domainIds, domainNames, allDomains, limit),
	]);

	if (!execute && actionTenantIds.length > 0) {
		console.log(
			"Action flags provided without --execute. Running in dry-run preview mode.",
		);
	}

	const actionResults = await runTenantActions({
		tenantRows,
		pauseTenantIds,
		suspendTenantIds,
		execute,
	});

	const tenantStatuses: TenantAwsStatus[] = [];
	for (const row of tenantRows) {
		tenantStatuses.push(
			await resolveTenantStatus(sesClient, awsRegion, awsAccountId, row),
		);
	}

	const domainStatuses: DomainAwsStatus[] = [];
	for (const row of domainRows) {
		domainStatuses.push(await resolveDomainStatus(sesClient, row));
	}

	const output: OutputPayload = {
		meta: {
			generatedAt: new Date().toISOString(),
			region: awsRegion,
			tenantCount: tenantStatuses.length,
			domainCount: domainStatuses.length,
			actionCount: actionResults.length,
		},
		actions: actionResults,
		tenants: tenantStatuses,
		domains: domainStatuses,
	};

	if (asJson) {
		console.log(JSON.stringify(output, null, 2));
		return;
	}

	printOutput(output);
}

main().catch((error) => {
	console.error(`aws-ses-status-helper failed: ${getErrorMessage(error)}`);
	process.exit(1);
});
