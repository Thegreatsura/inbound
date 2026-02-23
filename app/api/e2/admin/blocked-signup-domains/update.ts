import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
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

const UpdateBlockedSignupDomainBody = t.Object({
	domain: t.Optional(t.String({ minLength: 1, maxLength: 253 })),
	reason: t.Optional(
		t.Union([t.String({ maxLength: 1000 }), t.Null()], {
			description: "Set to null to clear the reason",
		}),
	),
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

export const updateBlockedSignupDomain = new Elysia().patch(
	"/admin/blocked-signup-domains/:id",
	async ({ request, params, body, set }) => {
		const adminUserId = await validateAdminAndRateLimit(request, set);
		if (!adminUserId) {
			set.status = 403;
			return { error: "Admin access required" };
		}

		if (
			body.domain === undefined &&
			body.reason === undefined &&
			body.isActive === undefined
		) {
			set.status = 400;
			return { error: "At least one field must be provided" };
		}

		const existingResult = await db
			.select()
			.from(blockedSignupDomains)
			.where(eq(blockedSignupDomains.id, params.id))
			.limit(1);

		const existingBlockedDomain = existingResult[0];
		if (!existingBlockedDomain) {
			set.status = 404;
			return { error: "Blocked signup domain not found" };
		}

		const updatedValues: {
			domain?: string;
			reason?: string | null;
			isActive?: boolean;
			blockedBy?: string | null;
			updatedAt: Date;
		} = {
			updatedAt: new Date(),
		};

		if (body.domain !== undefined) {
			const normalizedDomain = normalizeDomain(body.domain);
			if (!isValidDomain(normalizedDomain)) {
				set.status = 400;
				return { error: "Invalid domain format" };
			}

			updatedValues.domain = normalizedDomain;
		}

		if (body.reason !== undefined) {
			updatedValues.reason = normalizeReason(body.reason);
		}

		if (body.isActive !== undefined) {
			updatedValues.isActive = body.isActive;
		}

		if (updatedValues.isActive === true) {
			updatedValues.blockedBy = adminUserId;
		}

		try {
			const [updatedBlockedDomain] = await db
				.update(blockedSignupDomains)
				.set(updatedValues)
				.where(eq(blockedSignupDomains.id, params.id))
				.returning();

			return formatBlockedSignupDomain(updatedBlockedDomain);
		} catch (error) {
			if (isUniqueConstraintViolation(error)) {
				set.status = 409;
				return { error: "Domain already exists in blocked signup list" };
			}

			set.status = 500;
			return { error: "Failed to update blocked signup domain" };
		}
	},
	{
		params: t.Object({
			id: t.String(),
		}),
		body: UpdateBlockedSignupDomainBody,
		response: {
			200: BlockedSignupDomainSchema,
			400: ErrorResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			404: ErrorResponse,
			409: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			hide: true,
			tags: ["Admin"],
			summary: "Update blocked signup domain",
			description: "Update a blocked signup domain entry.",
		},
	},
);
