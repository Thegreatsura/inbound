import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "@/lib/db";
import { blockedSignupDomains } from "@/lib/db/schema";
import { validateAdminAndRateLimit } from "../lib/auth";
import { formatBlockedSignupDomain } from "./shared";

const BlockedSignupDomainSchema = t.Object({
	id: t.String(),
	domain: t.String(),
	reason: t.Nullable(t.String()),
	isActive: t.Boolean(),
	blockedBy: t.Nullable(t.String()),
	createdAt: t.Nullable(t.String()),
	updatedAt: t.Nullable(t.String()),
});

const ErrorResponse = t.Object({
	error: t.String(),
});

export const getBlockedSignupDomain = new Elysia().get(
	"/admin/blocked-signup-domains/:id",
	async ({ request, params, set }) => {
		const adminUserId = await validateAdminAndRateLimit(request, set);
		if (!adminUserId) {
			set.status = 403;
			return { error: "Admin access required" };
		}

		const blockedDomainResult = await db
			.select()
			.from(blockedSignupDomains)
			.where(eq(blockedSignupDomains.id, params.id))
			.limit(1);

		const blockedDomain = blockedDomainResult[0];
		if (!blockedDomain) {
			set.status = 404;
			return { error: "Blocked signup domain not found" };
		}

		return formatBlockedSignupDomain(blockedDomain);
	},
	{
		params: t.Object({
			id: t.String(),
		}),
		response: {
			200: BlockedSignupDomainSchema,
			401: ErrorResponse,
			403: ErrorResponse,
			404: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			hide: true,
			tags: ["Admin"],
			summary: "Get blocked signup domain",
			description: "Get a blocked signup domain entry by id.",
		},
	},
);
