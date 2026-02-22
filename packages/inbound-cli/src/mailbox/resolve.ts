import type { InboundConfig } from "../config/inbound-config";

export type MailboxFilterContext = {
	mailboxName?: string;
	addresses: string[];
	domains: string[];
};

function normalize(values: string[]): string[] {
	return [
		...new Set(
			values.map((value) => value.trim().toLowerCase()).filter(Boolean),
		),
	];
}

export function resolveMailboxFilters(input: {
	config: InboundConfig;
	selectedMailbox?: string;
	addressOverrides: string[];
	domainOverrides: string[];
	mergeFilters: boolean;
}): MailboxFilterContext {
	const mailboxes = input.config.mailbox?.mailboxes || {};
	const defaultMailboxName = input.config.mailbox?.default;
	const mailboxName = input.selectedMailbox || defaultMailboxName;
	const mailbox = mailboxName ? mailboxes[mailboxName] : undefined;

	const defaultAddresses = mailbox
		? mailbox.addresses.length > 0
			? mailbox.addresses
			: mailbox.email
				? [mailbox.email]
				: []
		: [];
	const defaultDomains = mailbox?.domains || [];

	const overrideAddresses = normalize(input.addressOverrides);
	const overrideDomains = normalize(input.domainOverrides);

	let addresses = normalize(defaultAddresses);
	let domains = normalize(defaultDomains);

	if (input.mergeFilters) {
		addresses = normalize([...addresses, ...overrideAddresses]);
		domains = normalize([...domains, ...overrideDomains]);
	} else {
		if (overrideAddresses.length > 0) {
			addresses = overrideAddresses;
		}
		if (overrideDomains.length > 0) {
			domains = overrideDomains;
		}
	}

	return {
		mailboxName,
		addresses,
		domains,
	};
}

export function buildFanoutQueries(filters: {
	addresses: string[];
	domains: string[];
}): Array<{ address?: string; domain?: string }> {
	const addresses = normalize(filters.addresses);
	const domains = normalize(filters.domains);

	if (addresses.length === 0 && domains.length === 0) {
		return [{}];
	}

	if (addresses.length <= 1 && domains.length <= 1) {
		return [
			{
				address: addresses[0],
				domain: domains[0],
			},
		];
	}

	const results: Array<{ address?: string; domain?: string }> = [];
	for (const address of addresses) {
		results.push({ address });
	}
	for (const domain of domains) {
		results.push({ domain });
	}

	return results;
}

export function dedupeById<T extends { id?: string }>(items: T[]): T[] {
	const byId = new Map<string, T>();
	const withoutId: T[] = [];

	for (const item of items) {
		if (item.id) {
			byId.set(item.id, item);
		} else {
			withoutId.push(item);
		}
	}

	return [...byId.values(), ...withoutId];
}
