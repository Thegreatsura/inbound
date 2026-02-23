import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "@/lib/db";
import { blockedSignupDomains } from "@/lib/db/schema";
import { validateAdminAndRateLimit } from "../lib/auth";

const DeleteBlockedSignupDomainResponse = t.Object({
	success: t.Boolean(),
	message: t.String(),
	deleted: t.Object({
		id: t.String(),
		domain: t.String(),
	}),
});

const ErrorResponse = t.Object({
	error: t.String(),
});

export const deleteBlockedSignupDomain = new Elysia().delete(
	"/admin/blocked-signup-domains/:id",
	async ({ request, params, set }) => {
		const adminUserId = await validateAdminAndRateLimit(request, set);
		if (!adminUserId) {
			set.status = 403;
			return { error: "Admin access required" };
		}

		const deletedRows = await db
			.delete(blockedSignupDomains)
			.where(eq(blockedSignupDomains.id, params.id))
			.returning({
				id: blockedSignupDomains.id,
				domain: blockedSignupDomains.domain,
			});

		const deletedEntry = deletedRows[0];
		if (!deletedEntry) {
			set.status = 404;
			return { error: "Blocked signup domain not found" };
		}

		return {
			success: true,
			message: `Blocked signup domain ${deletedEntry.domain} deleted`,
			deleted: {
				id: deletedEntry.id,
				domain: deletedEntry.domain,
			},
		};
	},
	{
		params: t.Object({
			id: t.String(),
		}),
		response: {
			200: DeleteBlockedSignupDomainResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			404: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			hide: true,
			tags: ["Admin"],
			summary: "Delete blocked signup domain",
			description: "Delete a blocked signup domain entry.",
		},
	},
);
