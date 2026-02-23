import { describe, expect, it } from "bun:test";
import type { Inbound } from "inboundemail";
import { runApiCommand } from "../src/commands";
import type { InboundConfig } from "../src/config/inbound-config";
import { parseArgv } from "../src/lib/argv";
import type { CliContext, GlobalOptions } from "../src/types";

const baseConfig: InboundConfig = {
	version: 1,
	mailbox: {
		default: "support",
		mailboxes: {
			support: {
				name: "Inbound Support",
				email: "support@inbound.new",
				addresses: ["support@inbound.new"],
				domains: ["inbound.new"],
			},
		},
	},
};

const baseGlobals: GlobalOptions = {
	apiKey: "test-api-key",
	baseUrl: "https://inbound.new",
	asJson: false,
	debug: false,
	addresses: [],
	domains: [],
	mergeFilters: false,
};

function createCtx(args: string[], sdk: Inbound): CliContext {
	return {
		parsed: parseArgv(args),
		globals: baseGlobals,
		config: baseConfig,
		configPath: null,
		sdk,
	};
}

describe("emails send reply mode", () => {
	it("rejects reply_to header field when reply_to_id is provided", async () => {
		let replyCalled = false;
		const sdk = {
			emails: {
				send: async () => ({ id: "email_send_test" }),
				reply: async () => {
					replyCalled = true;
					return { id: "email_reply_test" };
				},
			},
		} as unknown as Inbound;

		const payload = {
			from: "support@inbound.new",
			to: "user@example.com",
			subject: "Re: Test",
			text: "Reply body",
			reply_to_id: "inbnd_123",
			reply_to: "reply@example.com",
		};

		const ctx = createCtx(
			["emails", "send", "--data", JSON.stringify(payload)],
			sdk,
		);

		await expect(runApiCommand(ctx)).rejects.toThrow(
			"These fields are not supported when ReplyTo targets an inbound email id: reply_to",
		);
		expect(replyCalled).toBe(false);
	});
});
