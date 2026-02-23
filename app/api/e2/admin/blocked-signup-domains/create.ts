import { Elysia, t } from "elysia";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { blockedSignupDomains } from "@/lib/db/schema";
import { validateAdminAndRateLimit } from "../lib/auth";
import {
	formatBlockedSignupDomain,
	isUniqueConstraintViolation,
	isValidDomain,
	normalizeDomain,
	normalizeReason,
} from "./shared";

const CreateBlockedSignupDomainBody = t.Object({
	domain: t.String({ minLength: 1, maxLength: 253 }),
	reason: t.Optional(t.String({ maxLength: 1000 })),
	isActive: t.Optional(t.Boolean()),
});

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

export const createBlockedSignupDomain = new Elysia().post(
	"/admin/blocked-signup-domains",
	async ({ request, body, set }) => {
		const adminUserId = await validateAdminAndRateLimit(request, set);
		if (!adminUserId) {
			set.status = 403;
			return { error: "Admin access required" };
		}

		const normalizedDomain = normalizeDomain(body.domain);
		if (!isValidDomain(normalizedDomain)) {
			set.status = 400;
			return { error: "Invalid domain format" };
		}

		try {
			const [createdBlockedDomain] = await db
				.insert(blockedSignupDomains)
				.values({
					id: `bsd_${nanoid()}`,
					domain: normalizedDomain,
					reason: normalizeReason(body.reason),
					isActive: body.isActive ?? true,
					blockedBy: adminUserId,
					createdAt: new Date(),
					updatedAt: new Date(),
				})
				.returning();

			set.status = 201;
			return formatBlockedSignupDomain(createdBlockedDomain);
		} catch (error) {
			if (isUniqueConstraintViolation(error)) {
				set.status = 409;
				return { error: "Domain already exists in blocked signup list" };
			}

			set.status = 500;
			return { error: "Failed to create blocked signup domain" };
		}
	},
	{
		body: CreateBlockedSignupDomainBody,
		response: {
			201: BlockedSignupDomainSchema,
			400: ErrorResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			409: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			hide: true,
			tags: ["Admin"],
			summary: "Create blocked signup domain",
			description: "Create a blocked signup domain entry.",
		},
	},
);
