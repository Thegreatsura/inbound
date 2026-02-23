import {
	createOpencodeClient,
	type Part,
	type PermissionRuleset,
} from "@opencode-ai/sdk/v2/client";
import dotenv from "dotenv";

dotenv.config();

type RunRequestBody = {
	command: string;
	args?: string | string[];
	context?: string | Record<string, unknown>;
	directory?: string;
	timeoutMs?: number;
	sessionID?: string;
	model?: string;
	agent?: string;
};

type JsonRecord = Record<string, unknown>;

const permission: PermissionRuleset = [
	{ permission: "*", pattern: "*", action: "allow" },
];
const serviceApiKey = process.env.SERVICE_API_KEY?.trim() ?? "";
const host = process.env.SECURITY_AGENT_HOST?.trim() || "0.0.0.0";
const port = parseIntEnv("SECURITY_AGENT_PORT", 8788);
const defaultTimeoutMs = parseIntEnv("SECURITY_AGENT_TIMEOUT_MS", 120_000);
const opencodeBaseUrl = process.env.OPENCODE_BASE_URL?.trim() || "";
const defaultModel = process.env.OPENCODE_MODEL?.trim() || undefined;
const defaultAgent = process.env.OPENCODE_AGENT?.trim() || undefined;

if (!serviceApiKey) throw new Error("Missing required SERVICE_API_KEY");
if (!opencodeBaseUrl) {
	throw new Error(
		"Missing required OPENCODE_BASE_URL for security-agent execution",
	);
}

const clientsByDirectory = new Map<
	string,
	ReturnType<typeof createOpencodeClient>
>();

const server = Bun.serve({
	hostname: host,
	port,
	async fetch(request) {
		try {
			const url = new URL(request.url);
			if (url.pathname === "/health" && request.method === "GET") {
				return jsonResponse(200, { ok: true, service: "security-agent" });
			}
			if (url.pathname !== "/run" || request.method !== "POST") {
				return jsonResponse(404, errorBody("NOT_FOUND", "Route not found"));
			}
			if (!isAuthorized(request.headers.get("authorization"))) {
				return jsonResponse(
					401,
					errorBody("UNAUTHORIZED", "Missing or invalid bearer token"),
				);
			}

			const body = await parseRunRequest(request);
			const timeoutMs = normalizeTimeout(body.timeoutMs ?? defaultTimeoutMs);
			const directory = Bun.resolveSync(
				body.directory?.trim() ? body.directory : ".",
				process.cwd(),
			);
			const commandInput = parseCommandInput(body.command, body.args);

			const startedAt = Date.now();
			const client = await getClient(directory);
			const sessionID =
				body.sessionID ?? (await createSession(client, commandInput.command));

			if (body.context !== undefined) {
				await withTimeout(
					client.session.prompt({
						sessionID,
						parts: [
							{
								type: "text",
								text:
									typeof body.context === "string"
										? body.context
										: JSON.stringify(body.context, null, 2),
							},
						],
						noReply: true,
					}),
					timeoutMs,
					"Context prompt timed out",
				);
			}

			const commandResult = await withTimeout(
				client.session.command({
					sessionID,
					command: commandInput.command,
					arguments: commandInput.arguments,
					model: body.model ?? defaultModel,
					agent: body.agent ?? defaultAgent,
				}),
				timeoutMs,
				"Command execution timed out",
			);

			if (!commandResult.data)
				throw new Error("OpenCode command response did not include data");

			return jsonResponse(200, {
				ok: true,
				result: {
					sessionID,
					messageID: commandResult.data.info.id,
					command: commandInput.command,
					arguments: commandInput.arguments,
					directory,
					output: {
						text: collectTextParts(commandResult.data.parts),
						parts: commandResult.data.parts,
					},
					timing: { durationMs: Date.now() - startedAt, timeoutMs },
				},
			});
		} catch (error) {
			return handleError(error);
		}
	},
});

console.log(
	JSON.stringify({
		level: "info",
		event: "security-agent.server.started",
		host,
		port,
		pid: process.pid,
	}),
);
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	server.stop();
	process.exit(0);
}

function parseIntEnv(name: string, fallback: number): number {
	const parsed = Number.parseInt(process.env[name] ?? "", 10);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeTimeout(timeoutMs: number): number {
	return Math.max(1_000, Math.min(Math.floor(timeoutMs), 10 * 60_000));
}

function isAuthorized(authHeader: string | null): boolean {
	if (!authHeader) return false;
	const [scheme, token] = authHeader.split(" ");
	return scheme?.toLowerCase() === "bearer" && token === serviceApiKey;
}

async function parseRunRequest(request: Request): Promise<RunRequestBody> {
	let parsed: unknown;
	try {
		parsed = await request.json();
	} catch {
		throw new HttpError(400, "Request body must be valid JSON", "INVALID_JSON");
	}

	if (!parsed || typeof parsed !== "object") {
		throw new HttpError(
			400,
			"Request body must be a JSON object",
			"INVALID_BODY",
		);
	}

	const body = parsed as JsonRecord;
	if (typeof body.command !== "string" || body.command.trim().length === 0) {
		throw new HttpError(400, "command is required", "INVALID_COMMAND");
	}

	if (
		body.args !== undefined &&
		typeof body.args !== "string" &&
		!(
			Array.isArray(body.args) &&
			body.args.every((item) => typeof item === "string")
		)
	) {
		throw new HttpError(
			400,
			"args must be a string or string[]",
			"INVALID_ARGS",
		);
	}

	if (
		body.context !== undefined &&
		typeof body.context !== "string" &&
		(typeof body.context !== "object" ||
			body.context === null ||
			Array.isArray(body.context))
	) {
		throw new HttpError(
			400,
			"context must be a string or object",
			"INVALID_CONTEXT",
		);
	}

	if (
		body.timeoutMs !== undefined &&
		(typeof body.timeoutMs !== "number" || body.timeoutMs <= 0)
	) {
		throw new HttpError(
			400,
			"timeoutMs must be a positive number",
			"INVALID_TIMEOUT",
		);
	}

	return {
		command: body.command,
		args: body.args as string | string[] | undefined,
		context: body.context as string | Record<string, unknown> | undefined,
		timeoutMs: body.timeoutMs as number | undefined,
		directory: optionalString(body.directory),
		sessionID: optionalString(body.sessionID),
		model: optionalString(body.model),
		agent: optionalString(body.agent),
	};
}

function optionalString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : undefined;
}

function parseCommandInput(command: string, args?: string | string[]) {
	const [head, ...tail] = command.trim().split(/\s+/);
	const commandName = head?.startsWith("/") ? head.slice(1) : head;
	const argsFromCommand = tail.join(" ").trim();
	const argsFromBody =
		typeof args === "string"
			? args.trim()
			: Array.isArray(args)
				? args.join(" ").trim()
				: "";
	const joinedArguments = [argsFromCommand, argsFromBody]
		.filter(Boolean)
		.join(" ")
		.trim();

	if (!commandName)
		throw new HttpError(400, "command is required", "INVALID_COMMAND");
	return { command: commandName, arguments: joinedArguments };
}

async function getClient(directory: string) {
	let client = clientsByDirectory.get(directory);
	if (client) return client;

	client = createOpencodeClient({
		baseUrl: opencodeBaseUrl,
		directory,
		throwOnError: true,
	});
	clientsByDirectory.set(directory, client);
	return client;
}

async function createSession(
	client: ReturnType<typeof createOpencodeClient>,
	commandName: string,
): Promise<string> {
	const session = await client.session.create({
		title: `Security Agent: ${commandName}`,
		permission,
	});
	if (!session.data?.id)
		throw new Error("OpenCode session create did not return an id");
	return session.data.id;
}

function collectTextParts(parts: Part[]): string {
	return parts
		.filter(
			(part): part is Extract<Part, { type: "text" }> => part.type === "text",
		)
		.map((part) => part.text)
		.join("\n")
		.trim();
}

function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	message: string,
): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timeout = setTimeout(
			() => reject(new HttpError(504, message, "TIMEOUT")),
			timeoutMs,
		);
		promise
			.then((value) => {
				clearTimeout(timeout);
				resolve(value);
			})
			.catch((error) => {
				clearTimeout(timeout);
				reject(error);
			});
	});
}

function errorBody(code: string, message: string) {
	return { ok: false, error: { code, message } };
}

function handleError(error: unknown): Response {
	if (error instanceof HttpError)
		return jsonResponse(error.status, errorBody(error.code, error.message));
	const message = error instanceof Error ? error.message : "Unknown error";
	return jsonResponse(500, errorBody("INTERNAL_ERROR", message));
}

function jsonResponse(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json; charset=utf-8" },
	});
}

class HttpError extends Error {
	status: number;
	code: string;

	constructor(status: number, message: string, code: string) {
		super(message);
		this.status = status;
		this.code = code;
	}
}
