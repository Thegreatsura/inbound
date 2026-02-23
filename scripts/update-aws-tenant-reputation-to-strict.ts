import {
	GetReputationEntityCommand,
	ListTenantsCommand,
	SESv2Client,
	UpdateReputationEntityPolicyCommand,
} from "@aws-sdk/client-sesv2";

type TenantRef = {
	tenantName: string;
	tenantId: string;
};

type TenantPolicySnapshot = TenantRef & {
	policy: string | null;
	error?: string;
	errorType?: "rate_limit" | "other";
};

const awsRegion = process.env.AWS_REGION || "us-east-2";
const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const awsAccountId = process.env.AWS_ACCOUNT_ID;

if (!awsAccessKeyId || !awsSecretAccessKey) {
	console.error(
		"❌ AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.",
	);
	process.exit(1);
}

if (!awsAccountId) {
	console.error("❌ AWS_ACCOUNT_ID not configured. Please set AWS_ACCOUNT_ID.");
	process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const strictPolicyArn = `arn:aws:ses:${awsRegion}:aws:reputation-policy/strict`;
const maxRateRetries = 6;
const baseRetryDelayMs = 400;
const maxRetryDelayMs = 10_000;
const minRequestIntervalMs = 175;
const transientRecheckPasses = 2;
const transientRecheckCooldownMs = 2_000;
const excludedTenantIds = new Set(["tn-2a63d39440f00848ad319e34b6ee3"]);

const sesClient = new SESv2Client({
	region: awsRegion,
	credentials: {
		accessKeyId: awsAccessKeyId,
		secretAccessKey: awsSecretAccessKey,
	},
});

let nextAllowedRequestAtMs = 0;

function getErrorName(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null || !("name" in error)) {
		return undefined;
	}

	const name = (error as { name?: unknown }).name;
	return typeof name === "string" ? name : undefined;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "object" && error !== null && "message" in error) {
		const message = (error as { message?: unknown }).message;
		if (typeof message === "string") {
			return message;
		}
	}

	return "Unknown error";
}

function isRateLimitError(error: unknown): boolean {
	const name = (getErrorName(error) || "").toLowerCase();
	if (
		name.includes("throttl") ||
		name.includes("toomanyrequests") ||
		name.includes("ratelimit") ||
		name.includes("requestlimitexceeded")
	) {
		return true;
	}

	const message = getErrorMessage(error).toLowerCase();
	return (
		message.includes("rate exceeded") ||
		message.includes("too many requests") ||
		message.includes("throttl")
	);
}

function getRetryAfterMs(error: unknown): number | null {
	if (typeof error !== "object" || error === null) {
		return null;
	}

	if ("$retryAfterSeconds" in error) {
		const value = (error as { $retryAfterSeconds?: unknown })
			.$retryAfterSeconds;
		if (typeof value === "number" && Number.isFinite(value) && value > 0) {
			return Math.floor(value * 1_000);
		}
	}

	if ("retryAfterSeconds" in error) {
		const value = (error as { retryAfterSeconds?: unknown }).retryAfterSeconds;
		if (typeof value === "number" && Number.isFinite(value) && value > 0) {
			return Math.floor(value * 1_000);
		}
	}

	if (!("$response" in error)) {
		return null;
	}

	const response = (error as { $response?: unknown }).$response;
	if (typeof response !== "object" || response === null) {
		return null;
	}

	if (!("headers" in response)) {
		return null;
	}

	const headers = (response as { headers?: unknown }).headers;
	if (typeof headers !== "object" || headers === null) {
		return null;
	}

	if (
		"get" in headers &&
		typeof (headers as { get?: unknown }).get === "function"
	) {
		const get = (headers as { get: (key: string) => string | null }).get;
		const value = get("retry-after");
		const parsed = value ? Number.parseFloat(value) : Number.NaN;
		if (Number.isFinite(parsed) && parsed > 0) {
			return Math.floor(parsed * 1_000);
		}
	}

	if ("retry-after" in headers) {
		const value = (headers as { "retry-after"?: unknown })["retry-after"];
		if (typeof value === "string") {
			const parsed = Number.parseFloat(value);
			if (Number.isFinite(parsed) && parsed > 0) {
				return Math.floor(parsed * 1_000);
			}
		}
	}

	return null;
}

function wait(delayMs: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, delayMs);
	});
}

async function waitForRequestSlot(): Promise<void> {
	const now = Date.now();
	if (nextAllowedRequestAtMs > now) {
		await wait(nextAllowedRequestAtMs - now);
	}

	nextAllowedRequestAtMs = Date.now() + minRequestIntervalMs;
}

function getRetryDelayMs(attempt: number): number {
	const exponentialDelay = Math.min(
		maxRetryDelayMs,
		baseRetryDelayMs * 2 ** attempt,
	);
	const jitterMs = Math.floor(Math.random() * 250);
	return exponentialDelay + jitterMs;
}

async function withRateLimitRetry<T>(
	operation: string,
	task: () => Promise<T>,
): Promise<T> {
	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRateRetries; attempt++) {
		try {
			await waitForRequestSlot();
			return await task();
		} catch (error) {
			if (!isRateLimitError(error) || attempt === maxRateRetries) {
				throw error;
			}

			lastError = error;
			const retryAfterMs = getRetryAfterMs(error) ?? 0;
			const delayMs = Math.max(retryAfterMs, getRetryDelayMs(attempt));
			nextAllowedRequestAtMs = Math.max(
				nextAllowedRequestAtMs,
				Date.now() + delayMs,
			);
			console.warn(
				`⚠️ ${operation}: rate exceeded, retry ${attempt + 1}/${maxRateRetries} in ${delayMs}ms`,
			);
			await wait(delayMs);
		}
	}

	throw lastError instanceof Error
		? lastError
		: new Error(`${operation} failed after retry attempts`);
}

function getTenantArn(tenantName: string, tenantId: string): string {
	return `arn:aws:ses:${awsRegion}:${awsAccountId}:tenant/${tenantName}/${tenantId}`;
}

function extractPolicyName(policyArn: string | undefined): string | null {
	if (!policyArn) {
		return null;
	}

	const match = policyArn.match(/reputation-policy\/([^/]+)$/);
	if (match) {
		return match[1];
	}

	return policyArn;
}

async function listAllTenants(): Promise<TenantRef[]> {
	const tenants: TenantRef[] = [];
	const skippedTenantIds = new Set<string>();
	let nextToken: string | undefined;

	do {
		const response = await withRateLimitRetry("ListTenants", async () =>
			sesClient.send(
				new ListTenantsCommand({
					NextToken: nextToken,
					PageSize: 100,
				}),
			),
		);

		for (const tenant of response.Tenants ?? []) {
			if (!tenant.TenantName || !tenant.TenantId) {
				continue;
			}

			if (excludedTenantIds.has(tenant.TenantId)) {
				skippedTenantIds.add(tenant.TenantId);
				continue;
			}

			tenants.push({
				tenantName: tenant.TenantName,
				tenantId: tenant.TenantId,
			});
		}

		nextToken = response.NextToken;
	} while (nextToken);

	if (skippedTenantIds.size > 0) {
		console.log(
			`⏭️ Skipping ${skippedTenantIds.size} excluded tenant(s): ${Array.from(skippedTenantIds).join(", ")}`,
		);
	}

	return tenants;
}

async function getTenantPolicy(
	tenant: TenantRef,
): Promise<TenantPolicySnapshot> {
	const tenantArn = getTenantArn(tenant.tenantName, tenant.tenantId);

	try {
		const response = await withRateLimitRetry(
			`GetReputationEntity(${tenant.tenantName})`,
			async () =>
				sesClient.send(
					new GetReputationEntityCommand({
						ReputationEntityType: "RESOURCE",
						ReputationEntityReference: tenantArn,
					}),
				),
		);

		return {
			...tenant,
			policy: extractPolicyName(
				response.ReputationEntity?.ReputationManagementPolicy,
			),
		};
	} catch (error) {
		const name = getErrorName(error);
		const rateLimited = isRateLimitError(error);
		if (name === "NotFoundException") {
			return {
				...tenant,
				policy: null,
				error: "Reputation entity not found",
				errorType: "other",
			};
		}

		return {
			...tenant,
			policy: null,
			error: getErrorMessage(error),
			errorType: rateLimited ? "rate_limit" : "other",
		};
	}
}

async function setStrictPolicy(
	tenant: TenantRef,
): Promise<{ success: boolean; error?: string }> {
	const tenantArn = getTenantArn(tenant.tenantName, tenant.tenantId);

	try {
		await withRateLimitRetry(
			`UpdateReputationEntityPolicy(${tenant.tenantName})`,
			async () =>
				sesClient.send(
					new UpdateReputationEntityPolicyCommand({
						ReputationEntityType: "RESOURCE",
						ReputationEntityReference: tenantArn,
						ReputationEntityPolicy: strictPolicyArn,
					}),
				),
		);

		return { success: true };
	} catch (error) {
		return {
			success: false,
			error: getErrorMessage(error),
		};
	}
}

function printPolicyDistribution(snapshots: TenantPolicySnapshot[]) {
	const counts: Record<string, number> = {};

	for (const item of snapshots) {
		if (item.error) {
			continue;
		}

		const key = item.policy || "not_set";
		counts[key] = (counts[key] || 0) + 1;
	}

	console.log("\nPolicy distribution:");
	for (const [policy, count] of Object.entries(counts).sort(
		(a, b) => b[1] - a[1],
	)) {
		console.log(`  ${policy}: ${count}`);
	}
}

async function collectPolicySnapshots(
	tenants: TenantRef[],
): Promise<TenantPolicySnapshot[]> {
	const snapshots: TenantPolicySnapshot[] = [];

	for (const tenant of tenants) {
		const snapshot = await getTenantPolicy(tenant);
		snapshots.push(snapshot);
	}

	for (let pass = 1; pass <= transientRecheckPasses; pass++) {
		const unresolved = snapshots.filter(
			(item) => item.error && item.errorType === "rate_limit",
		);

		if (unresolved.length === 0) {
			break;
		}

		console.log(
			`\n🔁 Re-checking ${unresolved.length} rate-limited tenant(s) (pass ${pass}/${transientRecheckPasses})...`,
		);
		await wait(transientRecheckCooldownMs);

		const updates = new Map<string, TenantPolicySnapshot>();
		for (const tenant of unresolved) {
			const refreshed = await getTenantPolicy(tenant);
			updates.set(tenant.tenantId, refreshed);
		}

		for (let index = 0; index < snapshots.length; index++) {
			const updated = updates.get(snapshots[index].tenantId);
			if (updated) {
				snapshots[index] = updated;
			}
		}
	}

	return snapshots;
}

async function main() {
	console.log(
		"═══════════════════════════════════════════════════════════════════",
	);
	console.log("  AWS SES Tenant Reputation Policy Audit + Strict Enforcement");
	console.log(
		"═══════════════════════════════════════════════════════════════════",
	);
	console.log(
		`Mode: ${dryRun ? "DRY RUN (no updates)" : "APPLY (updates enabled)"}`,
	);
	console.log(`AWS Region: ${awsRegion}`);
	console.log(`AWS Account: ${awsAccountId}`);
	console.log();

	const tenants = await listAllTenants();
	console.log(`📋 Found ${tenants.length} tenant(s) in AWS SES`);

	if (tenants.length === 0) {
		console.log("✅ No tenants found - nothing to update");
		return;
	}

	console.log("\n🔍 Querying current reputation policies...");
	const snapshots = await collectPolicySnapshots(tenants);

	const unresolved = snapshots.filter((item) => Boolean(item.error));
	const nonStrict = snapshots.filter(
		(item) => !item.error && item.policy !== "strict",
	);
	const strictCount = snapshots.filter(
		(item) => !item.error && item.policy === "strict",
	).length;

	printPolicyDistribution(snapshots);

	console.log("\nSummary before update:");
	console.log(`  Strict: ${strictCount}`);
	console.log(`  Not strict: ${nonStrict.length}`);
	console.log(`  Unresolved (errors): ${unresolved.length}`);

	if (unresolved.length > 0) {
		console.log("\nUnresolved tenants (errors):");
		for (const tenant of unresolved) {
			console.log(
				`  - ${tenant.tenantName} (${tenant.tenantId}): ${tenant.error || "Unknown error"}`,
			);
		}
	}

	if (nonStrict.length === 0) {
		console.log("\n✅ All tenants are already set to strict");
		if (unresolved.length > 0) {
			process.exitCode = 1;
		}
		return;
	}

	console.log("\nTenants not strict:");
	for (const tenant of nonStrict) {
		const label = tenant.policy || "not_set";
		const extra = tenant.error ? ` (${tenant.error})` : "";
		console.log(
			`  - ${tenant.tenantName} (${tenant.tenantId}): ${label}${extra}`,
		);
	}

	if (dryRun) {
		console.log(
			"\nDry run complete. Re-run without --dry-run to update them to strict.",
		);
		if (unresolved.length > 0) {
			console.log(
				"⚠️ Some tenants could not be evaluated due to transient/persistent errors.",
			);
			process.exitCode = 1;
		}
		return;
	}

	console.log("\n🔄 Updating non-strict tenants to strict...");
	let updated = 0;
	let failed = 0;

	for (const tenant of nonStrict) {
		const result = await setStrictPolicy(tenant);
		if (result.success) {
			updated++;
			console.log(`  ✅ ${tenant.tenantName} updated to strict`);
		} else {
			failed++;
			console.log(
				`  ❌ ${tenant.tenantName} failed to update: ${result.error || "Unknown error"}`,
			);
		}
	}

	console.log("\nFinal update summary:");
	console.log(`  Updated: ${updated}`);
	console.log(`  Failed: ${failed}`);
	console.log(`  Total attempted: ${nonStrict.length}`);

	if (failed > 0) {
		process.exitCode = 1;
	}

	if (unresolved.length > 0) {
		console.log(
			"⚠️ Some tenants could not be evaluated and were skipped during updates.",
		);
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error("❌ Script failed:", getErrorMessage(error));
	process.exit(1);
});
