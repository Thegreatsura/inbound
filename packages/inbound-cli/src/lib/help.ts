type ActionSpec = {
	summary: string;
	usage: string;
	examples?: string[];
	flags?: string[];
	children?: Record<string, ActionSpec>;
};

type GroupSpec = {
	summary: string;
	actions: Record<string, ActionSpec>;
	examples?: string[];
};

type ValidationIssue =
	| { kind: "unknown-group"; group: string; suggestion?: string }
	| {
			kind: "unknown-action";
			group: string;
			action: string;
			suggestion?: string;
	  }
	| {
			kind: "unknown-subaction";
			group: string;
			action: string;
			subaction: string;
			suggestion?: string;
	  }
	| { kind: "missing-action"; group: string }
	| { kind: "missing-subaction"; group: string; action: string };

const GLOBAL_FLAGS = [
	"--api-key <key>         API key (or INBOUND_API_KEY)",
	"--base-url <url>        API base URL (or INBOUND_BASE_URL)",
	"--config <path>         Use a specific inbound.json",
	"--mailbox <name>        Use mailbox defaults for list commands",
	"--address <email>       Filter by address (repeatable)",
	"--domain <domain>       Filter by domain (repeatable)",
	"--merge-filters         Merge mailbox filters with explicit filters",
	"--json, -j              Raw JSON output",
	"--help, -h              Show contextual help",
	"--debug, -d             Show stack trace on error",
];

const GROUPS: Record<string, GroupSpec> = {
	mailbox: {
		summary: "Manage local mailbox defaults in inbound.json",
		actions: {
			init: {
				summary: "Create inbound.json in current directory",
				usage: "bun run inbound mailbox init [--force]",
				examples: ["bun run inbound mailbox init"],
			},
			list: {
				summary: "List saved mailboxes",
				usage: "bun run inbound mailbox list",
				examples: ["bun run inbound mailbox list"],
			},
			add: {
				summary: "Add a mailbox profile",
				usage:
					"bun run inbound mailbox add <key> --name <name> --email <email> [--address <email>] [--domain <domain>]",
				examples: [
					'bun run inbound mailbox add support --name "Support" --email support@inbound.new --domain inbound.new',
				],
			},
			use: {
				summary: "Set default mailbox",
				usage: "bun run inbound mailbox use <key>",
				examples: ["bun run inbound mailbox use support"],
			},
			remove: {
				summary: "Remove a mailbox",
				usage: "bun run inbound mailbox remove <key>",
				examples: ["bun run inbound mailbox remove support"],
			},
			show: {
				summary: "Show loaded config and path",
				usage: "bun run inbound mailbox show",
				examples: ["bun run inbound mailbox show --json"],
			},
			find: {
				summary: "Find mailboxes by address/domain",
				usage:
					"bun run inbound mailbox find [--address <email>] [--domain <domain>]",
				examples: [
					"bun run inbound mailbox find --address support@inbound.new",
					"bun run inbound mailbox find --domain inbound.new",
				],
			},
		},
		examples: [
			"bun run inbound mailbox init",
			'bun run inbound mailbox add support --name "Support" --email support@inbound.new --domain inbound.new',
			"bun run inbound mailbox use support",
		],
	},
	draft: {
		summary: "Create local .inbound email draft files",
		actions: {
			init: {
				summary: "Create a draft template",
				usage: "bun run inbound draft init [path] [--force]",
				examples: [
					"bun run inbound draft init",
					"bun run inbound draft init ./welcome.inbound",
				],
				flags: [
					"--force                Overwrite existing file",
					"--path <path>          Output path for the draft file",
				],
			},
		},
		examples: [
			"bun run inbound draft init",
			"bun run inbound draft init ./welcome.inbound",
			"bun run inbound send ./welcome.inbound",
		],
	},
	domains: {
		summary: "Manage email domains",
		actions: {
			list: {
				summary: "List domains",
				usage:
					"bun run inbound domains list [--status pending|verified|failed]",
				examples: ["bun run inbound domains list --status verified"],
			},
			get: {
				summary: "Get a domain by ID",
				usage: "bun run inbound domains get <domainId> [--check true]",
				examples: ["bun run inbound domains get dom_123 --check true"],
			},
			create: {
				summary: "Create a domain",
				usage: "bun run inbound domains create --domain <domain>",
				examples: ["bun run inbound domains create --domain inbound.new"],
			},
			update: {
				summary: "Update domain settings",
				usage:
					"bun run inbound domains update <domainId> --isCatchAllEnabled true|false [--catchAllEndpointId ep_123]",
				examples: [
					"bun run inbound domains update dom_123 --isCatchAllEnabled true --catchAllEndpointId ep_123",
				],
			},
			delete: {
				summary: "Delete a domain",
				usage: "bun run inbound domains delete <domainId>",
				examples: ["bun run inbound domains delete dom_123"],
			},
		},
		examples: [
			"bun run inbound domains list",
			"bun run inbound domains create --domain inbound.new",
		],
	},
	addresses: {
		summary: "Manage email addresses",
		actions: {
			list: {
				summary: "List email addresses",
				usage: "bun run inbound addresses list [--domainId dom_123]",
				examples: ["bun run inbound addresses list --domainId dom_123"],
			},
			get: {
				summary: "Get an address by ID",
				usage: "bun run inbound addresses get <addressId>",
				examples: ["bun run inbound addresses get addr_123"],
			},
			create: {
				summary: "Create an address",
				usage:
					"bun run inbound addresses create --address <email> --domainId <domainId> [--endpointId ep_123]",
				examples: [
					"bun run inbound addresses create --address support@inbound.new --domainId dom_123",
				],
			},
			update: {
				summary: "Update an address",
				usage:
					"bun run inbound addresses update <addressId> [--endpointId ep_123] [--webhookId wh_123]",
				examples: [
					"bun run inbound addresses update addr_123 --endpointId ep_123",
				],
			},
			delete: {
				summary: "Delete an address",
				usage: "bun run inbound addresses delete <addressId>",
				examples: ["bun run inbound addresses delete addr_123"],
			},
		},
	},
	emails: {
		summary: "List, send, and manage emails",
		actions: {
			list: {
				summary: "List emails (mailbox-aware)",
				usage:
					"bun run inbound emails list [--mailbox support] [--address a@x.com] [--domain x.com] [--status delivered]",
				examples: [
					"bun run inbound emails list --mailbox support",
					"bun run inbound emails list --address support@inbound.new --status unread",
				],
			},
			get: {
				summary: "Get an email by ID",
				usage: "bun run inbound emails get <emailId>",
				examples: ["bun run inbound emails get email_123"],
			},
			send: {
				summary: "Send an email",
				usage:
					"bun run inbound emails send [<draft.inbound>] [--from <email>] [--to <email>] [--subject <subject>] [--text <text>] [--html <html>]",
				examples: [
					"bun run inbound send ./welcome.inbound",
					'bun run inbound emails send --from support@inbound.new --to you@example.com --subject "Hello" --text "Hi"',
				],
				flags: [
					"--draft <path>         Read .inbound draft file",
					"--from <email>         Sender address (overrides draft)",
					"--to <email>           Recipient (repeatable/comma-separated)",
					"--cc <email>           CC recipient (repeatable/comma-separated)",
					"--bcc <email>          BCC recipient (repeatable/comma-separated)",
					"--reply-to-id <id>     Reply to inbound email/thread id",
					"--reply-to <email>     Reply-To header address(es)",
					"--subject <text>       Subject line",
					"--text <text>          Plain text body",
					"--html <html>          HTML body",
					"--scheduled-at <time>  Schedule time (ISO or natural language)",
					"--timezone <tz>        Timezone for scheduled-at",
				],
			},
			update: {
				summary: "Patch an email (read/archive)",
				usage:
					"bun run inbound emails update <emailId> [--is_read true|false] [--is_archived true|false]",
				examples: ["bun run inbound emails update email_123 --is_read true"],
			},
			cancel: {
				summary: "Cancel a scheduled email",
				usage: "bun run inbound emails cancel <emailId>",
				examples: ["bun run inbound emails cancel email_123"],
			},
			reply: {
				summary: "Reply to an email or thread",
				usage:
					"bun run inbound emails reply <emailOrThreadId> --from <email> [--text <text>] [--html <html>]",
				examples: [
					'bun run inbound emails reply thread_123 --from support@inbound.new --text "Thanks!"',
				],
			},
			retry: {
				summary: "Retry delivery for a received email",
				usage:
					"bun run inbound emails retry <emailId> [--endpoint-id ep_123] [--delivery-id del_123]",
				examples: [
					"bun run inbound emails retry email_123 --endpoint-id ep_123",
				],
			},
		},
		examples: [
			"bun run inbound emails list --mailbox support",
			'bun run inbound emails send --from support@inbound.new --to you@example.com --subject "Hello" --text "Hi"',
		],
	},
	endpoints: {
		summary: "Manage delivery endpoints",
		actions: {
			list: {
				summary: "List endpoints",
				usage:
					"bun run inbound endpoints list [--type webhook|email|email_group]",
				examples: ["bun run inbound endpoints list --type webhook"],
			},
			get: {
				summary: "Get endpoint details",
				usage: "bun run inbound endpoints get <endpointId>",
				examples: ["bun run inbound endpoints get ep_123"],
			},
			create: {
				summary: "Create endpoint with --data JSON",
				usage: "bun run inbound endpoints create --data '{...}'",
				examples: [
					'bun run inbound endpoints create --data \'{"name":"Webhook","type":"webhook","config":{"url":"https://example.com"}}\'',
				],
			},
			update: {
				summary: "Update endpoint with --data JSON",
				usage: "bun run inbound endpoints update <endpointId> --data '{...}'",
				examples: [
					"bun run inbound endpoints update ep_123 --data '{\"isActive\":false}'",
				],
			},
			delete: {
				summary: "Delete endpoint",
				usage: "bun run inbound endpoints delete <endpointId>",
				examples: ["bun run inbound endpoints delete ep_123"],
			},
			test: {
				summary: "Send test payload to endpoint",
				usage:
					"bun run inbound endpoints test <endpointId> [--webhook-format inbound|discord|slack]",
				examples: ["bun run inbound endpoints test ep_123"],
			},
		},
	},
	attachments: {
		summary: "Download email attachments",
		actions: {
			get: {
				summary: "Download attachment by email ID and filename",
				usage:
					"bun run inbound attachments get <emailId> <filename> [--out ./file] [--force]",
				examples: [
					"bun run inbound attachments get email_123 invoice.pdf --out ./invoice.pdf",
				],
			},
		},
	},
	mail: {
		summary: "Read conversation threads",
		actions: {
			threads: {
				summary: "List/get conversation threads",
				usage: "bun run inbound mail threads <list|get> ...",
				examples: [
					"bun run inbound mail threads list --mailbox support",
					"bun run inbound mail threads get thread_123",
				],
				children: {
					list: {
						summary: "List threads (mailbox-aware)",
						usage:
							"bun run inbound mail threads list [--mailbox support] [--domain inbound.new] [--unread true]",
						examples: [
							"bun run inbound mail threads list --mailbox support",
							"bun run inbound mail threads list --domain inbound.new --unread true",
						],
					},
					get: {
						summary: "Get full thread",
						usage: "bun run inbound mail threads get <threadId>",
						examples: ["bun run inbound mail threads get thread_123"],
					},
				},
			},
		},
		examples: [
			"bun run inbound mail threads list --mailbox support",
			"bun run inbound mail threads get thread_123",
		],
	},
	guard: {
		summary: "Manage AI guard rules",
		actions: {
			list: {
				summary: "List guard rules",
				usage: "bun run inbound guard list",
				examples: ["bun run inbound guard list"],
			},
			get: {
				summary: "Get guard rule",
				usage: "bun run inbound guard get <ruleId>",
				examples: ["bun run inbound guard get gr_123"],
			},
			create: {
				summary: "Create guard rule",
				usage: "bun run inbound guard create --data '{...}'",
				examples: [
					'bun run inbound guard create --data \'{"name":"Block spam"}\'',
				],
			},
			update: {
				summary: "Update guard rule",
				usage: "bun run inbound guard update <ruleId> --data '{...}'",
				examples: [
					"bun run inbound guard update gr_123 --data '{\"isActive\":false}'",
				],
			},
			delete: {
				summary: "Delete guard rule",
				usage: "bun run inbound guard delete <ruleId>",
				examples: ["bun run inbound guard delete gr_123"],
			},
			check: {
				summary: "Check guard against an email",
				usage:
					"bun run inbound guard check <ruleId> --structured-email-id <structuredEmailId>",
				examples: [
					"bun run inbound guard check gr_123 --structured-email-id sem_123",
				],
			},
			generate: {
				summary: "Generate a rule from natural language",
				usage: 'bun run inbound guard generate --prompt "..."',
				examples: [
					'bun run inbound guard generate --prompt "Flag order cancellation requests"',
				],
			},
		},
	},
	completion: {
		summary: "Generate shell completion scripts",
		actions: {
			bash: {
				summary: "Print bash completion script",
				usage: "bun run inbound completion bash",
				examples: [
					"bun run inbound completion bash > ~/.inbound-completion.bash",
					"source ~/.inbound-completion.bash",
				],
			},
			zsh: {
				summary: "Print zsh completion script",
				usage: "bun run inbound completion zsh",
				examples: [
					"bun run inbound completion zsh > ~/.inbound-completion.zsh",
					"source ~/.inbound-completion.zsh",
				],
			},
			fish: {
				summary: "Print fish completion script",
				usage: "bun run inbound completion fish",
				examples: [
					"bun run inbound completion fish > ~/.config/fish/completions/inbound.fish",
				],
			},
		},
		examples: [
			"bun run inbound completion bash > ~/.inbound-completion.bash",
			"source ~/.inbound-completion.bash",
		],
	},
};

const GROUP_ALIASES: Record<string, string> = {
	"email-addresses": "addresses",
};

const ACTIONS_BY_GROUP: Record<string, string[]> = Object.fromEntries(
	Object.entries(GROUPS).map(([group, spec]) => [
		group,
		Object.keys(spec.actions),
	]),
);

function resolveGroupName(group: string): string {
	return GROUP_ALIASES[group] || group;
}

function printLines(lines: string[]) {
	for (const line of lines) {
		console.log(line);
	}
}

function printSection(title: string, lines: string[]) {
	console.log(title);
	printLines(lines);
	console.log("");
}

export function printMainHelp() {
	const groups = Object.entries(GROUPS)
		.map(([name, spec]) => `  ${name.padEnd(12, " ")} ${spec.summary}`)
		.sort((a, b) => a.localeCompare(b));

	printLines([
		"Inbound CLI",
		"",
		"Usage:",
		"  inbound <group> <action> [args] [flags]",
		"  inbound send [draft.inbound] [flags]",
		"  inbound help [group] [action]",
		"  (or use bun run inbound ... in this repo)",
		"",
		"  bun run inbound <group> <action> [args] [flags]",
		"  bun run inbound send [draft.inbound] [flags]",
		"  bun run inbound help [group] [action]",
		"",
	]);

	printSection("Groups:", groups);

	printSection("Quick examples:", [
		"  bun run inbound mailbox init",
		"  bun run inbound draft init ./welcome.inbound",
		'  bun run inbound mailbox add support --name "Support" --email support@inbound.new --domain inbound.new',
		"  bun run inbound send ./welcome.inbound",
		"  bun run inbound emails list --mailbox support",
		"  bun run inbound mail threads list --domain inbound.new",
		'  bun run inbound emails send --from support@inbound.new --to you@example.com --subject "Hello" --text "Hi"',
		"  bun run inbound emails list --json",
	]);

	printSection(
		"Global flags:",
		GLOBAL_FLAGS.map((line) => `  ${line}`),
	);

	console.log("Tip: you can skip `--` with `bun run inbound ...`.");
}

export function printGroupHelp(group: string): boolean {
	const resolvedGroup = resolveGroupName(group);
	const spec = GROUPS[resolvedGroup];
	if (!spec) return false;

	if (resolvedGroup !== group) {
		console.log(`Group: ${group} (alias of ${resolvedGroup})`);
	} else {
		console.log(`Group: ${resolvedGroup}`);
	}
	console.log(spec.summary);
	console.log("");
	console.log("Usage:");
	console.log(`  bun run inbound ${group} <action> [args] [flags]`);
	console.log("");
	console.log("Actions:");
	for (const [action, actionSpec] of Object.entries(spec.actions)) {
		console.log(`  ${action.padEnd(10, " ")} ${actionSpec.summary}`);
	}

	if (spec.examples && spec.examples.length > 0) {
		console.log("");
		console.log("Examples:");
		for (const example of spec.examples) {
			console.log(`  ${example}`);
		}
	}

	console.log("");
	console.log(
		`Use \`bun run inbound ${group} <action> --help\` for action details.`,
	);
	return true;
}

export function printActionHelp(
	group: string,
	action: string,
	subaction?: string,
): boolean {
	const resolvedGroup = resolveGroupName(group);
	const groupSpec = GROUPS[resolvedGroup];
	if (!groupSpec) return false;

	const actionSpec = groupSpec.actions[action];
	if (!actionSpec) return false;

	if (subaction) {
		const subSpec = actionSpec.children?.[subaction];
		if (!subSpec) return false;
		return printActionSpec(group, action, subaction, subSpec);
	}

	return printActionSpec(group, action, undefined, actionSpec);
}

function printActionSpec(
	group: string,
	action: string,
	subaction: string | undefined,
	spec: ActionSpec,
): true {
	const title = subaction
		? `Command: ${group} ${action} ${subaction}`
		: `Command: ${group} ${action}`;
	console.log(title);
	console.log(spec.summary);
	console.log("");
	console.log("Usage:");
	console.log(`  ${spec.usage}`);

	if (spec.flags && spec.flags.length > 0) {
		console.log("");
		console.log("Flags:");
		for (const flag of spec.flags) {
			console.log(`  ${flag}`);
		}
	}

	if (spec.children && Object.keys(spec.children).length > 0) {
		console.log("");
		console.log("Subactions:");
		for (const [child, childSpec] of Object.entries(spec.children)) {
			console.log(`  ${child.padEnd(10, " ")} ${childSpec.summary}`);
		}
	}

	if (spec.examples && spec.examples.length > 0) {
		console.log("");
		console.log("Examples:");
		for (const example of spec.examples) {
			console.log(`  ${example}`);
		}
	}

	return true;
}

export function printHelpForTokens(tokens: string[]): boolean {
	if (tokens.length === 0) {
		printMainHelp();
		return true;
	}

	const [group, action, subaction] = tokens;
	const resolvedGroup = resolveGroupName(group);
	if (!GROUPS[resolvedGroup]) {
		return false;
	}

	if (!action) {
		return printGroupHelp(group);
	}

	if (!GROUPS[resolvedGroup].actions[action]) {
		return false;
	}

	if (!subaction) {
		return printActionHelp(group, action);
	}

	return printActionHelp(group, action, subaction);
}

export function validateCommandPath(tokens: string[]): ValidationIssue | null {
	const [group, action, subaction] = tokens;
	const resolvedGroup = group ? resolveGroupName(group) : group;

	if (!group || group === "help") return null;
	if (!GROUPS[resolvedGroup]) {
		return {
			kind: "unknown-group",
			group,
			suggestion: suggest(group, [
				...Object.keys(GROUPS),
				...Object.keys(GROUP_ALIASES),
			]),
		};
	}

	if (!action) {
		return { kind: "missing-action", group: resolvedGroup };
	}

	if (!GROUPS[resolvedGroup].actions[action]) {
		return {
			kind: "unknown-action",
			group: resolvedGroup,
			action,
			suggestion: suggest(action, ACTIONS_BY_GROUP[resolvedGroup]),
		};
	}

	const actionSpec = GROUPS[resolvedGroup].actions[action];
	if (actionSpec.children) {
		if (!subaction) {
			return { kind: "missing-subaction", group: resolvedGroup, action };
		}
		if (!actionSpec.children[subaction]) {
			return {
				kind: "unknown-subaction",
				group: resolvedGroup,
				action,
				subaction,
				suggestion: suggest(subaction, Object.keys(actionSpec.children)),
			};
		}
	}

	return null;
}

export function printValidationIssue(issue: ValidationIssue) {
	if (issue.kind === "unknown-group") {
		console.error(`Unknown group: ${issue.group}`);
		if (issue.suggestion) {
			console.error(`Did you mean: ${issue.suggestion}`);
		}
		console.error("Run `bun run inbound help` to see all groups.");
		return;
	}

	if (issue.kind === "unknown-action") {
		console.error(`Unknown action for '${issue.group}': ${issue.action}`);
		if (issue.suggestion) {
			console.error(`Did you mean: ${issue.suggestion}`);
		}
		printGroupHelp(issue.group);
		return;
	}

	if (issue.kind === "unknown-subaction") {
		console.error(
			`Unknown subaction for '${issue.group} ${issue.action}': ${issue.subaction}`,
		);
		if (issue.suggestion) {
			console.error(`Did you mean: ${issue.suggestion}`);
		}
		printActionHelp(issue.group, issue.action);
		return;
	}

	if (issue.kind === "missing-action") {
		printGroupHelp(issue.group);
		return;
	}

	printActionHelp(issue.group, issue.action);
}

export function isKnownGroup(group: string): boolean {
	return Boolean(GROUPS[resolveGroupName(group)]);
}

export function printCompletionScript(shell: string): boolean {
	if (shell === "bash") {
		console.log(buildBashCompletion());
		return true;
	}
	if (shell === "zsh") {
		console.log(buildZshCompletion());
		return true;
	}
	if (shell === "fish") {
		console.log(buildFishCompletion());
		return true;
	}
	return false;
}

function suggest(input: string, candidates: string[]): string | undefined {
	const normalized = input.toLowerCase();
	const startsWith = candidates.filter((candidate) =>
		candidate.toLowerCase().startsWith(normalized),
	);
	if (startsWith.length > 0) return startsWith[0];

	const includes = candidates.filter((candidate) =>
		candidate.toLowerCase().includes(normalized),
	);
	if (includes.length > 0) return includes[0];

	let best: { candidate: string; distance: number } | null = null;
	for (const candidate of candidates) {
		const distance = levenshtein(normalized, candidate.toLowerCase());
		if (!best || distance < best.distance) {
			best = { candidate, distance };
		}
	}

	if (best && best.distance <= 3) {
		return best.candidate;
	}

	return undefined;
}

function levenshtein(a: string, b: string): number {
	const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
		new Array<number>(b.length + 1).fill(0),
	);

	for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
	for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

	for (let i = 1; i <= a.length; i++) {
		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1,
				matrix[i][j - 1] + 1,
				matrix[i - 1][j - 1] + cost,
			);
		}
	}

	return matrix[a.length][b.length];
}

function buildBashCompletion(): string {
	return `#!/usr/bin/env bash
_inbound_complete() {
  local cur prev group sub
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD - 1]}"
  group="\${COMP_WORDS[1]}"
  sub="\${COMP_WORDS[2]}"

  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "mailbox draft domains addresses email-addresses emails endpoints attachments mail guard completion send help" -- "$cur") )
    return 0
  fi

  case "$group" in
    mailbox)
      COMPREPLY=( $(compgen -W "init list add use remove show find" -- "$cur") ) ;;
    domains)
      COMPREPLY=( $(compgen -W "list get create update delete" -- "$cur") ) ;;
    addresses)
      COMPREPLY=( $(compgen -W "list get create update delete" -- "$cur") ) ;;
    email-addresses)
      COMPREPLY=( $(compgen -W "list get create update delete" -- "$cur") ) ;;
    emails)
      COMPREPLY=( $(compgen -W "list get send update cancel reply retry" -- "$cur") ) ;;
    endpoints)
      COMPREPLY=( $(compgen -W "list get create update delete test" -- "$cur") ) ;;
    attachments)
      COMPREPLY=( $(compgen -W "get" -- "$cur") ) ;;
    guard)
      COMPREPLY=( $(compgen -W "list get create update delete check generate" -- "$cur") ) ;;
    draft)
      COMPREPLY=( $(compgen -W "init" -- "$cur") ) ;;
    completion)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "$cur") ) ;;
    send)
      COMPREPLY=() ;;
    mail)
      if [[ $COMP_CWORD -eq 2 ]]; then
        COMPREPLY=( $(compgen -W "threads" -- "$cur") )
      elif [[ "$sub" == "threads" ]]; then
        COMPREPLY=( $(compgen -W "list get" -- "$cur") )
      fi
      ;;
  esac
}
complete -F _inbound_complete inbound`;
}

function buildZshCompletion(): string {
	return `#compdef inbound

_inbound() {
  local -a groups
  local -a actions
  groups=(mailbox draft domains addresses email-addresses emails endpoints attachments mail guard completion send help)

  if (( CURRENT == 2 )); then
    _describe 'group' groups
    return
  fi

  case "\${words[2]}" in
    mailbox) actions=(init list add use remove show find) ;;
    domains) actions=(list get create update delete) ;;
    addresses) actions=(list get create update delete) ;;
    email-addresses) actions=(list get create update delete) ;;
    emails) actions=(list get send update cancel reply retry) ;;
    endpoints) actions=(list get create update delete test) ;;
    attachments) actions=(get) ;;
    guard) actions=(list get create update delete check generate) ;;
    draft) actions=(init) ;;
    completion) actions=(bash zsh fish) ;;
    send) actions=() ;;
    mail)
      if (( CURRENT == 3 )); then
        _describe 'mail command' '(threads)'
        return
      fi
      if [[ "\${words[3]}" == "threads" && CURRENT == 4 ]]; then
        _describe 'threads action' '(list get)'
      fi
      return
      ;;
  esac

  if (( CURRENT == 3 )); then
    _describe 'action' actions
  fi
}

compdef _inbound inbound`;
}

function buildFishCompletion(): string {
	return `complete -c inbound -f
complete -c inbound -n '__fish_use_subcommand' -a 'mailbox draft domains addresses email-addresses emails endpoints attachments mail guard completion send help'

complete -c inbound -n '__fish_seen_subcommand_from mailbox' -a 'init list add use remove show find'
complete -c inbound -n '__fish_seen_subcommand_from domains' -a 'list get create update delete'
complete -c inbound -n '__fish_seen_subcommand_from addresses' -a 'list get create update delete'
complete -c inbound -n '__fish_seen_subcommand_from email-addresses' -a 'list get create update delete'
complete -c inbound -n '__fish_seen_subcommand_from emails' -a 'list get send update cancel reply retry'
complete -c inbound -n '__fish_seen_subcommand_from endpoints' -a 'list get create update delete test'
complete -c inbound -n '__fish_seen_subcommand_from attachments' -a 'get'
complete -c inbound -n '__fish_seen_subcommand_from guard' -a 'list get create update delete check generate'
complete -c inbound -n '__fish_seen_subcommand_from draft' -a 'init'
complete -c inbound -n '__fish_seen_subcommand_from completion' -a 'bash zsh fish'

complete -c inbound -n '__fish_seen_subcommand_from mail; and not __fish_seen_subcommand_from threads' -a 'threads'
complete -c inbound -n '__fish_seen_subcommand_from threads' -a 'list get'`;
}
