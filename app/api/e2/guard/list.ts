import { and, desc, eq, like, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "@/lib/db";
import { guardRules } from "@/lib/db/schema";
import { validateAndRateLimit } from "../lib/auth";

// Query parameters schema
const ListGuardRulesQuerySchema = t.Object({
	search: t.Optional(
		t.String({ description: "Search by rule name or description" }),
	),
	type: t.Optional(
		t.Union([t.Literal("explicit"), t.Literal("ai_prompt")], {
			description: "Filter by rule type",
		}),
	),
	isActive: t.Optional(
		t.String({ description: "Filter by active status (true/false)" }),
	),
	limit: t.Optional(
		t.String({ description: "Max results (1-100, default 50)" }),
	),
	offset: t.Optional(t.String({ description: "Number to skip (default 0)" })),
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

// Response schema
const ListGuardRulesResponse = t.Object({
	success: t.Literal(true),
	data: t.Array(GuardRuleSchema),
	pagination: t.Object({
		total: t.Number(),
		limit: t.Number(),
		offset: t.Number(),
		hasMore: t.Boolean(),
	}),
});

const ErrorResponse = t.Object({
	error: t.String(),
});

export const listGuardRules = new Elysia().get(
	"/guard",
	async ({ request, query, set }) => {
		console.log("📋 GET /api/e2/guard - Starting request");

		// Auth & rate limit validation
		const userId = await validateAndRateLimit(request, set);
		console.log("✅ Authentication successful for userId:", userId);

		// Parse query parameters
		const limit = Math.min(Math.max(parseInt(query.limit || "50"), 1), 100);
		const offset = Math.max(parseInt(query.offset || "0"), 0);
		const search = query.search?.trim();
		const type = query.type;
		const isActive =
			query.isActive === "true"
				? true
				: query.isActive === "false"
					? false
					: undefined;

		console.log("🔍 Query params:", { limit, offset, search, type, isActive });

		// Build where conditions
		const conditions = [eq(guardRules.userId, userId)];

		if (type) {
			conditions.push(eq(guardRules.type, type));
		}

		if (isActive !== undefined) {
			conditions.push(eq(guardRules.isActive, isActive));
		}

		if (search) {
			conditions.push(
				sql`(${guardRules.name} ILIKE ${`%${search}%`} OR ${guardRules.description} ILIKE ${`%${search}%`})`,
			);
		}

		// Get total count
		const [countResult] = await db
			.select({ count: sql<number>`count(*)` })
			.from(guardRules)
			.where(and(...conditions));

		const total = Number(countResult?.count || 0);

		// Get rules with pagination
		const rules = await db
			.select()
			.from(guardRules)
			.where(and(...conditions))
			.orderBy(desc(guardRules.priority), desc(guardRules.createdAt))
			.limit(limit)
			.offset(offset);

		console.log(`📊 Found ${rules.length} rules (total: ${total})`);

		return {
			success: true as const,
			data: rules.map((rule) => ({
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
			})),
			pagination: {
				total,
				limit,
				offset,
				hasMore: offset + rules.length < total,
			},
		};
	},
	{
		query: ListGuardRulesQuerySchema,
		response: {
			200: ListGuardRulesResponse,
			401: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			tags: ["Guard"],
			summary: "List guard rules",
			description:
				"Get all guard rules for the authenticated user with optional filtering and pagination.",
		},
	},
);
