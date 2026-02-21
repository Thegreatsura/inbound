import { describe, expect, it } from "bun:test";
import {
	buildInboundDeterministicId,
	normalizeMessageIdForDedupe,
	normalizeRecipientForDedupe,
} from "@/lib/email-management/inbound-dedupe";

describe("inbound dedupe normalization", () => {
	it("normalizes recipient casing and whitespace", () => {
		expect(normalizeRecipientForDedupe("  User+Tag@Example.COM  ")).toBe(
			"user+tag@example.com",
		);
	});

	it("normalizes Message-ID variants consistently", () => {
		expect(normalizeMessageIdForDedupe("<ABC-123@MAIL.EXAMPLE>")).toBe(
			"abc-123@mail.example",
		);
		expect(normalizeMessageIdForDedupe("abc-123@mail.example")).toBe(
			"abc-123@mail.example",
		);
		expect(normalizeMessageIdForDedupe("  <AbC-123@mail.example>  ")).toBe(
			"abc-123@mail.example",
		);
	});
});

describe("strict inbound dedupe identity", () => {
	it("returns same deterministic id for same Message-ID + same recipient", () => {
		const normalizedMessageId = normalizeMessageIdForDedupe("<Msg-001@Example>");
		const idA = buildInboundDeterministicId(
			"inbnd",
			"ses_1",
			"User@Example.com",
			normalizedMessageId,
		);
		const idB = buildInboundDeterministicId(
			"inbnd",
			"ses_2",
			"user@example.com",
			normalizeMessageIdForDedupe("msg-001@example"),
		);

		expect(idA).toBe(idB);
	});

	it("returns different deterministic ids for same Message-ID + different recipients", () => {
		const normalizedMessageId = normalizeMessageIdForDedupe("<Msg-001@Example>");
		const idA = buildInboundDeterministicId(
			"inbnd",
			"ses_1",
			"user-a@example.com",
			normalizedMessageId,
		);
		const idB = buildInboundDeterministicId(
			"inbnd",
			"ses_1",
			"user-b@example.com",
			normalizedMessageId,
		);

		expect(idA).not.toBe(idB);
	});
});
