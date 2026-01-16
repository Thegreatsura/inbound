import { generateObject } from "ai";
import { Elysia, t } from "elysia";
import { z } from "zod";
import { getModel } from "@/lib/ai/provider";
import { validateAndRateLimit } from "../lib/auth";

// Request schema
const GenerateRulesBody = t.Object({
	prompt: t.String({
		minLength: 1,
		description: "Natural language description of the rule",
	}),
});

// Explicit rule config schema for response
const ExplicitRuleConfigSchema = t.Object({
	mode: t.Optional(t.Union([t.Literal("simple"), t.Literal("advanced")])),
	subject: t.Optional(
		t.Object({
			operator: t.Union([t.Literal("OR"), t.Literal("AND")]),
			values: t.Array(t.String()),
		}),
	),
	from: t.Optional(
		t.Object({
			operator: t.Union([t.Literal("OR"), t.Literal("AND")]),
			values: t.Array(t.String()),
		}),
	),
	hasAttachment: t.Optional(t.Boolean()),
	hasWords: t.Optional(
		t.Object({
			operator: t.Union([t.Literal("OR"), t.Literal("AND")]),
			values: t.Array(t.String()),
		}),
	),
});

// Response schemas
const GenerateRulesSuccessResponse = t.Object({
	config: ExplicitRuleConfigSchema,
});

const GenerateRulesErrorResponse = t.Object({
	config: t.Object({}),
	error: t.String(),
});

const ErrorResponse = t.Object({
	error: t.String(),
});

export const generateGuardRules = new Elysia().post(
	"/guard/generate",
	async ({ request, body, set }) => {
		console.log("🤖 POST /api/e2/guard/generate - Generating rule from prompt");

		// Auth & rate limit validation
		const userId = await validateAndRateLimit(request, set);
		console.log("✅ Authentication successful for userId:", userId);

		const { prompt } = body;

		if (!prompt?.trim()) {
			set.status = 400;
			return { error: "Prompt is required" };
		}

		try {
			const model = getModel();

			// Define the schema for explicit rule config
			const explicitRuleConfigSchema = z.object({
				mode: z.enum(["simple", "advanced"]).optional().default("simple"),
				subject: z
					.object({
						operator: z.enum(["OR", "AND"]),
						values: z.array(z.string()),
					})
					.optional(),
				from: z
					.object({
						operator: z.enum(["OR", "AND"]),
						values: z
							.array(z.string())
							.describe("Email addresses or patterns like *@domain.com"),
					})
					.optional(),
				hasAttachment: z.boolean().optional(),
				hasWords: z
					.object({
						operator: z.enum(["OR", "AND"]),
						values: z.array(z.string()),
					})
					.optional(),
			});

			const systemPrompt = `You are an email rule generator. Convert the user's natural language description into a structured email filtering rule configuration.

Available rule criteria:
- subject: Match email subjects containing specific words/phrases
- from: Match sender email addresses (supports wildcards like *@domain.com for whole domains)
- hasAttachment: Match emails with/without attachments
- hasWords: Match emails with body containing specific words/phrases

Operators:
- OR: Match if ANY of the values match
- AND: Match if ALL values match

Examples:
- "Block emails from marketing@spam.com" -> { from: { operator: "OR", values: ["marketing@spam.com"] } }
- "Filter all emails from example.com domain" -> { from: { operator: "OR", values: ["*@example.com"] } }
- "Match emails with urgent or important in subject" -> { subject: { operator: "OR", values: ["urgent", "important"] } }
- "Match emails with attachments" -> { hasAttachment: true }

Generate a config that best matches the user's intent. Only include relevant criteria.`;

			const { object } = await generateObject({
				model: model as any, // Type assertion for AI SDK version compatibility
				schema: explicitRuleConfigSchema,
				schemaName: "ExplicitRuleConfig",
				schemaDescription: "Configuration for an explicit email filtering rule",
				system: systemPrompt,
				prompt: prompt,
				temperature: 0.1,
			});

			console.log("🤖 Generated rule config:", object);

			return {
				config: object,
			};
		} catch (error) {
			console.error("❌ Failed to generate rule:", error);
			return {
				config: {},
				error:
					error instanceof Error
						? error.message
						: "Failed to generate rule configuration",
			};
		}
	},
	{
		body: GenerateRulesBody,
		response: {
			200: t.Union([GenerateRulesSuccessResponse, GenerateRulesErrorResponse]),
			400: ErrorResponse,
			401: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			tags: ["Guard"],
			summary: "Generate rule from natural language",
			description:
				"Use AI to convert a natural language description into an explicit guard rule configuration.",
		},
	},
);
