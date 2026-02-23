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
	model: ModelSelection;
	gitAuthorName: string;
	gitAuthorEmail: string;
	githubRepo: GithubRepo;
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
	const inboundApiKey = readEnv(env, "INBOUND_API_KEY");
	const daytonaApiKey = readEnv(env, "DAYTONA_API_KEY");
	const githubToken = readEnv(env, "GITHUB_TOKEN");
	const repoUrl =
		readEnv(env, "PROMPT_SUPPORT_REPO_URL") ??
		"https://github.com/inbound-org/inbound.git";

	if (!inboundApiKey) {
		throw new HttpError(500, "Missing INBOUND_API_KEY");
	}

	if (!daytonaApiKey) {
		throw new HttpError(500, "Missing DAYTONA_API_KEY");
	}

	if (!githubToken) {
		throw new HttpError(500, "Missing GITHUB_TOKEN");
	}

	let githubRepo: GithubRepo;

	try {
		githubRepo = parseGithubRepo(repoUrl);
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
		opencodeZenKey: readEnv(env, "OPENCODE_ZEN_KEY"),
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
		model: parseModelSelection(
			readEnv(env, "OPENCODE_MODEL") ?? "opencode/gpt-5.3-codex",
		),
		gitAuthorName:
			readEnv(env, "PROMPT_SUPPORT_GIT_AUTHOR_NAME") ??
			"Inbound Prompt Support",
		gitAuthorEmail:
			readEnv(env, "PROMPT_SUPPORT_GIT_AUTHOR_EMAIL") ??
			"prompt-support@inbound.new",
		githubRepo,
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

const waitForOpencodeServer = async (baseUrl: string, repoPath: string) => {
	const healthClient = createOpencodeClient({
		baseUrl,
		directory: repoPath,
	});

	for (let attempt = 0; attempt < 60; attempt += 1) {
		try {
			const response = await healthClient.global.health();
			if (response.data) {
				return;
			}
		} catch {}

		await wait(2_000);
	}

	throw new Error(
		"Timed out waiting for OpenCode server inside Daytona sandbox",
	);
};

const startOpencodeInSandbox = async (
	sandbox: Sandbox,
	repoPath: string,
	config: PromptSupportConfig,
) => {
	await runSandboxCommand(
		sandbox,
		"if command -v opencode >/dev/null 2>&1; then opencode --version; else npm install -g opencode-ai; fi",
		undefined,
		undefined,
		600,
	);

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
		`if command -v opencode >/dev/null 2>&1; then opencode serve --hostname 0.0.0.0 --port ${config.opencodePort} --headless; else npx -y opencode-ai serve --hostname 0.0.0.0 --port ${config.opencodePort} --headless; fi`,
	].join(" && ");

	await sandbox.process.executeSessionCommand(sessionID, {
		command: serveCommand,
		runAsync: true,
	});

	const preview = await sandbox.getSignedPreviewUrl(config.opencodePort, 7_200);
	await waitForOpencodeServer(preview.url, repoPath);

	return preview.url;
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
	baseUrl: string,
	repoPath: string,
	payload: InboundWebhookPayload,
	config: PromptSupportConfig,
	branchName: string,
): Promise<AgentRunResult> => {
	const client = createOpencodeClient({
		baseUrl,
		directory: repoPath,
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

const buildDefaultPrBody = (
	payload: InboundWebhookPayload,
	agentResult: AgentRunResult,
) => {
	const summary =
		agentResult.structured?.summary ??
		agentResult.rawText.slice(0, 2_000) ??
		"Implemented changes requested in inbound issue report.";

	return [
		"## Summary",
		`- Inbound issue: ${payload.email.subject}`,
		`- Reporter: ${payload.email.from.text}`,
		`- Agent summary: ${summary}`,
	].join("\n");
};

const createGithubPullRequest = async (
	config: PromptSupportConfig,
	branchName: string,
	title: string,
	body: string,
) => {
	const endpoint = `https://api.github.com/repos/${config.githubRepo.owner}/${config.githubRepo.repo}/pulls`;

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
			head: branchName,
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
			`${endpoint}?head=${encodeURIComponent(`${config.githubRepo.owner}:${branchName}`)}&state=open`,
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
	payload: InboundWebhookPayload,
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

	const prTitle =
		agentResult.structured?.prTitle ??
		normalizeCommitMessage(
			agentResult.structured?.commitMessage ?? `fix: ${payload.email.subject}`,
		);

	const prBody =
		agentResult.structured?.prBody ?? buildDefaultPrBody(payload, agentResult);

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
): Promise<WorkflowResult> => {
	const inboundClient = new Inbound({ apiKey: config.inboundApiKey });
	const replyFrom = config.replyFrom ?? payload.email.recipient;

	if (!replyFrom) {
		throw new Error("Unable to determine reply-from address");
	}

	const daytona = new Daytona({
		apiKey: config.daytonaApiKey,
		apiUrl: config.daytonaApiUrl,
		target: config.daytonaTarget,
	});

	let sandbox: Sandbox | null = null;
	const branchName = buildBranchName(payload.email.id);

	try {
		sandbox = await daytona.create({
			name: `prompt-support-${Date.now().toString(36)}`,
			language: "typescript",
			ephemeral: !config.keepSandbox,
			autoDeleteInterval: config.keepSandbox ? -1 : 0,
			envVars: {
				GITHUB_TOKEN: config.githubToken,
				OPENCODE_ZEN_KEY: config.opencodeZenKey ?? "",
				OPENCODE_API_KEY: config.opencodeZenKey ?? "",
			},
		});

		const repoPath = await setupRepository(sandbox, config, branchName);
		const opencodeUrl = await startOpencodeInSandbox(sandbox, repoPath, config);
		const agentResult = await runOpencodeAgent(
			opencodeUrl,
			repoPath,
			payload,
			config,
			branchName,
		);
		const prUrl = await pushBranchAndOpenPr(
			sandbox,
			repoPath,
			config,
			branchName,
			payload,
			agentResult,
		);
		const replyText = buildReplyText(prUrl, agentResult);

		await sendReplyEmail(inboundClient, payload, replyFrom, replyText);

		return {
			emailId: payload.email.id,
			sandboxId: sandbox.id,
			branchName,
			prUrl,
			replyText,
		};
	} catch (error) {
		const replyText = buildFailureReply(error);

		try {
			await sendReplyEmail(inboundClient, payload, replyFrom, replyText);
		} catch (replyError) {
			console.error("Failed replying to inbound email", replyError);
		}

		throw error;
	} finally {
		if (sandbox && !config.keepSandbox) {
			try {
				await sandbox.delete(120);
			} catch (deleteError) {
				console.error("Failed deleting Daytona sandbox", deleteError);
			}
		}
	}
};

const handleInboundRoute = async (
	request: Request,
	runtimeEnv: RuntimeEnv,
	ctx?: ExecutionContextLike,
) => {
	if (request.method === "GET") {
		return jsonResponse(200, {
			ok: true,
			endpoint: "/api/inbound",
			message: "Inbound prompt support endpoint",
		});
	}

	if (request.method !== "POST") {
		return jsonResponse(405, {
			error: "Method Not Allowed",
			allowed: ["GET", "POST"],
		});
	}

	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return jsonResponse(400, {
			error: "Invalid JSON body",
		});
	}

	if (!isInboundWebhookPayload(body)) {
		return jsonResponse(400, {
			error: "Invalid inbound webhook payload",
		});
	}

	const config = getConfig(runtimeEnv);
	const inboundClient = new Inbound({ apiKey: config.inboundApiKey });

	if (config.verifyWebhook) {
		const verified = await verifyWebhookFromHeaders(
			request.headers,
			inboundClient,
		);

		if (!verified) {
			return jsonResponse(401, {
				error: "Unauthorized webhook",
			});
		}
	}

	if (ctx) {
		ctx.waitUntil(
			executePromptSupportWorkflow(body, config).catch((error) => {
				console.error("Prompt support workflow failed", error);
			}),
		);

		return jsonResponse(202, {
			ok: true,
			status: "accepted",
			emailId: body.email.id,
		});
	}

	try {
		const result = await executePromptSupportWorkflow(body, config);

		return jsonResponse(200, {
			ok: true,
			status: "completed",
			result,
		});
	} catch (error) {
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
	try {
		const { pathname } = new URL(request.url);

		if (pathname === "/api/inbound") {
			return await handleInboundRoute(request, runtimeEnv, ctx);
		}

		return jsonResponse(404, { error: "Not Found" });
	} catch (error) {
		if (error instanceof HttpError) {
			return jsonResponse(error.status, { error: error.message });
		}

		const details =
			error instanceof Error ? error.message : "Unknown server error";
		return jsonResponse(500, {
			error: "Internal Server Error",
			details,
		});
	}
};

const app = {
	fetch(request: Request, env?: unknown, ctx?: ExecutionContextLike) {
		return fetchHandler(request, toRuntimeEnv(env), ctx);
	},
};

export default app;

if (typeof Bun !== "undefined" && import.meta.main) {
	const port = Number(Bun.env.PORT ?? 3000);

	Bun.serve({
		port,
		fetch: (request) => fetchHandler(request, toRuntimeEnv(Bun.env)),
	});

	console.log(`Prompt support server listening on http://localhost:${port}`);
}
