import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";

export type MailboxConfig = {
	name: string;
	email: string;
	addresses: string[];
	domains: string[];
};

export type InboundConfig = {
	version: 1;
	api?: {
		baseUrl?: string;
	};
	mailbox?: {
		default?: string;
		mailboxes: Record<string, MailboxConfig>;
	};
};

export const DEFAULT_CONFIG: InboundConfig = {
	version: 1,
	api: {
		baseUrl: "https://inbound.new",
	},
	mailbox: {
		default: "primary",
		mailboxes: {
			primary: {
				name: "Primary",
				email: "support@example.com",
				addresses: ["support@example.com"],
				domains: ["example.com"],
			},
		},
	},
};

export type LoadedConfig = {
	path: string | null;
	config: InboundConfig;
};

function normalizeMailboxConfig(input: Partial<MailboxConfig>): MailboxConfig {
	return {
		name: input.name?.trim() || "Mailbox",
		email: input.email?.trim().toLowerCase() || "",
		addresses: (input.addresses || [])
			.map((value) => value.trim().toLowerCase())
			.filter(Boolean),
		domains: (input.domains || [])
			.map((value) => value.trim().toLowerCase())
			.filter(Boolean),
	};
}

export function validateConfig(config: InboundConfig): InboundConfig {
	const baseUrl = config.api?.baseUrl?.trim();
	const mailboxes = config.mailbox?.mailboxes || {};
	const normalizedMailboxes: Record<string, MailboxConfig> = {};

	for (const [key, mailbox] of Object.entries(mailboxes)) {
		normalizedMailboxes[key] = normalizeMailboxConfig(mailbox);
	}

	return {
		version: 1,
		api: {
			baseUrl: baseUrl || undefined,
		},
		mailbox: {
			default: config.mailbox?.default,
			mailboxes: normalizedMailboxes,
		},
	};
}

export function findConfigPath(startDir = process.cwd()): string | null {
	let current = resolve(startDir);

	while (true) {
		const candidate = join(current, "inbound.json");
		if (existsSync(candidate)) {
			return candidate;
		}

		const parent = dirname(current);
		if (parent === current) {
			return null;
		}

		current = parent;
	}
}

export async function loadConfig(explicitPath?: string): Promise<LoadedConfig> {
	const configPath = explicitPath
		? resolve(explicitPath)
		: findConfigPath(process.cwd());

	if (!configPath) {
		return { path: null, config: validateConfig(DEFAULT_CONFIG) };
	}

	const raw = await readFile(configPath, "utf8");
	const parsed = JSON.parse(raw) as InboundConfig;
	return { path: configPath, config: validateConfig(parsed) };
}

export async function saveConfig(
	path: string,
	config: InboundConfig,
): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(
		path,
		JSON.stringify(validateConfig(config), null, 2) + "\n",
		"utf8",
	);
}

export function getDefaultConfigPath(): string {
	return join(process.cwd(), "inbound.json");
}

export function ensureConfigPath(path: string | null): string {
	if (path) return path;
	return getDefaultConfigPath();
}

export function configName(path: string | null): string {
	if (!path) return "inbound.json (not found; using defaults)";
	return basename(path);
}

export function findMailboxes(
	config: InboundConfig,
	addresses: string[],
	domains: string[],
): Array<{ key: string; mailbox: MailboxConfig }> {
	const setAddresses = new Set(
		addresses.map((value) => value.trim().toLowerCase()),
	);
	const setDomains = new Set(
		domains.map((value) => value.trim().toLowerCase()),
	);
	const entries = Object.entries(config.mailbox?.mailboxes || {});

	return entries
		.filter(([_, mailbox]) => {
			const mailboxAddresses = mailbox.addresses || [];
			const mailboxDomains = mailbox.domains || [];

			const hasAddress =
				setAddresses.size === 0 ||
				mailboxAddresses.some((value) => setAddresses.has(value.toLowerCase()));
			const hasDomain =
				setDomains.size === 0 ||
				mailboxDomains.some((value) => setDomains.has(value.toLowerCase()));

			return hasAddress && hasDomain;
		})
		.map(([key, mailbox]) => ({ key, mailbox }));
}
