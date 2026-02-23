import { describe, expect, it } from "bun:test";
import {
	createInboundDraftTemplate,
	parseInboundDraft,
	validateSendPayload,
} from "../src/lib/draft";

describe("parseInboundDraft", () => {
	it("parses required headers and text body", () => {
		const draft = parseInboundDraft(
			[
				"From: support@inbound.new",
				"To: one@example.com, two@example.com",
				"Cc: cc@example.com",
				"Subject: Hello there",
				"",
				"Plain text body",
			].join("\n"),
		);

		expect(draft.from).toBe("support@inbound.new");
		expect(draft.to).toEqual(["one@example.com", "two@example.com"]);
		expect(draft.cc).toBe("cc@example.com");
		expect(draft.subject).toBe("Hello there");
		expect(draft.text).toBe("Plain text body");
	});

	it("maps html body from content-type", () => {
		const draft = parseInboundDraft(
			[
				"From: support@inbound.new",
				"To: one@example.com",
				"Subject: HTML",
				"Content-Type: text/html",
				"",
				"<p>Hello</p>",
			].join("\n"),
		);

		expect(draft.html).toBe("<p>Hello</p>");
		expect(draft.text).toBeUndefined();
	});

	it("parses ReplyTo as inbound reply target id", () => {
		const draft = parseInboundDraft(
			[
				"From: support@inbound.new",
				"To: one@example.com",
				"ReplyTo: inbnd_123",
				"Subject: Re",
				"",
				"Reply body",
			].join("\n"),
		);

		expect(draft.reply_to_id).toBe("inbnd_123");
	});

	it("throws on unsupported headers", () => {
		expect(() =>
			parseInboundDraft(
				[
					"From: support@inbound.new",
					"To: one@example.com",
					"Subject: Hello",
					"X-Unknown: value",
				].join("\n"),
			),
		).toThrow("Unsupported draft header");
	});
});

describe("validateSendPayload", () => {
	it("accepts valid payload", () => {
		expect(() =>
			validateSendPayload({
				from: "support@inbound.new",
				to: ["one@example.com"],
				subject: "Hello",
			}),
		).not.toThrow();
	});

	it("rejects missing required fields", () => {
		expect(() => validateSendPayload({ to: "one@example.com" })).toThrow(
			"Missing required send field(s)",
		);
	});
});

describe("createInboundDraftTemplate", () => {
	it("includes standard draft headers", () => {
		const template = createInboundDraftTemplate();

		expect(template).toContain("From: Support <support@inbound.new>");
		expect(template).toContain("From:");
		expect(template).toContain("To:");
		expect(template).toContain("Subject:");
		expect(template).toContain("Cc:");
		expect(template).toContain("Bcc:");
		expect(template).toContain("ReplyTo:");
		expect(template).toContain("Reply-To:");
	});
});
