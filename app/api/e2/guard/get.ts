import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "@/lib/db";
import { guardRules } from "@/lib/db/schema";
import { validateAndRateLimit } from "../lib/auth";

// Guard rule schema for response
const GuardRuleSchema = t.Object({
	id: t.String(),
	userId: t.String(),
	name: t.String(),
	description: t.Nullable(t.String()),
	type: t.String(),
	config: t.String(),
	isActive: t.Nullable(t.Boolean()),
	priority: t.Nullable(t.Number()),
	lastTriggeredAt: t.Nullable(t.String()),
	triggerCount: t.Nullable(t.Number()),
	actions: t.Nullable(t.String()),
	createdAt: t.Nullable(t.String()),
	updatedAt: t.Nullable(t.String()),
});

const ErrorResponse = t.Object({
	error: t.String(),
});

export const getGuardRule = new Elysia().get(
	"/guard/:id",
	async ({ request, params, set }) => {
		console.log("🔍 GET /api/e2/guard/:id - Getting rule:", params.id);

		// Auth & rate limit validation
		const userId = await validateAndRateLimit(request, set);
		console.log("✅ Authentication successful for userId:", userId);

		const [rule] = await db
			.select()
			.from(guardRules)
			.where(and(eq(guardRules.id, params.id), eq(guardRules.userId, userId)))
			.limit(1);

		if (!rule) {
			console.log("❌ Guard rule not found:", params.id);
			set.status = 404;
			return { error: "Guard rule not found" };
		}

		console.log("✅ Found guard rule:", rule.id);

		return {
			id: rule.id,
			userId: rule.userId,
			name: rule.name,
			description: rule.description,
			type: rule.type,
			config: rule.config,
			isActive: rule.isActive,
			priority: rule.priority,
			lastTriggeredAt: rule.lastTriggeredAt?.toISOString() || null,
			triggerCount: rule.triggerCount,
			actions: rule.actions,
			createdAt: rule.createdAt?.toISOString() || null,
			updatedAt: rule.updatedAt?.toISOString() || null,
		};
	},
	{
		params: t.Object({
			id: t.String(),
		}),
		response: {
			200: GuardRuleSchema,
			401: ErrorResponse,
			404: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			tags: ["Guard"],
			summary: "Get guard rule",
			description: "Get a specific guard rule by ID.",
		},
	},
);
