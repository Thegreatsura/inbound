import { describe, expect, it } from "bun:test";
import { parseArgv } from "../src/lib/argv";

describe("parseArgv", () => {
	it("parses positionals and repeated options", () => {
		const parsed = parseArgv([
			"emails",
			"list",
			"--address",
			"a@example.com",
			"--address",
			"b@example.com",
			"--json",
		]);

		expect(parsed.positionals).toEqual(["emails", "list"]);
		expect(parsed.options.address).toEqual(["a@example.com", "b@example.com"]);
		expect(parsed.options.json).toBe(true);
	});
});
