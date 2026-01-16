import { Elysia, t } from "elysia";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { guardRules } from "@/lib/db/schema";
import { validateAndRateLimit } from "../lib/auth";

// Request schema
const CreateGuardRuleBody = t.Object({
	name: t.String({ minLength: 1, description: "Rule name" }),
	description: t.Optional(t.String({ description: "Rule description" })),
	type: t.Union([t.Literal("explicit"), t.Literal("ai_prompt")], {
		description: "Rule type",
	}),
	config: t.Any({ description: "Rule configuration (JSON)" }),
	priority: t.Optional(
		t.Number({ description: "Rule priority (higher = evaluated first)" }),
	),
	action: t.Optional(t.Any({ description: "Rule action configuration" })),
});

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

// Response schema - matches the envelope format expected by hooks
const CreateGuardRuleResponse = t.Object({
	success: t.Literal(true),
	data: GuardRuleSchema,
});

const ErrorResponse = t.Object({
	error: t.String(),
});

export const createGuardRule = new Elysia().post(
	"/guard",
	async ({ request, body, set }) => {
		console.log("📝 POST /api/e2/guard - Creating guard rule");

		// Auth & rate limit validation
		const userId = await validateAndRateLimit(request, set);
		console.log("✅ Authentication successful for userId:", userId);

		const { name, description, type, config, priority, action } = body;

		// Validate name
		if (!name?.trim()) {
			set.status = 400;
			return { error: "Rule name is required" };
		}

		// Serialize config to JSON string
		const configJson =
			typeof config === "string" ? config : JSON.stringify(config);
		const actionsJson = action
			? typeof action === "string"
				? action
				: JSON.stringify(action)
			: null;

		try {
			const ruleId = nanoid();
			const now = new Date();

			const [newRule] = await db
				.insert(guardRules)
				.values({
					id: ruleId,
					userId,
					name: name.trim(),
					description: description?.trim() || null,
					type,
					config: configJson,
					isActive: true,
					priority: priority ?? 0,
					triggerCount: 0,
					actions: actionsJson,
					createdAt: now,
					updatedAt: now,
				})
				.returning();

			console.log("✅ Guard rule created:", ruleId);

			set.status = 201;
			return {
				success: true as const,
				data: {
					id: newRule.id,
					userId: newRule.userId,
					name: newRule.name,
					description: newRule.description,
					type: newRule.type,
					config: newRule.config,
					isActive: newRule.isActive,
					priority: newRule.priority,
					lastTriggeredAt: newRule.lastTriggeredAt?.toISOString() || null,
					triggerCount: newRule.triggerCount,
					actions: newRule.actions,
					createdAt: newRule.createdAt?.toISOString() || null,
					updatedAt: newRule.updatedAt?.toISOString() || null,
				},
			};
		} catch (error) {
			console.error("❌ Failed to create guard rule:", error);
			set.status = 500;
			return {
				error:
					error instanceof Error
						? error.message
						: "Failed to create guard rule",
			};
		}
	},
	{
		body: CreateGuardRuleBody,
		response: {
			201: CreateGuardRuleResponse,
			400: ErrorResponse,
			401: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			tags: ["Guard"],
			summary: "Create guard rule",
			description: "Create a new email filtering guard rule.",
		},
	},
);
