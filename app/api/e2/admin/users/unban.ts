import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { validateAdminAndRateLimit } from "../lib/auth";

const UnbanUserBody = t.Optional(
	t.Object({
		reason: t.Optional(t.String({ maxLength: 1000 })),
	}),
);

const UnbanUserResponse = t.Object({
	success: t.Boolean(),
	message: t.String(),
	user: t.Object({
		id: t.String(),
		email: t.Nullable(t.String()),
		name: t.Nullable(t.String()),
		banned: t.Nullable(t.Boolean()),
		banReason: t.Nullable(t.String()),
		banExpires: t.Nullable(t.String()),
		updatedAt: t.Nullable(t.String()),
	}),
});

const ErrorResponse = t.Object({
	error: t.String(),
});

export const unbanUser = new Elysia().post(
	"/admin/users/:userId/unban",
	async ({ request, params, set }) => {
		const adminUserId = await validateAdminAndRateLimit(request, set);
		if (!adminUserId) {
			set.status = 403;
			return { error: "Admin access required" };
		}

		const existingResult = await db
			.select()
			.from(user)
			.where(eq(user.id, params.userId))
			.limit(1);

		const existingUser = existingResult[0];
		if (!existingUser) {
			set.status = 404;
			return { error: "User not found" };
		}

		await db
			.update(user)
			.set({
				banned: false,
				banReason: null,
				banExpires: null,
				updatedAt: new Date(),
			})
			.where(eq(user.id, params.userId));

		const updatedResult = await db
			.select()
			.from(user)
			.where(eq(user.id, params.userId))
			.limit(1);

		const updatedUser = updatedResult[0] || {
			...existingUser,
			banned: false,
			banReason: null,
			banExpires: null,
			updatedAt: new Date(),
		};

		return {
			success: true,
			message: `User ${updatedUser.id} unbanned successfully`,
			user: {
				id: updatedUser.id,
				email: updatedUser.email,
				name: updatedUser.name,
				banned: updatedUser.banned,
				banReason: updatedUser.banReason,
				banExpires: updatedUser.banExpires
					? updatedUser.banExpires.toISOString()
					: null,
				updatedAt: updatedUser.updatedAt
					? updatedUser.updatedAt.toISOString()
					: null,
			},
		};
	},
	{
		params: t.Object({
			userId: t.String(),
		}),
		body: UnbanUserBody,
		response: {
			200: UnbanUserResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			404: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			hide: true,
			tags: ["Admin"],
			summary: "Unban user",
			description: "Unban a user account and restore access to sending.",
		},
	},
);
