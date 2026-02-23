import { and, eq, inArray } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { unlinkIdentityFromTenant } from "@/lib/aws-ses/aws-ses-tenants";
import { db } from "@/lib/db";
import { emailAddresses, emailDomains, sesTenants } from "@/lib/db/schema";
import { deleteIdentityFromSES } from "@/lib/domains-and-dns/domain-verification";
import { validateAdminAndRateLimit } from "../lib/auth";

const DeleteIdentityBody = t.Object({
	identity: t.String({ minLength: 1, maxLength: 320 }),
});

const DeleteIdentityResponse = t.Object({
	success: t.Boolean(),
	identity: t.String(),
	tenant: t.Object({
		id: t.String(),
		tenantName: t.String(),
	}),
	aws: t.Object({
		unlinkedFromTenant: t.Boolean(),
		deletedFromSes: t.Boolean(),
	}),
	database: t.Object({
		domainsUpdated: t.Number(),
		emailAddressesUpdated: t.Number(),
	}),
	warnings: t.Optional(t.Array(t.String())),
});

const ErrorResponse = t.Object({
	error: t.String(),
});

const domainRegex =
	/^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const deleteIdentity = new Elysia().post(
	"/admin/tenants/:tenantId/identities/delete",
	async ({ request, params, body, set }) => {
		const adminUserId = await validateAdminAndRateLimit(request, set);
		if (!adminUserId) {
			set.status = 403;
			return { error: "Admin access required" };
		}

		const normalizedIdentity = body.identity.toLowerCase().trim();
		const isDomainIdentity = domainRegex.test(normalizedIdentity);
		const isEmailIdentity = emailRegex.test(normalizedIdentity);

		if (!isDomainIdentity && !isEmailIdentity) {
			set.status = 400;
			return { error: "Invalid identity format" };
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

		const warnings: string[] = [];

		const unlinkResult = await unlinkIdentityFromTenant(
			tenant.tenantName,
			normalizedIdentity,
		);

		if (!unlinkResult.success) {
			warnings.push(
				`Failed to unlink identity from tenant in AWS SES: ${unlinkResult.error || "unknown error"}`,
			);
		}

		const deleteResult = await deleteIdentityFromSES(normalizedIdentity);

		if (!deleteResult.success) {
			warnings.push(
				`Failed to delete identity from AWS SES: ${deleteResult.error || "unknown error"}`,
			);
		}

		if (!unlinkResult.success && !deleteResult.success) {
			set.status = 500;
			return { error: "Failed to unlink and delete SES identity" };
		}

		let domainsUpdated = 0;
		let emailAddressesUpdated = 0;

		if (isDomainIdentity) {
			const domainUpdates = await db
				.update(emailDomains)
				.set({
					tenantId: null,
					status: "pending",
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(emailDomains.tenantId, tenant.id),
						eq(emailDomains.domain, normalizedIdentity),
					),
				)
				.returning({ id: emailDomains.id });

			domainsUpdated = domainUpdates.length;

			if (domainUpdates.length > 0) {
				const domainIds = domainUpdates.map((domain) => domain.id);
				const addressUpdates = await db
					.update(emailAddresses)
					.set({
						tenantId: null,
						isActive: false,
						updatedAt: new Date(),
					})
					.where(
						and(
							eq(emailAddresses.tenantId, tenant.id),
							inArray(emailAddresses.domainId, domainIds),
						),
					)
					.returning({ id: emailAddresses.id });

				emailAddressesUpdated += addressUpdates.length;
			}
		}

		if (isEmailIdentity) {
			const addressUpdates = await db
				.update(emailAddresses)
				.set({
					tenantId: null,
					isActive: false,
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(emailAddresses.tenantId, tenant.id),
						eq(emailAddresses.address, normalizedIdentity),
					),
				)
				.returning({ id: emailAddresses.id });

			emailAddressesUpdated += addressUpdates.length;
		}

		return {
			success: true,
			identity: normalizedIdentity,
			tenant: {
				id: tenant.id,
				tenantName: tenant.tenantName,
			},
			aws: {
				unlinkedFromTenant: unlinkResult.success,
				deletedFromSes: deleteResult.success,
			},
			database: {
				domainsUpdated,
				emailAddressesUpdated,
			},
			warnings: warnings.length > 0 ? warnings : undefined,
		};
	},
	{
		params: t.Object({
			tenantId: t.String(),
		}),
		body: DeleteIdentityBody,
		response: {
			200: DeleteIdentityResponse,
			400: ErrorResponse,
			401: ErrorResponse,
			403: ErrorResponse,
			404: ErrorResponse,
			500: ErrorResponse,
		},
		detail: {
			hide: true,
			tags: ["Admin"],
			summary: "Delete SES identity for tenant",
			description:
				"Unlink an SES identity from a tenant, delete it from AWS SES, and detach local records from the tenant.",
		},
	},
);
