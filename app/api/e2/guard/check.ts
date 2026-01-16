import { Elysia, t } from "elysia";
import { checkRuleMatch } from "@/lib/guard/rule-matcher";
import { validateAndRateLimit } from "../lib/auth";

// Request schema
const CheckRuleMatchBody = t.Object({
	structuredEmailId: t.String({
		description: "ID of the email to test against the rule",
	}),
});

// Response schemas
const CheckRuleMatchSuccessResponse = t.Object({
	matched: t.Boolean(),
	matchDetails: t.Optional(
		t.Array(
			t.Object({
				criteria: t.String(),
				value: t.String(),
			}),
		),
	),
	reason: t.Optional(t.String()),
});

const CheckRuleMatchErrorResponse = t.Object({
	matched: t.Literal(false),
	error: t.String(),
});

const ErrorResponse = t.Object({
	error: t.String(),
});

export const checkGuardRule = new Elysia().post(
	"/guard/:id/check",
	async ({ request, params, body, set }) => {
		console.log("🧪 POST /api/e2/guard/:id/check - Testing rule:", params.id);

		// Auth & rate limit validation
		const userId = await validateAndRateLimit(request, set);
		console.log("✅ Authentication successful for userId:", userId);

		const { structuredEmailId } = body;

		if (!structuredEmailId) {
			set.status = 400;
			return { error: "structuredEmailId is required" };
		}

		try {
			const result = await checkRuleMatch(params.id, structuredEmailId, userId);

			console.log(
				"🧪 Rule check result:",
				result.matched ? "matched" : "no match",
			);

			// Return the result directly - it matches our response schema
			return result;
		} catch (error) {
			console.error("❌ Failed to check rule match:", error);
			set.status = 500;
			return {
				error:
					error instanceof Error ? error.message : "Failed to check rule match",
			};
		}
	},
	{
		params: t.Object({
			id: t.String(),
		}),
		body: CheckRuleMatchBody,
		response: {
			200: t.Union([
				CheckRuleMatchSuccessResponse,
				CheckRuleMatchErrorResponse,
			]),
			400: ErrorResponse,
			401: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			tags: ["Guard"],
			summary: "Check if rule matches email",
			description:
				"Test a guard rule against a specific email to see if it would match.",
		},
	},
);
