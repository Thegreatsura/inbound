import { describe, expect, it } from "bun:test";
import type { ExplicitRuleConfig } from "@/features/guard/types";
import type { structuredEmails } from "@/lib/db/schema";

type StructuredEmail = typeof structuredEmails.$inferSelect;

process.env.DATABASE_URL ??= "postgresql://user:password@example.com/database";

const { checkExplicitRule } = await import("@/lib/guard/rule-matcher");

function buildStructuredEmail(overrides: Partial<StructuredEmail>): StructuredEmail {
	return {
		id: "email_1",
		emailId: "email_1",
		sesEventId: "ses_1",
		messageId: "<message@example.com>",
		date: null,
		subject: "Hello",
		recipient: "inbox-b@example.com",
		fromData: null,
		toData: null,
		ccData: null,
		bccData: null,
		replyToData: null,
		inReplyTo: null,
		references: null,
		textBody: null,
		htmlBody: null,
		rawContent: null,
		attachments: null,
		headers: null,
		priority: null,
		parseSuccess: true,
		parseError: null,
		isRead: false,
		readAt: null,
		isArchived: false,
		archivedAt: null,
		guardBlocked: false,
		guardReason: null,
		guardRuleId: null,
		guardAction: null,
		guardMetadata: null,
		userId: "user_1",
		createdAt: null,
		updatedAt: null,
		threadId: null,
		threadPosition: null,
		...overrides,
	};
}

describe("guard explicit To rules", () => {
	it("matches against the delivered recipient instead of every visible To header address", async () => {
		const config: ExplicitRuleConfig = {
			to: {
				operator: "OR",
				values: ["inbox-a@example.com"],
			},
		};
		const email = buildStructuredEmail({
			recipient: "inbox-b@example.com",
			toData: JSON.stringify({
				text: "inbox-a@example.com, inbox-b@example.com",
				addresses: [
					{ name: null, address: "inbox-a@example.com" },
					{ name: null, address: "inbox-b@example.com" },
				],
			}),
		});

		await expect(checkExplicitRule(config, email)).resolves.toMatchObject({
			matched: false,
		});
	});
});
