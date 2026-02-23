import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { validateAndRateLimit } from "../../lib/auth";

type ElysiaSet = {
	status?: number | string;
	headers?: Record<string, string> | unknown;
};

export async function validateAdminAndRateLimit(
	request: Request,
	set: ElysiaSet,
): Promise<string | null> {
	const userId = await validateAndRateLimit(request, set);

	const userResult = await db
		.select({ role: user.role })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!userResult[0] || userResult[0].role !== "admin") {
		set.status = 403;
		return null;
	}

	return userId;
}
