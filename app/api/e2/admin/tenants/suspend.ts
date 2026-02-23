import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { suspendTenantSending } from "@/lib/aws-ses/aws-ses-tenants";
import { db } from "@/lib/db";
import { sesTenants } from "@/lib/db/schema";
import { validateAdminAndRateLimit } from "../lib/auth";

const SuspendTenantBody = t.Optional(
	t.Object({
		reason: t.Optional(t.String({ maxLength: 1000 })),
	}),
);

const SuspendTenantResponse = t.Object({
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

export const suspendTenant = new Elysia().post(
	"/admin/tenants/:tenantId/suspend",
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

		if (tenant.status === "suspended") {
			return {
				success: true,
				message: `Tenant ${tenant.tenantName} is already suspended`,
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
			const suspendResult = await suspendTenantSending(
				tenant.configurationSetName,
				body?.reason || `Suspended by admin user ${adminUserId}`,
			);

			if (!suspendResult.success) {
				set.status = 500;
				return { error: suspendResult.error || "Failed to suspend tenant" };
			}
		} else {
			await db
				.update(sesTenants)
				.set({
					status: "suspended",
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
			status: "suspended",
		};

		return {
			success: true,
			message: `Tenant ${updatedTenant.tenantName} suspended successfully`,
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
		body: SuspendTenantBody,
		response: {
			200: SuspendTenantResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			404: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			hide: true,
			tags: ["Admin"],
			summary: "Suspend tenant sending",
			description:
				"Suspend sending for a tenant by disabling the AWS SES configuration set and marking the tenant as suspended.",
		},
	},
);
