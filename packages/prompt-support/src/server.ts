import { Daytona, type Sandbox } from "@daytonaio/sdk";
import {
	createOpencodeClient,
	type Part,
	type PermissionRuleset,
} from "@opencode-ai/sdk/v2/client";
import Inbound, {
	type InboundWebhookPayload,
	verifyWebhookFromHeaders,
} from "inboundemail";

type RuntimeEnv = Record<string, string | undefined>;

type ExecutionContextLike = {
	waitUntil(promise: Promise<unknown>): void;
};

type ModelSelection = {
	providerID: string;
	modelID: string;
};

type GithubRepo = {
	owner: string;
	repo: string;
};

type PromptSupportConfig = {
	inboundApiKey: string;
	daytonaApiKey: string;
	daytonaApiUrl?: string;
	daytonaTarget?: string;
	githubToken: string;
	opencodeZenKey?: string;
	repoUrl: string;
	repoBaseBranch: string;
	replyFrom?: string;
	verifyWebhook: boolean;
	keepSandbox: boolean;
	opencodePort: number;
	opencodeStartTimeoutSeconds: number;
	model: ModelSelection;
	gitAuthorName: string;
	gitAuthorEmail: string;
	githubRepo: GithubRepo;
	githubPrBaseRepo: GithubRepo;
};

type AgentStructuredResult = {
	status: "ready_for_pr" | "needs_human_review" | "failed";
	prTitle?: string;
	prBody?: string;
	commitMessage?: string;
	emailReply?: string;
	summary?: string;
};

type AgentRunResult = {
	structured: AgentStructuredResult | null;
	rawText: string;
};

type WorkflowResult = {
	emailId: string;
	sandboxId: string;
	branchName: string;
	prUrl: string | null;
	replyText: string;
};

type OpencodeEndpoint = {
	baseUrl: string;
	previewFetch: typeof fetch;
	hasAuthParams: boolean;
};

type LogLevel = "debug" | "info" | "warn" | "error";

type Logger = {
	child(fields: Record<string, unknown>): Logger;
	debug(event: string, fields?: Record<string, unknown>): void;
	info(event: string, fields?: Record<string, unknown>): void;
	warn(event: string, fields?: Record<string, unknown>): void;
	error(event: string, fields?: Record<string, unknown>): void;
};

class HttpError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

const jsonResponse = (status: number, body: unknown) =>
	new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json; charset=utf-8",
		},
	});

const wait = (ms: number) =>
	new Promise<void>((resolve) => {
		setTimeout(resolve, ms);
	});

const shellEscape = (value: string) => `'${value.replace(/'/g, `'"'"'`)}'`;

const requireClientData = <T>(result: { data?: T }, errorMessage: string) => {
	if (!result.data) {
		throw new Error(errorMessage);
	}

	return result.data;
};

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

const getDurationMs = (startedAt: number) => Date.now() - startedAt;

const normalizeError = (error: unknown) => {
	if (error instanceof Error) {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
		};
	}

	return {
		message: String(error),
	};
};

const logReplacer = (_key: string, value: unknown) => {
	if (value instanceof Error) {
		return normalizeError(value);
	}

	if (typeof value === "bigint") {
		return value.toString();
	}

	return value;
};

const resolveLogLevel = (env: RuntimeEnv): LogLevel => {
	const configured = (
		readEnv(env, "PROMPT_SUPPORT_LOG_LEVEL") ??
		readEnv(env, "LOG_LEVEL") ??
		"info"
	)
		.trim()
		.toLowerCase();

	if (
		configured === "debug" ||
		configured === "info" ||
		configured === "warn" ||
		configured === "error"
	) {
		return configured;
	}

	return "info";
};

const createLogger = (
	minimumLevel: LogLevel,
	context: Record<string, unknown> = {},
): Logger => {
	const write = (
		level: LogLevel,
		event: string,
		fields: Record<string, unknown> = {},
	) => {
		if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minimumLevel]) {
			return;
		}

		const entry = {
			ts: new Date().toISOString(),
			level,
			event,
			...context,
			...fields,
		};

		let line: string;

		try {
			line = JSON.stringify(entry, logReplacer);
		} catch {
			line = JSON.stringify({
				ts: entry.ts,
				level: "error",
				event: "logger.serialization_failed",
				requestId: context.requestId,
			});
		}

		console.log(line);
	};

	return {
		child(fields: Record<string, unknown>) {
			return createLogger(minimumLevel, { ...context, ...fields });
		},
		debug(event: string, fields: Record<string, unknown> = {}) {
			write("debug", event, fields);
		},
		info(event: string, fields: Record<string, unknown> = {}) {
			write("info", event, fields);
		},
		warn(event: string, fields: Record<string, unknown> = {}) {
			write("warn", event, fields);
		},
		error(event: string, fields: Record<string, unknown> = {}) {
			write("error", event, fields);
		},
	};
};

const withStage = async <T>(
	logger: Logger,
	event: string,
	task: () => Promise<T>,
	fields: Record<string, unknown> = {},
): Promise<T> => {
	const startedAt = Date.now();
	logger.info(`${event}.start`, fields);

	try {
		const result = await task();
		logger.info(`${event}.success`, {
			...fields,
			durationMs: getDurationMs(startedAt),
		});
		return result;
	} catch (error) {
		logger.error(`${event}.error`, {
			...fields,
			durationMs: getDurationMs(startedAt),
			error: normalizeError(error),
		});
		throw error;
	}
};

const createRequestId = () => {
	if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
		return crypto.randomUUID();
	}

	return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const PREVIEW_AUTH_QUERY_PARAM = "DAYTONA_SANDBOX_AUTH_KEY";

const createPreviewFetch = (queryParams: URLSearchParams): typeof fetch => {
	const previewFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = input instanceof Request ? input : new Request(input, init);
		const url = new URL(request.url);

		for (const [key, value] of queryParams.entries()) {
			if (!url.searchParams.has(key)) {
				url.searchParams.set(key, value);
			}
		}

		const nextRequest = new Request(url.toString(), request);
		return fetch(nextRequest);
	};

	return previewFetch as typeof fetch;
};

const createOpencodeEndpoint = (previewUrl: string, previewToken?: string) => {
	const parsed = new URL(previewUrl);
	const queryParams = new URLSearchParams(parsed.search);

	if (
		previewToken &&
		previewToken.trim().length > 0 &&
		!queryParams.has(PREVIEW_AUTH_QUERY_PARAM)
	) {
		queryParams.set(PREVIEW_AUTH_QUERY_PARAM, previewToken.trim());
	}

	parsed.search = "";
	const baseUrl = parsed.toString().replace(/\/+$/, "");

	return {
		baseUrl,
		previewFetch: createPreviewFetch(queryParams),
		hasAuthParams: Array.from(queryParams.keys()).length > 0,
	};
};

const truncateForLog = (value: string | undefined, maxLength = 1200) => {
	if (!value) {
		return "";
	}

	if (value.length <= maxLength) {
		return value;
	}

	return `${value.slice(0, maxLength)}...[truncated ${value.length - maxLength} chars]`;
};

const redactSecrets = (value: string, secrets: Array<string | undefined>) => {
	let redacted = value;

	for (const secret of secrets) {
		if (!secret || secret.length < 6) {
			continue;
		}

		redacted = redacted.split(secret).join("[REDACTED]");
	}

	return redacted;
};

const toRuntimeEnv = (env?: unknown): RuntimeEnv => {
	const runtime: RuntimeEnv = {};

	if (!env || typeof env !== "object") {
		return runtime;
	}

	for (const [key, value] of Object.entries(env)) {
		if (typeof value === "string") {
			runtime[key] = value;
		}
	}

	return runtime;
};

const readEnv = (env: RuntimeEnv, key: string): string | undefined => {
	if (env[key]) {
		return env[key];
	}

	if (typeof process !== "undefined") {
		return process.env[key];
	}

	return undefined;
};

const readEnvAny = (env: RuntimeEnv, keys: string[]): string | undefined => {
	for (const key of keys) {
		const value = readEnv(env, key);
		if (value && value.trim().length > 0) {
			return value.trim();
		}
	}

	return undefined;
};

const parseBooleanEnv = (value: string | undefined, defaultValue: boolean) => {
	if (!value) {
		return defaultValue;
	}

	const normalized = value.trim().toLowerCase();

	if (["1", "true", "yes", "on"].includes(normalized)) {
		return true;
	}

	if (["0", "false", "no", "off"].includes(normalized)) {
		return false;
	}

	return defaultValue;
};

const parseIntegerEnv = (
	value: string | undefined,
	defaultValue: number,
	minimum = 1,
) => {
	if (!value) {
		return defaultValue;
	}

	const parsed = Number.parseInt(value, 10);

	if (!Number.isFinite(parsed) || parsed < minimum) {
		return defaultValue;
	}

	return parsed;
};

const parseModelSelection = (rawModel: string): ModelSelection => {
	const trimmed = rawModel.trim();
	const delimiter = trimmed.indexOf("/");

	if (delimiter <= 0 || delimiter === trimmed.length - 1) {
		return {
			providerID: "opencode",
			modelID: trimmed,
		};
	}

	return {
		providerID: trimmed.slice(0, delimiter),
		modelID: trimmed.slice(delimiter + 1),
	};
};

const parseGithubRepo = (repoUrl: string): GithubRepo => {
	if (repoUrl.startsWith("git@github.com:")) {
		const repository = repoUrl
			.slice("git@github.com:".length)
			.replace(/\.git$/, "");
		const [owner, repo] = repository.split("/");

		if (!owner || !repo) {
			throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
		}

		return { owner, repo };
	}

	const parsed = new URL(repoUrl);

	if (parsed.hostname !== "github.com") {
		throw new Error(
			`PROMPT_SUPPORT_REPO_URL must target github.com, got ${parsed.hostname}`,
		);
	}

	const parts = parsed.pathname
		.replace(/^\//, "")
		.replace(/\.git$/, "")
		.split("/");
	const owner = parts[0];
	const repo = parts[1];

	if (!owner || !repo) {
		throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
	}

	return { owner, repo };
};

const parseGithubRepoRef = (repoRef: string): GithubRepo => {
	const normalized = repoRef.trim();

	if (normalized.length === 0) {
		throw new Error("GitHub repo reference cannot be empty");
	}

	if (
		normalized.startsWith("https://") ||
		normalized.startsWith("http://") ||
		normalized.startsWith("git@github.com:")
	) {
		return parseGithubRepo(normalized);
	}

	const [owner, repo] = normalized.replace(/\.git$/, "").split("/");

	if (!owner || !repo) {
		throw new Error(
			`Invalid GitHub repository reference: ${repoRef}. Expected owner/repo or full GitHub URL.`,
		);
	}

	return { owner, repo };
};

const buildAuthenticatedGithubUrl = (repoUrl: string, githubToken: string) => {
	if (repoUrl.startsWith("git@github.com:")) {
		const repository = repoUrl.slice("git@github.com:".length);
		return `https://x-access-token:${githubToken}@github.com/${repository}`;
	}

	const parsed = new URL(repoUrl);
	parsed.username = "x-access-token";
	parsed.password = githubToken;

	return parsed.toString();
};

const getConfig = (env: RuntimeEnv): PromptSupportConfig => {
	const inboundApiKey = readEnvAny(env, [
		"INBOUND_API_KEY",
		"INBOUND_EMAIL_API_KEY",
	]);
	const daytonaApiKey = readEnvAny(env, [
		"DAYTONA_API_KEY",
		"DAYTONA_API_TOKEN",
	]);
	const githubToken = readEnvAny(env, [
		"GITHUB_TOKEN",
		"GITHUB_API_KEY",
		"GH_TOKEN",
		"GITHUB_PAT",
	]);
	const opencodeZenKey = readEnvAny(env, [
		"OPENCODE_ZEN_KEY",
		"OPENCODE_API_KEY",
		"OPENCODE_ZEN_API_KEY",
		"OPENCODEZEN_KEY",
	]);
	const repoUrl =
		readEnv(env, "PROMPT_SUPPORT_REPO_URL") ??
		"https://github.com/inbound-org/inbound.git";
	const prBaseRepoRef = readEnv(env, "PROMPT_SUPPORT_PR_BASE_REPO") ?? repoUrl;

	if (!inboundApiKey) {
		throw new HttpError(
			500,
			"Missing Inbound API key (set INBOUND_API_KEY or INBOUND_EMAIL_API_KEY)",
		);
	}

	if (!daytonaApiKey) {
		throw new HttpError(
			500,
			"Missing Daytona API key (set DAYTONA_API_KEY or DAYTONA_API_TOKEN)",
		);
	}

	if (!githubToken) {
		throw new HttpError(
			500,
			"Missing GitHub token (set GITHUB_TOKEN, GITHUB_API_KEY, GH_TOKEN, or GITHUB_PAT)",
		);
	}

	let githubRepo: GithubRepo;
	let githubPrBaseRepo: GithubRepo;

	try {
		githubRepo = parseGithubRepo(repoUrl);
		githubPrBaseRepo = parseGithubRepoRef(prBaseRepoRef);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Invalid repository URL";
		throw new HttpError(500, message);
	}

	return {
		inboundApiKey,
		daytonaApiKey,
		daytonaApiUrl: readEnv(env, "DAYTONA_API_URL"),
		daytonaTarget: readEnv(env, "DAYTONA_TARGET"),
		githubToken,
		opencodeZenKey,
		repoUrl,
		repoBaseBranch: readEnv(env, "PROMPT_SUPPORT_REPO_BRANCH") ?? "main",
		replyFrom: readEnv(env, "PROMPT_SUPPORT_REPLY_FROM"),
		verifyWebhook: parseBooleanEnv(
			readEnv(env, "INBOUND_WEBHOOK_VERIFY"),
			true,
		),
		keepSandbox: parseBooleanEnv(
			readEnv(env, "PROMPT_SUPPORT_KEEP_SANDBOX"),
			false,
		),
		opencodePort: parseIntegerEnv(
			readEnv(env, "PROMPT_SUPPORT_OPENCODE_PORT"),
			4096,
		),
		opencodeStartTimeoutSeconds: parseIntegerEnv(
			readEnv(env, "PROMPT_SUPPORT_OPENCODE_START_TIMEOUT_SECONDS"),
			420,
		),
		model: parseModelSelection(
			readEnv(env, "OPENCODE_MODEL") ?? "opencode/claude-sonnet-4-5",
		),
		gitAuthorName:
			readEnv(env, "PROMPT_SUPPORT_GIT_AUTHOR_NAME") ??
			"Inbound Prompt Support",
		gitAuthorEmail:
			readEnv(env, "PROMPT_SUPPORT_GIT_AUTHOR_EMAIL") ??
			"prompt-support@inbound.new",
		githubRepo,
		githubPrBaseRepo,
	};
};

const isInboundWebhookPayload = (
	value: unknown,
): value is InboundWebhookPayload => {
	if (!value || typeof value !== "object") {
		return false;
	}

	const payload = value as {
		event?: unknown;
		email?: {
			id?: unknown;
			subject?: unknown;
			recipient?: unknown;
			parsedData?: {
				textBody?: unknown;
			};
			cleanedContent?: {
				text?: unknown;
			};
		};
	};

	if (payload.event !== "email.received") {
		return false;
	}

	if (!payload.email || typeof payload.email !== "object") {
		return false;
	}

	if (typeof payload.email.id !== "string") {
		return false;
	}

	if (typeof payload.email.subject !== "string") {
		return false;
	}

	if (typeof payload.email.recipient !== "string") {
		return false;
	}

	return true;
};

const extractIssuePrompt = (payload: InboundWebhookPayload) => {
	const cleanText = payload.email.cleanedContent.text;
	const parsedText = payload.email.parsedData.textBody;

	if (cleanText && cleanText.trim().length > 0) {
		return cleanText.trim();
	}

	if (parsedText && parsedText.trim().length > 0) {
		return parsedText.trim();
	}

	return payload.email.subject;
};

const nonEmptyString = (value: string | null | undefined) => {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};

const selectReplyFromAddress = (
	payload: InboundWebhookPayload,
	config: PromptSupportConfig,
) => {
	const explicit = nonEmptyString(config.replyFrom);
	if (explicit) {
		return explicit;
	}

	const recipient = nonEmptyString(payload.email.recipient);
	if (recipient) {
		return recipient;
	}

	for (const address of payload.email.to.addresses) {
		const candidate = nonEmptyString(address.address);
		if (candidate) {
			return candidate;
		}
	}

	return undefined;
};

const requireReplyFromAddress = (
	payload: InboundWebhookPayload,
	config: PromptSupportConfig,
) => {
	const replyFrom = selectReplyFromAddress(payload, config);

	if (replyFrom) {
		return replyFrom;
	}

	throw new Error(
		"Unable to determine reply-from address (set PROMPT_SUPPORT_REPLY_FROM or ensure inbound recipient/to addresses are populated)",
	);
};

const buildBranchName = (emailId: string) => {
	const suffix = emailId
		.replace(/[^a-zA-Z0-9-]/g, "-")
		.toLowerCase()
		.slice(-20);
	const timestamp = Date.now().toString(36);

	return `inbound/${timestamp}-${suffix}`;
};

const runSandboxCommand = async (
	sandbox: Sandbox,
	command: string,
	cwd?: string,
	env?: Record<string, string>,
	timeoutSeconds = 120,
) => {
	const result = await sandbox.process.executeCommand(
		command,
		cwd,
		env,
		timeoutSeconds,
	);

	if (result.exitCode !== 0) {
		throw new Error(
			`Sandbox command failed: ${command}\n${result.result.trim() || "No output"}`,
		);
	}

	return result.result;
};

const ensureGitIdentity = async (
	sandbox: Sandbox,
	repoPath: string,
	config: PromptSupportConfig,
) => {
	await runSandboxCommand(
		sandbox,
		`git config user.name ${shellEscape(config.gitAuthorName)}`,
		repoPath,
	);
	await runSandboxCommand(
		sandbox,
		`git config user.email ${shellEscape(config.gitAuthorEmail)}`,
		repoPath,
	);
};

const setupRepository = async (
	sandbox: Sandbox,
	config: PromptSupportConfig,
	branchName: string,
) => {
	const workDir =
		(await sandbox.getWorkDir()) ??
		(await sandbox.getUserHomeDir()) ??
		"/home/daytona";
	const repoPath = `${workDir}/prompt-support-repo`;
	const authenticatedRepoUrl = buildAuthenticatedGithubUrl(
		config.repoUrl,
		config.githubToken,
	);

	await sandbox.git.clone(
		authenticatedRepoUrl,
		repoPath,
		config.repoBaseBranch,
	);
	await ensureGitIdentity(sandbox, repoPath, config);
	await runSandboxCommand(
		sandbox,
		`git checkout -b ${shellEscape(branchName)}`,
		repoPath,
	);

	return repoPath;
};

const getSessionCommandDiagnostics = async (
	sandbox: Sandbox,
	sessionID: string,
	commandID: string,
	config: PromptSupportConfig,
) => {
	let exitCode: number | null = null;
	let stdout = "";
	let stderr = "";

	try {
		const command = await sandbox.process.getSessionCommand(
			sessionID,
			commandID,
		);
		if (typeof command.exitCode === "number") {
			exitCode = command.exitCode;
		}
	} catch {}

	try {
		const logs = await sandbox.process.getSessionCommandLogs(
			sessionID,
			commandID,
		);
		stdout = logs.stdout ?? logs.output ?? "";
		stderr = logs.stderr ?? "";
	} catch {}

	const secrets = [
		config.githubToken,
		config.opencodeZenKey,
		config.daytonaApiKey,
		config.inboundApiKey,
	];

	return {
		exitCode,
		stdout: truncateForLog(redactSecrets(stdout, secrets)),
		stderr: truncateForLog(redactSecrets(stderr, secrets)),
	};
};

const waitForOpencodeServer = async (
	endpoint: OpencodeEndpoint,
	repoPath: string,
	sandbox: Sandbox,
	sessionID: string,
	commandID: string,
	config: PromptSupportConfig,
	logger: Logger,
) => {
	const startedAt = Date.now();
	const pollIntervalMs = 2_000;
	const maxAttempts = Math.max(
		1,
		Math.ceil((config.opencodeStartTimeoutSeconds * 1_000) / pollIntervalMs),
	);

	const healthClient = createOpencodeClient({
		baseUrl: endpoint.baseUrl,
		directory: repoPath,
		fetch: endpoint.previewFetch,
	});

	let lastHealthError: string | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const response = await healthClient.global.health();

			if (response.data) {
				logger.info("opencode.health.ready", {
					attempt,
					maxAttempts,
					durationMs: getDurationMs(startedAt),
				});
				return;
			}

			const status = response.response?.status;
			const errorText =
				typeof response.error === "string"
					? response.error
					: response.error
						? JSON.stringify(response.error)
						: "unknown response error";

			lastHealthError = status
				? `HTTP ${status}: ${truncateForLog(errorText, 280)}`
				: truncateForLog(errorText, 280);
		} catch (error) {
			lastHealthError = truncateForLog(
				error instanceof Error ? error.message : String(error),
				280,
			);
		}

		if (attempt === 1 || attempt % 15 === 0) {
			logger.info("opencode.health.retry", {
				attempt,
				maxAttempts,
				lastHealthError,
			});
		}

		if (attempt === 1 || attempt % 5 === 0) {
			const diagnostics = await getSessionCommandDiagnostics(
				sandbox,
				sessionID,
				commandID,
				config,
			);

			if (typeof diagnostics.exitCode === "number") {
				throw new Error(
					`OpenCode server command exited with code ${diagnostics.exitCode}. stderr=${diagnostics.stderr || "<empty>"} stdout=${diagnostics.stdout || "<empty>"}`,
				);
			}
		}

		await wait(pollIntervalMs);
	}

	const timeoutDiagnostics = await getSessionCommandDiagnostics(
		sandbox,
		sessionID,
		commandID,
		config,
	);

	throw new Error(
		`Timed out waiting for OpenCode server inside Daytona sandbox after ${config.opencodeStartTimeoutSeconds}s. lastHealthError=${lastHealthError ?? "none"} commandExitCode=${timeoutDiagnostics.exitCode ?? "running"} stderr=${timeoutDiagnostics.stderr || "<empty>"} stdout=${timeoutDiagnostics.stdout || "<empty>"}`,
	);
};

const startOpencodeInSandbox = async (
	sandbox: Sandbox,
	repoPath: string,
	config: PromptSupportConfig,
	logger: Logger,
) => {
	const opencodeBootstrapOutput = await runSandboxCommand(
		sandbox,
		"if command -v opencode >/dev/null 2>&1; then opencode --version; else npm install -g opencode-ai && opencode --version; fi",
		undefined,
		undefined,
		600,
	);

	logger.info("opencode.binary.ready", {
		output: truncateForLog(opencodeBootstrapOutput, 400),
	});

	const sessionID = `opencode-${Date.now()}`;
	await sandbox.process.createSession(sessionID);

	const exports: string[] = [
		`export GITHUB_TOKEN=${shellEscape(config.githubToken)}`,
	];

	if (config.opencodeZenKey) {
		exports.push(
			`export OPENCODE_ZEN_KEY=${shellEscape(config.opencodeZenKey)}`,
		);
		exports.push(
			`export OPENCODE_API_KEY=${shellEscape(config.opencodeZenKey)}`,
		);
	}

	const serveCommand = [
		...exports,
		`cd ${shellEscape(repoPath)}`,
		`if command -v opencode >/dev/null 2>&1; then opencode serve --hostname 0.0.0.0 --port ${config.opencodePort} --print-logs; else npx -y opencode-ai serve --hostname 0.0.0.0 --port ${config.opencodePort} --print-logs; fi`,
	].join(" && ");

	const execution = await sandbox.process.executeSessionCommand(sessionID, {
		command: serveCommand,
		runAsync: true,
	});
	const commandID = execution.cmdId;

	const preview = await sandbox.getSignedPreviewUrl(config.opencodePort, 7_200);
	const endpoint = createOpencodeEndpoint(preview.url, preview.token);

	logger.info("opencode.endpoint.prepared", {
		sessionID,
		commandID,
		host: new URL(endpoint.baseUrl).host,
		hasAuthParams: endpoint.hasAuthParams,
		startTimeoutSeconds: config.opencodeStartTimeoutSeconds,
	});

	await waitForOpencodeServer(
		endpoint,
		repoPath,
		sandbox,
		sessionID,
		commandID,
		config,
		logger,
	);

	return endpoint;
};

const buildAgentPrompt = (
	payload: InboundWebhookPayload,
	branchName: string,
	baseBranch: string,
) => {
	const issueText = extractIssuePrompt(payload);

	return [
		"You are an autonomous software engineer working in a fresh git branch.",
		"",
		`Current branch: ${branchName}`,
		`Base branch: ${baseBranch}`,
		"",
		"Task:",
		"1. Read the issue details from the inbound email below.",
		"2. Implement the fix in the current repository.",
		"3. Run relevant tests and checks for the changed code.",
		"4. Commit all changes with a concise commit message.",
		"5. Do not push or open a PR; the orchestrator will do that.",
		"6. Do not ask questions. Pick a safe, reasonable default if needed.",
		"",
		"Inbound email:",
		`Subject: ${payload.email.subject}`,
		`From: ${payload.email.from.text}`,
		"",
		issueText,
		"",
		"When done, return structured JSON with:",
		"- status: ready_for_pr | needs_human_review | failed",
		"- prTitle",
		"- prBody",
		"- commitMessage",
		"- emailReply",
		"- summary",
		"",
		"If successful, emailReply should include this sentiment:",
		"Hey, this was a great catch. I've implemented this as a new PR and I will tag Ryan once he gets up.",
	].join("\n");
};

const parseAgentStructuredResult = (
	structured: unknown,
): AgentStructuredResult | null => {
	if (!structured || typeof structured !== "object") {
		return null;
	}

	const value = structured as Record<string, unknown>;
	const status = value.status;

	if (
		status !== "ready_for_pr" &&
		status !== "needs_human_review" &&
		status !== "failed"
	) {
		return null;
	}

	const optionalString = (field: string) => {
		const entry = value[field];
		return typeof entry === "string" && entry.trim().length > 0
			? entry.trim()
			: undefined;
	};

	return {
		status,
		prTitle: optionalString("prTitle"),
		prBody: optionalString("prBody"),
		commitMessage: optionalString("commitMessage"),
		emailReply: optionalString("emailReply"),
		summary: optionalString("summary"),
	};
};

const collectTextParts = (parts: Part[]) =>
	parts
		.filter(
			(part): part is Extract<Part, { type: "text" }> => part.type === "text",
		)
		.map((part) => part.text)
		.join("\n")
		.trim();

const runOpencodeAgent = async (
	endpoint: OpencodeEndpoint,
	repoPath: string,
	payload: InboundWebhookPayload,
	config: PromptSupportConfig,
	branchName: string,
): Promise<AgentRunResult> => {
	const client = createOpencodeClient({
		baseUrl: endpoint.baseUrl,
		directory: repoPath,
		fetch: endpoint.previewFetch,
		throwOnError: true,
	});

	if (config.opencodeZenKey) {
		try {
			await client.auth.set({
				providerID: config.model.providerID,
				auth: {
					type: "api",
					key: config.opencodeZenKey,
				},
			});
		} catch {}
	}

	const permission: PermissionRuleset = [
		{
			permission: "*",
			pattern: "*",
			action: "allow",
		},
	];

	const sessionResult = await client.session.create({
		title: `Inbound: ${payload.email.subject.slice(0, 80)}`,
		permission,
	});
	const sessionData = requireClientData(
		sessionResult,
		"OpenCode session create did not return data",
	);

	const sessionID = sessionData.id;

	const promptResult = await client.session.prompt({
		sessionID,
		model: {
			providerID: config.model.providerID,
			modelID: config.model.modelID,
		},
		format: {
			type: "json_schema",
			retryCount: 2,
			schema: {
				type: "object",
				properties: {
					status: {
						type: "string",
						enum: ["ready_for_pr", "needs_human_review", "failed"],
					},
					prTitle: { type: "string" },
					prBody: { type: "string" },
					commitMessage: { type: "string" },
					emailReply: { type: "string" },
					summary: { type: "string" },
				},
				required: ["status", "summary", "emailReply"],
				additionalProperties: false,
			},
		},
		parts: [
			{
				type: "text",
				text: buildAgentPrompt(payload, branchName, config.repoBaseBranch),
			},
		],
	});
	const promptData = requireClientData(
		promptResult,
		"OpenCode prompt did not return data",
	);

	return {
		structured: parseAgentStructuredResult(promptData.info.structured),
		rawText: collectTextParts(promptData.parts),
	};
};

const normalizeCommitMessage = (message: string | undefined) => {
	if (!message || message.trim().length === 0) {
		return "fix: resolve inbound issue report";
	}

	const singleLine = message.replace(/\s+/g, " ").trim();
	return singleLine.slice(0, 120);
};

const buildDefaultPrTitle = () => "chore: automated prompt-support update";

const buildDefaultPrBody = () => {
	return [
		"## Summary",
		"- Automated code update generated by prompt-support workflow.",
		"",
		"## Notes",
		"- Produced in a Daytona sandbox and prepared by OpenCode automation.",
		"- Please review and run normal CI checks before merge.",
	].join("\n");
};

const createGithubPullRequest = async (
	config: PromptSupportConfig,
	branchName: string,
	title: string,
	body: string,
) => {
	const endpoint = `https://api.github.com/repos/${config.githubPrBaseRepo.owner}/${config.githubPrBaseRepo.repo}/pulls`;
	const headRef = `${config.githubRepo.owner}:${branchName}`;

	const request = await fetch(endpoint, {
		method: "POST",
		headers: {
			accept: "application/vnd.github+json",
			authorization: `Bearer ${config.githubToken}`,
			"content-type": "application/json",
			"x-github-api-version": "2022-11-28",
		},
		body: JSON.stringify({
			title,
			head: headRef,
			base: config.repoBaseBranch,
			body,
		}),
	});

	if (request.status === 201) {
		const result = (await request.json()) as { html_url: string };
		return result.html_url;
	}

	if (request.status === 422) {
		const existing = await fetch(
			`${endpoint}?head=${encodeURIComponent(headRef)}&state=open`,
			{
				headers: {
					accept: "application/vnd.github+json",
					authorization: `Bearer ${config.githubToken}`,
					"x-github-api-version": "2022-11-28",
				},
			},
		);

		if (existing.ok) {
			const pulls = (await existing.json()) as Array<{ html_url?: string }>;
			if (pulls[0]?.html_url) {
				return pulls[0].html_url;
			}
		}
	}

	const failureBody = await request.text();
	throw new Error(
		`Failed creating GitHub PR: ${request.status} ${request.statusText} ${failureBody}`,
	);
};

const pushBranchAndOpenPr = async (
	sandbox: Sandbox,
	repoPath: string,
	config: PromptSupportConfig,
	branchName: string,
	agentResult: AgentRunResult,
) => {
	const statusOutput = await runSandboxCommand(
		sandbox,
		"git status --porcelain",
		repoPath,
	);

	if (statusOutput.trim().length > 0) {
		await runSandboxCommand(sandbox, "git add -A", repoPath);

		const fallbackCommitMessage = normalizeCommitMessage(
			agentResult.structured?.commitMessage,
		);

		await runSandboxCommand(
			sandbox,
			`git commit -m ${shellEscape(fallbackCommitMessage)}`,
			repoPath,
		);
	}

	const aheadCountOutput = await runSandboxCommand(
		sandbox,
		`git rev-list --count ${shellEscape(`${config.repoBaseBranch}..HEAD`)}`,
		repoPath,
	);

	const aheadCount = Number.parseInt(aheadCountOutput.trim(), 10);

	if (!Number.isFinite(aheadCount) || aheadCount <= 0) {
		return null;
	}

	await runSandboxCommand(
		sandbox,
		`git push -u origin ${shellEscape(branchName)}`,
		repoPath,
		undefined,
		600,
	);

	const prTitle = buildDefaultPrTitle();
	const prBody = buildDefaultPrBody();

	return createGithubPullRequest(config, branchName, prTitle, prBody);
};

const buildReplyText = (prUrl: string | null, agentResult: AgentRunResult) => {
	if (!prUrl) {
		return "Thanks for the report. I reviewed the request but could not safely produce a PR automatically. I will flag this for Ryan to review when he is online.";
	}

	if (agentResult.structured?.emailReply) {
		return `${agentResult.structured.emailReply}\n\nPR: ${prUrl}`;
	}

	return `Hey, this was a great catch. I've implemented this as a new PR: ${prUrl}. I will tag Ryan once he gets up.`;
};

const buildFailureReply = (error: unknown) => {
	const fallback =
		"Thanks for the report. I hit an issue while creating the automated fix, so no PR was opened yet. I will tag Ryan to review this as soon as he is online.";

	if (!(error instanceof Error)) {
		return fallback;
	}

	const reason = error.message.trim();

	if (!reason) {
		return fallback;
	}

	return `${fallback}\n\nError: ${reason}`;
};

const buildReplySubject = (subject: string) =>
	/^\s*re:/i.test(subject) ? subject : `Re: ${subject}`;

const sendReplyEmail = async (
	inboundClient: Inbound,
	payload: InboundWebhookPayload,
	from: string,
	text: string,
) => {
	await inboundClient.emails.reply(payload.email.id, {
		from,
		subject: buildReplySubject(payload.email.subject),
		text,
		reply_all: true,
	});
};

const executePromptSupportWorkflow = async (
	payload: InboundWebhookPayload,
	config: PromptSupportConfig,
	logger: Logger,
): Promise<WorkflowResult> => {
	const workflowStartedAt = Date.now();
	const inboundClient = new Inbound({ apiKey: config.inboundApiKey });
	const replyFrom = requireReplyFromAddress(payload, config);

	const daytona = new Daytona({
		apiKey: config.daytonaApiKey,
		apiUrl: config.daytonaApiUrl,
		target: config.daytonaTarget,
	});

	let sandbox: Sandbox | null = null;
	const branchName = buildBranchName(payload.email.id);
	const workflowLogger = logger.child({
		workflow: "prompt-support",
		branchName,
	});

	workflowLogger.info("workflow.start", {
		sourceRepo: `${config.githubRepo.owner}/${config.githubRepo.repo}`,
		prBaseRepo: `${config.githubPrBaseRepo.owner}/${config.githubPrBaseRepo.repo}`,
		baseBranch: config.repoBaseBranch,
		verifyWebhook: config.verifyWebhook,
		keepSandbox: config.keepSandbox,
		model: `${config.model.providerID}/${config.model.modelID}`,
	});

	try {
		sandbox = await withStage(
			workflowLogger,
			"daytona.sandbox.create",
			() =>
				daytona.create({
					name: `prompt-support-${Date.now().toString(36)}`,
					language: "typescript",
					ephemeral: !config.keepSandbox,
					autoDeleteInterval: config.keepSandbox ? -1 : 0,
					envVars: {
						GITHUB_TOKEN: config.githubToken,
						OPENCODE_ZEN_KEY: config.opencodeZenKey ?? "",
						OPENCODE_API_KEY: config.opencodeZenKey ?? "",
					},
				}),
			{
				ephemeral: !config.keepSandbox,
				autoDeleteInterval: config.keepSandbox ? -1 : 0,
			},
		);
		const createdSandbox = sandbox;

		const sandboxLogger = workflowLogger.child({
			sandboxId: createdSandbox.id,
		});
		const repoPath = await withStage(
			sandboxLogger,
			"repo.setup",
			() => setupRepository(createdSandbox, config, branchName),
			{
				sourceRepo: `${config.githubRepo.owner}/${config.githubRepo.repo}`,
				prBaseRepo: `${config.githubPrBaseRepo.owner}/${config.githubPrBaseRepo.repo}`,
				baseBranch: config.repoBaseBranch,
			},
		);
		const opencodeEndpoint = await withStage(
			sandboxLogger,
			"opencode.server.start",
			() =>
				startOpencodeInSandbox(createdSandbox, repoPath, config, sandboxLogger),
			{ opencodePort: config.opencodePort },
		);
		const agentResult = await withStage(
			sandboxLogger,
			"opencode.agent.run",
			() =>
				runOpencodeAgent(
					opencodeEndpoint,
					repoPath,
					payload,
					config,
					branchName,
				),
			{ providerID: config.model.providerID, modelID: config.model.modelID },
		);
		const prUrl = await withStage(
			sandboxLogger,
			"github.pr.publish",
			() =>
				pushBranchAndOpenPr(
					createdSandbox,
					repoPath,
					config,
					branchName,
					agentResult,
				),
			{ branchName },
		);
		const replyText = buildReplyText(prUrl, agentResult);

		await withStage(
			sandboxLogger,
			"inbound.reply.send",
			() => sendReplyEmail(inboundClient, payload, replyFrom, replyText),
			{ replyFrom, hasPr: Boolean(prUrl) },
		);

		sandboxLogger.info("workflow.completed", {
			durationMs: getDurationMs(workflowStartedAt),
			prUrl,
		});

		return {
			emailId: payload.email.id,
			sandboxId: createdSandbox.id,
			branchName,
			prUrl,
			replyText,
		};
	} catch (error) {
		const replyText = buildFailureReply(error);
		workflowLogger.error("workflow.failed", {
			durationMs: getDurationMs(workflowStartedAt),
			error: normalizeError(error),
		});

		try {
			await withStage(
				workflowLogger,
				"inbound.reply.failure_send",
				() => sendReplyEmail(inboundClient, payload, replyFrom, replyText),
				{ replyFrom },
			);
		} catch (replyError) {
			workflowLogger.error("inbound.reply.failure_send.error", {
				error: normalizeError(replyError),
			});
		}

		throw error;
	} finally {
		if (sandbox && !config.keepSandbox) {
			const sandboxToDelete = sandbox;
			try {
				await withStage(
					workflowLogger.child({ sandboxId: sandboxToDelete.id }),
					"daytona.sandbox.delete",
					() => sandboxToDelete.delete(120),
					{ timeoutSeconds: 120 },
				);
			} catch (deleteError) {
				workflowLogger.error("daytona.sandbox.delete.error", {
					sandboxId: sandboxToDelete.id,
					error: normalizeError(deleteError),
				});
			}
		} else if (sandbox && config.keepSandbox) {
			workflowLogger.info("daytona.sandbox.retained", {
				sandboxId: sandbox.id,
			});
		}
	}
};

const handleInboundRoute = async (
	request: Request,
	runtimeEnv: RuntimeEnv,
	logger: Logger,
	ctx?: ExecutionContextLike,
) => {
	logger.info("inbound.route.enter", {
		hasExecutionContext: Boolean(ctx),
	});

	if (request.method === "GET") {
		logger.info("inbound.route.healthcheck", {
			method: request.method,
		});

		return jsonResponse(200, {
			ok: true,
			endpoint: "/api/inbound",
			message: "Inbound prompt support endpoint",
		});
	}

	if (request.method !== "POST") {
		logger.warn("inbound.route.method_not_allowed", {
			method: request.method,
		});

		return jsonResponse(405, {
			error: "Method Not Allowed",
			allowed: ["GET", "POST"],
		});
	}

	let body: unknown;

	try {
		body = await request.json();
	} catch (error) {
		logger.warn("inbound.route.invalid_json", {
			error: normalizeError(error),
		});

		return jsonResponse(400, {
			error: "Invalid JSON body",
		});
	}

	if (!isInboundWebhookPayload(body)) {
		const eventName =
			body &&
			typeof body === "object" &&
			"event" in body &&
			typeof (body as { event?: unknown }).event === "string"
				? (body as { event: string }).event
				: undefined;

		logger.warn("inbound.route.invalid_payload", {
			event: eventName,
		});

		return jsonResponse(400, {
			error: "Invalid inbound webhook payload",
		});
	}

	const config = getConfig(runtimeEnv);
	const emailLogger = logger.child({
		emailId: body.email.id,
		emailSubject: body.email.subject,
		emailFrom: body.email.from.text,
	});

	emailLogger.info("inbound.payload.accepted", {
		verifyWebhook: config.verifyWebhook,
		replyFromCandidate: selectReplyFromAddress(body, config) ?? null,
	});

	const inboundClient = new Inbound({ apiKey: config.inboundApiKey });

	if (config.verifyWebhook) {
		const verified = await withStage(
			emailLogger,
			"inbound.webhook.verify",
			() => verifyWebhookFromHeaders(request.headers, inboundClient),
		);

		if (!verified) {
			emailLogger.warn("inbound.webhook.verify.rejected");

			return jsonResponse(401, {
				error: "Unauthorized webhook",
			});
		}

		emailLogger.info("inbound.webhook.verify.accepted");
	} else {
		emailLogger.warn("inbound.webhook.verify.skipped", {
			reason: "INBOUND_WEBHOOK_VERIFY=false",
		});
	}

	if (ctx) {
		emailLogger.info("workflow.dispatch", {
			mode: "async",
		});

		ctx.waitUntil(
			executePromptSupportWorkflow(body, config, emailLogger)
				.then((result) => {
					emailLogger.info("workflow.async.completed", {
						sandboxId: result.sandboxId,
						branchName: result.branchName,
						prUrl: result.prUrl,
					});
				})
				.catch((error) => {
					emailLogger.error("workflow.async.failed", {
						error: normalizeError(error),
					});
				}),
		);

		return jsonResponse(202, {
			ok: true,
			status: "accepted",
			emailId: body.email.id,
		});
	}

	emailLogger.info("workflow.dispatch", {
		mode: "sync",
	});

	try {
		const result = await executePromptSupportWorkflow(
			body,
			config,
			emailLogger,
		);

		emailLogger.info("workflow.sync.completed", {
			sandboxId: result.sandboxId,
			branchName: result.branchName,
			prUrl: result.prUrl,
		});

		return jsonResponse(200, {
			ok: true,
			status: "completed",
			result,
		});
	} catch (error) {
		emailLogger.error("workflow.sync.failed", {
			error: normalizeError(error),
		});

		const message = error instanceof Error ? error.message : "Unknown error";

		return jsonResponse(500, {
			error: "Workflow failed",
			details: message,
		});
	}
};

const fetchHandler = async (
	request: Request,
	runtimeEnv: RuntimeEnv,
	ctx?: ExecutionContextLike,
) => {
	const startedAt = Date.now();
	const requestId =
		request.headers.get("x-request-id")?.trim() || createRequestId();
	const { pathname } = new URL(request.url);
	const requestLogger = createLogger(resolveLogLevel(runtimeEnv), {
		requestId,
		method: request.method,
		path: pathname,
	});

	requestLogger.info("http.request.start", {
		hasExecutionContext: Boolean(ctx),
	});

	let response: Response;

	try {
		if (pathname === "/api/inbound") {
			response = await handleInboundRoute(
				request,
				runtimeEnv,
				requestLogger,
				ctx,
			);
		} else {
			response = jsonResponse(404, { error: "Not Found" });
		}
	} catch (error) {
		if (error instanceof HttpError) {
			requestLogger.warn("http.request.http_error", {
				status: error.status,
				message: error.message,
			});

			response = jsonResponse(error.status, { error: error.message });
		} else {
			requestLogger.error("http.request.unhandled_error", {
				error: normalizeError(error),
			});

			const details =
				error instanceof Error ? error.message : "Unknown server error";
			response = jsonResponse(500, {
				error: "Internal Server Error",
				details,
			});
		}
	}

	requestLogger.info("http.request.finish", {
		status: response.status,
		durationMs: getDurationMs(startedAt),
	});

	return response;
};

const resolveRuntimeEnv = (env?: unknown) => {
	const merged: RuntimeEnv = {};

	if (typeof process !== "undefined") {
		Object.assign(merged, toRuntimeEnv(process.env));
	}

	if (typeof Bun !== "undefined") {
		Object.assign(merged, toRuntimeEnv(Bun.env));
	}

	if (env !== undefined) {
		Object.assign(merged, toRuntimeEnv(env));
	}

	return merged;
};

const defaultLocalPort =
	typeof Bun !== "undefined"
		? Number.parseInt(Bun.env.PORT ?? "4534", 10) || 4534
		: 4534;

const app = {
	port: defaultLocalPort,
	fetch(request: Request, env?: unknown, ctx?: ExecutionContextLike) {
		return fetchHandler(request, resolveRuntimeEnv(env), ctx);
	},
};

export default app;

if (typeof Bun !== "undefined" && import.meta.main) {
	console.log(
		`Prompt support server listening on http://localhost:${defaultLocalPort}`,
	);
}
