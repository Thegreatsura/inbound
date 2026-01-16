import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "@/lib/db";
import { guardRules } from "@/lib/db/schema";
import { validateAndRateLimit } from "../lib/auth";

// Response schemas
const DeleteGuardRuleResponse = t.Object({
	success: t.Boolean(),
});

const ErrorResponse = t.Object({
	error: t.String(),
});

export const deleteGuardRule = new Elysia().delete(
	"/guard/:id",
	async ({ request, params, set }) => {
		console.log("🗑️ DELETE /api/e2/guard/:id - Deleting rule:", params.id);

		// Auth & rate limit validation
		const userId = await validateAndRateLimit(request, set);
		console.log("✅ Authentication successful for userId:", userId);

		// Check if rule exists and belongs to user
		const [existingRule] = await db
			.select()
			.from(guardRules)
			.where(and(eq(guardRules.id, params.id), eq(guardRules.userId, userId)))
			.limit(1);

		if (!existingRule) {
			console.log("❌ Guard rule not found:", params.id);
			set.status = 404;
			return { error: "Guard rule not found" };
		}

		try {
			await db.delete(guardRules).where(eq(guardRules.id, params.id));

			console.log("✅ Guard rule deleted:", params.id);

			return {
				success: true,
			};
		} catch (error) {
			console.error("❌ Failed to delete guard rule:", error);
			set.status = 500;
			return {
				error:
					error instanceof Error
						? error.message
						: "Failed to delete guard rule",
			};
		}
	},
	{
		params: t.Object({
			id: t.String(),
		}),
		response: {
			200: DeleteGuardRuleResponse,
			401: ErrorResponse,
			404: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			tags: ["Guard"],
			summary: "Delete guard rule",
			description: "Delete a guard rule by ID.",
		},
	},
);
