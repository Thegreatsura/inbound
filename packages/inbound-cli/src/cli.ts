import { createSdkClient } from "./client/e2-client";
import { runApiCommand, runDraftCommand, runMailboxCommand } from "./commands";
import { loadConfig } from "./config/inbound-config";
import {
	getOptionBoolean,
	getOptionString,
	getOptionStrings,
	parseArgv,
} from "./lib/argv";
import {
	printCompletionScript,
	printHelpForTokens,
	printMainHelp,
	printValidationIssue,
	validateCommandPath,
} from "./lib/help";
import { printOutput } from "./lib/output";
import type { CliContext, GlobalOptions } from "./types";

export async function runCli(argv: string[]): Promise<void> {
	const parsed = parseArgv(argv);
	parsed.positionals = normalizeShortcutTokens(parsed.positionals);
	const tokens = parsed.positionals;
	const wantsHelp = getOptionBoolean(parsed, "help", "h");

	if (tokens.length === 0) {
		printMainHelp();
		return;
	}

	if (tokens[0] === "help") {
		if (!printHelpForTokens(tokens.slice(1))) {
			console.error("Unknown help topic.");
			printMainHelp();
			process.exit(1);
		}
		return;
	}

	if (tokens[1] === "help") {
		if (
			!printHelpForTokens([tokens[0], tokens[2], tokens[3]].filter(Boolean))
		) {
			console.error("Unknown help topic.");
			printMainHelp();
			process.exit(1);
		}
		return;
	}

	if (tokens[2] === "help") {
		if (
			!printHelpForTokens([tokens[0], tokens[1], tokens[3]].filter(Boolean))
		) {
			console.error("Unknown help topic.");
			printMainHelp();
			process.exit(1);
		}
		return;
	}

	if (wantsHelp) {
		if (!printHelpForTokens(tokens)) {
			console.error("Unknown help topic.");
			printMainHelp();
			process.exit(1);
		}
		return;
	}

	if (tokens[0] === "completion") {
		const shell = tokens[1];
		if (!shell) {
			printHelpForTokens(["completion"]);
			return;
		}

		if (!printCompletionScript(shell)) {
			console.error(`Unknown completion shell: ${shell}`);
			printHelpForTokens(["completion"]);
			process.exit(1);
		}
		return;
	}

	const issue = validateCommandPath(tokens);
	if (issue) {
		printValidationIssue(issue);
		process.exit(1);
		return;
	}

	const configOptionPath = getOptionString(parsed, "config");
	const loaded = await loadConfig(configOptionPath);
	const globals = makeGlobalOptions(parsed, loaded.config.api?.baseUrl);

	const ctx: CliContext = {
		parsed,
		globals,
		config: loaded.config,
		configPath: loaded.path,
	};

	const [group] = tokens;

	try {
		let result: unknown;
		if (group === "mailbox") {
			result = await runMailboxCommand(ctx);
		} else if (group === "draft") {
			result = await runDraftCommand(ctx);
		} else {
			if (!globals.apiKey) {
				throw new Error(
					"Missing API key. Set INBOUND_API_KEY or pass --api-key.",
				);
			}

			ctx.sdk = createSdkClient({
				apiKey: globals.apiKey,
				baseUrl: globals.baseUrl,
			});
			result = await runApiCommand(ctx);
		}

		printOutput(result, globals.asJson);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		if (globals.debug && error instanceof Error && error.stack) {
			console.error(error.stack);
		} else {
			console.error(`Error: ${message}`);
		}
		process.exit(1);
	}
}

function makeGlobalOptions(
	parsed: ReturnType<typeof parseArgv>,
	configBaseUrl?: string,
): GlobalOptions {
	const apiKey =
		getOptionString(parsed, "api-key", "apiKey") || process.env.INBOUND_API_KEY;
	const baseUrl =
		getOptionString(parsed, "base-url", "baseUrl") ||
		process.env.INBOUND_BASE_URL ||
		configBaseUrl ||
		"https://inbound.new";

	return {
		apiKey,
		baseUrl: baseUrl.replace(/\/$/, ""),
		asJson: getOptionBoolean(parsed, "json", "j"),
		debug: getOptionBoolean(parsed, "debug", "d"),
		configPath: getOptionString(parsed, "config"),
		mailbox: getOptionString(parsed, "mailbox"),
		addresses: getOptionStrings(parsed, "address"),
		domains: getOptionStrings(parsed, "domain"),
		mergeFilters: getOptionBoolean(parsed, "merge-filters", "mergeFilters"),
	};
}

function normalizeShortcutTokens(tokens: string[]): string[] {
	if (tokens.length === 0) return tokens;

	if (tokens[0] === "send") {
		return ["emails", "send", ...tokens.slice(1)];
	}

	if (tokens[0] === "help" && tokens[1] === "send") {
		return ["help", "emails", "send", ...tokens.slice(2)];
	}

	return tokens;
}
