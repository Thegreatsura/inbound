import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	ilike,
	inArray,
	or,
	sql,
} from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "@/lib/db";
import {
	emailDeliveryEvents,
	emailDomains,
	sentEmails,
	sesTenants,
	user,
} from "@/lib/db/schema";
import { validateAdminAndRateLimit } from "../lib/auth";

type TimeRange = "24h" | "7d" | "30d";

function getRangeStart(range: TimeRange): Date {
	const now = Date.now();

	if (range === "24h") {
		return new Date(now - 24 * 60 * 60 * 1000);
	}

	if (range === "30d") {
		return new Date(now - 30 * 24 * 60 * 60 * 1000);
	}

	return new Date(now - 7 * 24 * 60 * 60 * 1000);
}

function toNumber(value: unknown): number {
	if (typeof value === "number") {
		return value;
	}

	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}

	return 0;
}

function toIso(value: unknown): string | null {
	if (!value) {
		return null;
	}

	if (value instanceof Date) {
		return value.toISOString();
	}

	if (typeof value === "string") {
		const parsed = new Date(value);
		return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
	}

	return null;
}

function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

function buildRiskProfile(args: {
	bounceRate: number;
	complaintRate: number;
	bounces: number;
	complaints: number;
	deliveryFailures: number;
	failedSends: number;
	uniqueFailedRecipients: number;
	topRejectedDomainCount: number;
	userBanned: boolean;
	tenantStatus: string;
}) {
	let score = 0;
	const flags: string[] = [];

	if (args.bounceRate >= 5) {
		flags.push("high_bounce_rate");
		score += 45;
	}

	if (args.bounces >= 50) {
		flags.push("high_bounce_volume");
		score += 20;
	}

	if (args.complaintRate >= 0.1) {
		flags.push("high_complaint_rate");
		score += 30;
	}

	if (args.complaints >= 10) {
		flags.push("high_complaint_volume");
		score += 15;
	}

	if (args.deliveryFailures >= 50) {
		flags.push("high_delivery_failures");
		score += 20;
	}

	if (args.failedSends >= 50) {
		flags.push("high_send_failures");
		score += 15;
	}

	if (args.uniqueFailedRecipients >= 100) {
		flags.push("many_unique_failed_recipients");
		score += 15;
	}

	const rejectionEventTotal = args.bounces + args.deliveryFailures;
	if (
		rejectionEventTotal >= 20 &&
		args.topRejectedDomainCount / rejectionEventTotal >= 0.6
	) {
		flags.push("concentrated_recipient_domain_rejections");
		score += 15;
	}

	if (args.userBanned) {
		flags.push("user_banned");
		score += 25;
	}

	if (args.tenantStatus !== "active") {
		flags.push("tenant_not_active");
		score += 5;
	}

	score = Math.min(100, score);

	return {
		score,
		flags,
		suspicious: score >= 50,
	};
}

const ListTenantsQuery = t.Object({
	limit: t.Optional(t.Integer({ minimum: 1, maximum: 100, default: 50 })),
	offset: t.Optional(t.Integer({ minimum: 0, default: 0 })),
	search: t.Optional(t.String({ maxLength: 200 })),
	timeRange: t.Optional(t.String({ enum: ["24h", "7d", "30d"] })),
	sortBy: t.Optional(
		t.String({
			enum: ["risk", "bounce_rate", "complaint_rate", "sent", "newest"],
		}),
	),
	sortOrder: t.Optional(t.String({ enum: ["asc", "desc"] })),
	flaggedOnly: t.Optional(t.String({ enum: ["true", "false"] })),
});

const TenantDomainSchema = t.Object({
	id: t.String(),
	domain: t.String(),
	status: t.String(),
	canReceiveEmails: t.Nullable(t.Boolean()),
});

const TopRejectedDomainSchema = t.Object({
	domain: t.String(),
	count: t.Number(),
});

const TenantStatsSchema = t.Object({
	timeRange: t.String(),
	sent: t.Number(),
	failedSends: t.Number(),
	bounces: t.Number(),
	complaints: t.Number(),
	deliveryFailures: t.Number(),
	bounceRate: t.Number(),
	complaintRate: t.Number(),
	uniqueFailedRecipients: t.Number(),
	lastSentAt: t.Nullable(t.String()),
	lastDeliveryEventAt: t.Nullable(t.String()),
	topRejectedRecipientDomains: t.Array(TopRejectedDomainSchema),
});

const TenantRiskSchema = t.Object({
	score: t.Number(),
	flags: t.Array(t.String()),
	suspicious: t.Boolean(),
});

const TenantInsightSchema = t.Object({
	id: t.String(),
	awsTenantId: t.String(),
	tenantName: t.String(),
	configurationSetName: t.Nullable(t.String()),
	status: t.String(),
	reputationPolicy: t.String(),
	createdAt: t.Nullable(t.String()),
	updatedAt: t.Nullable(t.String()),
	user: t.Object({
		id: t.String(),
		name: t.Nullable(t.String()),
		email: t.Nullable(t.String()),
		banned: t.Nullable(t.Boolean()),
	}),
	domains: t.Array(TenantDomainSchema),
	stats: TenantStatsSchema,
	risk: TenantRiskSchema,
});

const ListTenantsSummarySchema = t.Object({
	scannedTenants: t.Number(),
	flaggedTenants: t.Number(),
	totalSent: t.Number(),
	totalFailedSends: t.Number(),
	totalBounces: t.Number(),
	totalComplaints: t.Number(),
	totalDeliveryFailures: t.Number(),
	bounceRateOverall: t.Number(),
	complaintRateOverall: t.Number(),
});

const ListTenantsResponse = t.Object({
	data: t.Array(TenantInsightSchema),
	summary: ListTenantsSummarySchema,
	pagination: t.Object({
		limit: t.Number(),
		offset: t.Number(),
		total: t.Number(),
		hasMore: t.Boolean(),
	}),
});

const ErrorResponse = t.Object({
	error: t.String(),
});

export const listTenants = new Elysia().get(
	"/admin/tenants",
	async ({ request, query, set }) => {
		const adminUserId = await validateAdminAndRateLimit(request, set);
		if (!adminUserId) {
			set.status = 403;
			return { error: "Admin access required" };
		}

		const limit = Math.min(query.limit || 50, 100);
		const offset = query.offset || 0;
		const search = query.search?.trim();
		const timeRange = (query.timeRange || "7d") as TimeRange;
		const sortBy = query.sortBy || "risk";
		const sortOrder = query.sortOrder || "desc";
		const flaggedOnly = query.flaggedOnly === "true";
		const rangeStart = getRangeStart(timeRange);

		const searchCondition = search
			? or(
					ilike(sesTenants.tenantName, `%${search}%`),
					ilike(sesTenants.id, `%${search}%`),
					ilike(sesTenants.awsTenantId, `%${search}%`),
					ilike(user.email, `%${search}%`),
					ilike(user.name, `%${search}%`),
				)
			: undefined;

		const tenantRows = await db
			.select({
				id: sesTenants.id,
				userId: sesTenants.userId,
				awsTenantId: sesTenants.awsTenantId,
				tenantName: sesTenants.tenantName,
				configurationSetName: sesTenants.configurationSetName,
				status: sesTenants.status,
				reputationPolicy: sesTenants.reputationPolicy,
				createdAt: sesTenants.createdAt,
				updatedAt: sesTenants.updatedAt,
				userName: user.name,
				userEmail: user.email,
				userBanned: user.banned,
			})
			.from(sesTenants)
			.leftJoin(user, eq(sesTenants.userId, user.id))
			.where(searchCondition)
			.orderBy(desc(sesTenants.createdAt));

		if (tenantRows.length === 0) {
			return {
				data: [],
				summary: {
					scannedTenants: 0,
					flaggedTenants: 0,
					totalSent: 0,
					totalFailedSends: 0,
					totalBounces: 0,
					totalComplaints: 0,
					totalDeliveryFailures: 0,
					bounceRateOverall: 0,
					complaintRateOverall: 0,
				},
				pagination: {
					limit,
					offset,
					total: 0,
					hasMore: false,
				},
			};
		}

		const tenantIds = tenantRows.map((tenant) => tenant.id);
		const userIds = Array.from(
			new Set(tenantRows.map((tenant) => tenant.userId)),
		);

		const domainRows = await db
			.select({
				id: emailDomains.id,
				domain: emailDomains.domain,
				status: emailDomains.status,
				canReceiveEmails: emailDomains.canReceiveEmails,
				tenantId: emailDomains.tenantId,
			})
			.from(emailDomains)
			.where(inArray(emailDomains.tenantId, tenantIds))
			.orderBy(asc(emailDomains.domain));

		const sentAggregateRows = userIds.length
			? await db
					.select({
						userId: sentEmails.userId,
						sentCount: count(),
						failedCount: sql<number>`sum(case when ${sentEmails.status} = 'failed' then 1 else 0 end)`,
						lastSentAt: sql<Date | null>`max(${sentEmails.createdAt})`,
					})
					.from(sentEmails)
					.where(
						and(
							inArray(sentEmails.userId, userIds),
							gte(sentEmails.createdAt, rangeStart),
						),
					)
					.groupBy(sentEmails.userId)
			: [];

		const deliveryAggregateRows = tenantIds.length
			? await db
					.select({
						tenantId: emailDeliveryEvents.tenantId,
						bounces: sql<number>`sum(case when ${emailDeliveryEvents.eventType} = 'bounce' then 1 else 0 end)`,
						complaints: sql<number>`sum(case when ${emailDeliveryEvents.eventType} = 'complaint' then 1 else 0 end)`,
						deliveryFailures: sql<number>`sum(case when ${emailDeliveryEvents.eventType} = 'delivery_failure' then 1 else 0 end)`,
						uniqueFailedRecipients: sql<number>`count(distinct ${emailDeliveryEvents.failedRecipient})`,
						lastDeliveryEventAt: sql<Date | null>`max(${emailDeliveryEvents.createdAt})`,
					})
					.from(emailDeliveryEvents)
					.where(
						and(
							inArray(emailDeliveryEvents.tenantId, tenantIds),
							gte(emailDeliveryEvents.createdAt, rangeStart),
						),
					)
					.groupBy(emailDeliveryEvents.tenantId)
			: [];

		const rejectionCountSql = sql<number>`count(*)`;
		const rejectedDomainRows = tenantIds.length
			? await db
					.select({
						tenantId: emailDeliveryEvents.tenantId,
						failedRecipientDomain: emailDeliveryEvents.failedRecipientDomain,
						eventCount: rejectionCountSql,
					})
					.from(emailDeliveryEvents)
					.where(
						and(
							inArray(emailDeliveryEvents.tenantId, tenantIds),
							gte(emailDeliveryEvents.createdAt, rangeStart),
							sql`${emailDeliveryEvents.failedRecipientDomain} is not null and ${emailDeliveryEvents.failedRecipientDomain} <> ''`,
						),
					)
					.groupBy(
						emailDeliveryEvents.tenantId,
						emailDeliveryEvents.failedRecipientDomain,
					)
					.orderBy(desc(rejectionCountSql))
			: [];

		const domainsByTenant = new Map<
			string,
			Array<{
				id: string;
				domain: string;
				status: string;
				canReceiveEmails: boolean | null;
			}>
		>();

		for (const domain of domainRows) {
			if (!domain.tenantId) {
				continue;
			}

			const current = domainsByTenant.get(domain.tenantId) || [];
			current.push({
				id: domain.id,
				domain: domain.domain,
				status: domain.status,
				canReceiveEmails: domain.canReceiveEmails,
			});
			domainsByTenant.set(domain.tenantId, current);
		}

		const sentByUserId = new Map<
			string,
			{ sentCount: number; failedCount: number; lastSentAt: string | null }
		>();

		for (const row of sentAggregateRows) {
			sentByUserId.set(row.userId, {
				sentCount: toNumber(row.sentCount),
				failedCount: toNumber(row.failedCount),
				lastSentAt: toIso(row.lastSentAt),
			});
		}

		const deliveryByTenantId = new Map<
			string,
			{
				bounces: number;
				complaints: number;
				deliveryFailures: number;
				uniqueFailedRecipients: number;
				lastDeliveryEventAt: string | null;
			}
		>();

		for (const row of deliveryAggregateRows) {
			if (!row.tenantId) {
				continue;
			}

			deliveryByTenantId.set(row.tenantId, {
				bounces: toNumber(row.bounces),
				complaints: toNumber(row.complaints),
				deliveryFailures: toNumber(row.deliveryFailures),
				uniqueFailedRecipients: toNumber(row.uniqueFailedRecipients),
				lastDeliveryEventAt: toIso(row.lastDeliveryEventAt),
			});
		}

		const rejectedDomainsByTenantId = new Map<
			string,
			Array<{ domain: string; count: number }>
		>();

		for (const row of rejectedDomainRows) {
			if (!row.tenantId || !row.failedRecipientDomain) {
				continue;
			}

			const current = rejectedDomainsByTenantId.get(row.tenantId) || [];
			current.push({
				domain: row.failedRecipientDomain,
				count: toNumber(row.eventCount),
			});
			rejectedDomainsByTenantId.set(row.tenantId, current);
		}

		const tenantInsights = tenantRows.map((tenant) => {
			const sentStats = sentByUserId.get(tenant.userId) || {
				sentCount: 0,
				failedCount: 0,
				lastSentAt: null,
			};

			const deliveryStats = deliveryByTenantId.get(tenant.id) || {
				bounces: 0,
				complaints: 0,
				deliveryFailures: 0,
				uniqueFailedRecipients: 0,
				lastDeliveryEventAt: null,
			};

			const topRejectedRecipientDomains = (
				rejectedDomainsByTenantId.get(tenant.id) || []
			)
				.sort((a, b) => b.count - a.count)
				.slice(0, 3);

			const bounceRate =
				sentStats.sentCount > 0
					? round2((deliveryStats.bounces / sentStats.sentCount) * 100)
					: 0;
			const complaintRate =
				sentStats.sentCount > 0
					? round2((deliveryStats.complaints / sentStats.sentCount) * 100)
					: 0;

			const risk = buildRiskProfile({
				bounceRate,
				complaintRate,
				bounces: deliveryStats.bounces,
				complaints: deliveryStats.complaints,
				deliveryFailures: deliveryStats.deliveryFailures,
				failedSends: sentStats.failedCount,
				uniqueFailedRecipients: deliveryStats.uniqueFailedRecipients,
				topRejectedDomainCount: topRejectedRecipientDomains[0]?.count || 0,
				userBanned: tenant.userBanned === true,
				tenantStatus: tenant.status,
			});

			return {
				id: tenant.id,
				awsTenantId: tenant.awsTenantId,
				tenantName: tenant.tenantName,
				configurationSetName: tenant.configurationSetName,
				status: tenant.status,
				reputationPolicy: tenant.reputationPolicy,
				createdAt: toIso(tenant.createdAt),
				updatedAt: toIso(tenant.updatedAt),
				user: {
					id: tenant.userId,
					name: tenant.userName,
					email: tenant.userEmail,
					banned: tenant.userBanned,
				},
				domains: domainsByTenant.get(tenant.id) || [],
				stats: {
					timeRange,
					sent: sentStats.sentCount,
					failedSends: sentStats.failedCount,
					bounces: deliveryStats.bounces,
					complaints: deliveryStats.complaints,
					deliveryFailures: deliveryStats.deliveryFailures,
					bounceRate,
					complaintRate,
					uniqueFailedRecipients: deliveryStats.uniqueFailedRecipients,
					lastSentAt: sentStats.lastSentAt,
					lastDeliveryEventAt: deliveryStats.lastDeliveryEventAt,
					topRejectedRecipientDomains,
				},
				risk,
			};
		});

		tenantInsights.sort((a, b) => {
			let left = 0;
			let right = 0;

			if (sortBy === "bounce_rate") {
				left = a.stats.bounceRate;
				right = b.stats.bounceRate;
			} else if (sortBy === "complaint_rate") {
				left = a.stats.complaintRate;
				right = b.stats.complaintRate;
			} else if (sortBy === "sent") {
				left = a.stats.sent;
				right = b.stats.sent;
			} else if (sortBy === "newest") {
				left = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				right = b.createdAt ? new Date(b.createdAt).getTime() : 0;
			} else {
				left = a.risk.score;
				right = b.risk.score;
			}

			return sortOrder === "asc" ? left - right : right - left;
		});

		const filteredInsights = flaggedOnly
			? tenantInsights.filter((tenant) => tenant.risk.suspicious)
			: tenantInsights;

		const total = filteredInsights.length;
		const paginated = filteredInsights.slice(offset, offset + limit);

		const summary = filteredInsights.reduce(
			(acc, tenant) => {
				acc.totalSent += tenant.stats.sent;
				acc.totalFailedSends += tenant.stats.failedSends;
				acc.totalBounces += tenant.stats.bounces;
				acc.totalComplaints += tenant.stats.complaints;
				acc.totalDeliveryFailures += tenant.stats.deliveryFailures;
				if (tenant.risk.suspicious) {
					acc.flaggedTenants += 1;
				}
				return acc;
			},
			{
				scannedTenants: tenantInsights.length,
				flaggedTenants: 0,
				totalSent: 0,
				totalFailedSends: 0,
				totalBounces: 0,
				totalComplaints: 0,
				totalDeliveryFailures: 0,
				bounceRateOverall: 0,
				complaintRateOverall: 0,
			},
		);

		summary.bounceRateOverall =
			summary.totalSent > 0
				? round2((summary.totalBounces / summary.totalSent) * 100)
				: 0;
		summary.complaintRateOverall =
			summary.totalSent > 0
				? round2((summary.totalComplaints / summary.totalSent) * 100)
				: 0;

		return {
			data: paginated,
			summary,
			pagination: {
				limit,
				offset,
				total,
				hasMore: offset + limit < total,
			},
		};
	},
	{
		query: ListTenantsQuery,
		response: {
			200: ListTenantsResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			hide: true,
			tags: ["Admin"],
			summary: "List tenant risk insights",
			description:
				"List tenants with linked users, domains, sending stats, delivery event metrics, and risk flags for abuse investigation.",
		},
	},
);
