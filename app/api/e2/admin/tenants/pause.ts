import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { pauseTenantSending } from "@/lib/aws-ses/aws-ses-tenants";
import { db } from "@/lib/db";
import { sesTenants } from "@/lib/db/schema";
import { validateAdminAndRateLimit } from "../lib/auth";

const PauseTenantBody = t.Optional(
	t.Object({
		reason: t.Optional(t.String({ maxLength: 1000 })),
	}),
);

const PauseTenantResponse = t.Object({
	success: t.Boolean(),
	message: t.String(),
	tenant: t.Object({
		id: t.String(),
		userId: t.String(),
		tenantName: t.String(),
		configurationSetName: t.Nullable(t.String()),
		status: t.String(),
	}),
});

const ErrorResponse = t.Object({
	error: t.String(),
});

export const pauseTenant = new Elysia().post(
	"/admin/tenants/:tenantId/pause",
	async ({ request, params, body, set }) => {
		const adminUserId = await validateAdminAndRateLimit(request, set);
		if (!adminUserId) {
			set.status = 403;
			return { error: "Admin access required" };
		}

		const tenantResult = await db
			.select()
			.from(sesTenants)
			.where(eq(sesTenants.id, params.tenantId))
			.limit(1);

		const tenant = tenantResult[0];
		if (!tenant) {
			set.status = 404;
			return { error: "Tenant not found" };
		}

		if (tenant.status === "paused") {
			return {
				success: true,
				message: `Tenant ${tenant.tenantName} is already paused`,
				tenant: {
					id: tenant.id,
					userId: tenant.userId,
					tenantName: tenant.tenantName,
					configurationSetName: tenant.configurationSetName,
					status: tenant.status,
				},
			};
		}

		if (tenant.configurationSetName) {
			const pauseResult = await pauseTenantSending(
				tenant.configurationSetName,
				body?.reason || `Paused by admin user ${adminUserId}`,
			);

			if (!pauseResult.success) {
				set.status = 500;
				return { error: pauseResult.error || "Failed to pause tenant" };
			}
		} else {
			await db
				.update(sesTenants)
				.set({
					status: "paused",
					updatedAt: new Date(),
				})
				.where(eq(sesTenants.id, tenant.id));
		}

		const updatedTenantResult = await db
			.select()
			.from(sesTenants)
			.where(eq(sesTenants.id, tenant.id))
			.limit(1);

		const updatedTenant = updatedTenantResult[0] || {
			...tenant,
			status: "paused",
		};

		return {
			success: true,
			message: `Tenant ${updatedTenant.tenantName} paused successfully`,
			tenant: {
				id: updatedTenant.id,
				userId: updatedTenant.userId,
				tenantName: updatedTenant.tenantName,
				configurationSetName: updatedTenant.configurationSetName,
				status: updatedTenant.status,
			},
		};
	},
	{
		params: t.Object({
			tenantId: t.String(),
		}),
		body: PauseTenantBody,
		response: {
			200: PauseTenantResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			404: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			hide: true,
			tags: ["Admin"],
			summary: "Pause tenant sending",
			description:
				"Pause sending for a tenant by disabling the AWS SES configuration set and marking the tenant as paused.",
		},
	},
);
