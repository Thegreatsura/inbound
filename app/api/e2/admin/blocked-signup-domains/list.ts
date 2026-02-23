import { and, asc, count, desc, eq, ilike } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "@/lib/db";
import { blockedSignupDomains } from "@/lib/db/schema";
import { validateAdminAndRateLimit } from "../lib/auth";
import { formatBlockedSignupDomain } from "./shared";

const ListBlockedSignupDomainsQuery = t.Object({
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
	search: t.Optional(t.String({ maxLength: 100 })),
	active: t.Optional(t.String({ enum: ["true", "false"] })),
	sortBy: t.Optional(
		t.String({
			enum: ["newest", "oldest", "domain_asc", "domain_desc"],
		}),
	),
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

const PaginationSchema = t.Object({
	limit: t.Number(),
	offset: t.Number(),
	total: t.Number(),
	hasMore: t.Boolean(),
});

const ListBlockedSignupDomainsResponse = t.Object({
	data: t.Array(BlockedSignupDomainSchema),
	pagination: PaginationSchema,
});

const ErrorResponse = t.Object({
	error: t.String(),
});

export const listBlockedSignupDomains = new Elysia().get(
	"/admin/blocked-signup-domains",
	async ({ request, query, set }) => {
		const adminUserId = await validateAdminAndRateLimit(request, set);
		if (!adminUserId) {
			set.status = 403;
			return { error: "Admin access required" };
		}

		const limit = Math.min(query.limit || 50, 100);
		const offset = query.offset || 0;
		const search = query.search?.trim();
		const active = query.active;

		const activeCondition =
			active !== undefined
				? eq(blockedSignupDomains.isActive, active === "true")
				: undefined;
		const searchCondition = search
			? ilike(blockedSignupDomains.domain, `%${search}%`)
			: undefined;

		const whereCondition =
			activeCondition && searchCondition
				? and(activeCondition, searchCondition)
				: activeCondition || searchCondition;

		const sortOrder =
			query.sortBy === "oldest"
				? asc(blockedSignupDomains.createdAt)
				: query.sortBy === "domain_asc"
					? asc(blockedSignupDomains.domain)
					: query.sortBy === "domain_desc"
						? desc(blockedSignupDomains.domain)
						: desc(blockedSignupDomains.createdAt);

		const blockedDomainRows = await db
			.select()
			.from(blockedSignupDomains)
			.where(whereCondition)
			.orderBy(sortOrder)
			.limit(limit)
			.offset(offset);

		const totalResult = await db
			.select({ count: count() })
			.from(blockedSignupDomains)
			.where(whereCondition);

		const total = totalResult[0]?.count || 0;

		return {
			data: blockedDomainRows.map(formatBlockedSignupDomain),
			pagination: {
				limit,
				offset,
				total,
				hasMore: offset + limit < total,
			},
		};
	},
	{
		query: ListBlockedSignupDomainsQuery,
		response: {
			200: ListBlockedSignupDomainsResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			hide: true,
			tags: ["Admin"],
			summary: "List blocked signup domains",
			description:
				"List blocked signup domains with optional pagination and filtering.",
		},
	},
);
