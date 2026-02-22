import { describe, expect, it } from "bun:test";
import type { InboundConfig } from "../src/config/inbound-config";
import {
	buildFanoutQueries,
	resolveMailboxFilters,
} from "../src/mailbox/resolve";

const config: InboundConfig = {
	version: 1,
	mailbox: {
		default: "team",
		mailboxes: {
			team: {
				name: "Team",
				email: "team@example.com",
				addresses: ["team@example.com"],
				domains: ["example.com"],
			},
		},
	},
};

describe("resolveMailboxFilters", () => {
	it("uses defaults when no overrides", () => {
		const resolved = resolveMailboxFilters({
			config,
			addressOverrides: [],
			domainOverrides: [],
			mergeFilters: false,
		});

		expect(resolved.mailboxName).toBe("team");
		expect(resolved.addresses).toEqual(["team@example.com"]);
		expect(resolved.domains).toEqual(["example.com"]);
	});

	it("replaces defaults when overrides are passed", () => {
		const resolved = resolveMailboxFilters({
			config,
			addressOverrides: ["override@example.com"],
			domainOverrides: [],
			mergeFilters: false,
		});

		expect(resolved.addresses).toEqual(["override@example.com"]);
		expect(resolved.domains).toEqual(["example.com"]);
	});
});

describe("buildFanoutQueries", () => {
	it("creates address/domain fanout queries", () => {
		const queries = buildFanoutQueries({
			addresses: ["a@example.com", "b@example.com"],
			domains: ["example.com"],
		});

		expect(queries).toEqual([
			{ address: "a@example.com" },
			{ address: "b@example.com" },
			{ domain: "example.com" },
		]);
	});
});
