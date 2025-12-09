import { Elysia, t } from "elysia";
import { validateAndRateLimit } from "../lib/auth";
import { db } from "@/lib/db";
import {
  endpoints,
  emailGroups,
  endpointDeliveries,
  emailAddresses,
  emailDomains,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// Request/Response Types (OpenAPI-compatible)
const EndpointParamsSchema = t.Object({
  id: t.String(),
});

const CleanupSchema = t.Object({
  emailAddressesUpdated: t.Number(),
  emailAddresses: t.Array(t.String()),
  domainsUpdated: t.Number(),
  domains: t.Array(t.String()),
  groupEmailsDeleted: t.Number(),
  deliveriesDeleted: t.Number(),
});

const DeleteEndpointResponse = t.Object({
  message: t.String(),
  cleanup: CleanupSchema,
});

const ErrorResponse = t.Object({
  error: t.String(),
  message: t.String(),
  statusCode: t.Number(),
});

const NotFoundResponse = t.Object({
  error: t.String(),
});

export const deleteEndpoint = new Elysia().delete(
  "/endpoints/:id",
  async ({ request, params, set }) => {
    const { id } = params;
    console.log(
      "🗑️ DELETE /api/e2/endpoints/:id - Starting deletion for endpoint:",
      id
    );

    // Auth & rate limit validation - throws on error
    const userId = await validateAndRateLimit(request, set);
    console.log("✅ Authentication successful for userId:", userId);

    // Check if endpoint exists and belongs to user
    console.log("🔍 Checking if endpoint exists and belongs to user");
    const existingEndpoint = await db
      .select()
      .from(endpoints)
      .where(and(eq(endpoints.id, id), eq(endpoints.userId, userId)))
      .limit(1);

    if (!existingEndpoint[0]) {
      console.log("❌ Endpoint not found for user:", userId, "endpoint:", id);
      set.status = 404;
      return { error: "Endpoint not found" };
    }

    console.log(
      "✅ Found endpoint to delete:",
      existingEndpoint[0].name,
      "type:",
      existingEndpoint[0].type
    );

    // Update email addresses to "store only" (clear endpointId) before deleting the endpoint
    console.log("📮 Updating email addresses to store-only mode");
    const updatedEmailAddresses = await db
      .update(emailAddresses)
      .set({
        endpointId: null,
        updatedAt: new Date(),
      })
      .where(eq(emailAddresses.endpointId, id))
      .returning({ address: emailAddresses.address });

    console.log(
      "📮 Updated",
      updatedEmailAddresses.length,
      "email addresses to store-only"
    );

    // Update domain catch-all configurations to remove this endpoint
    console.log("🌐 Removing endpoint from catch-all domain configurations");
    const updatedDomains = await db
      .update(emailDomains)
      .set({
        catchAllEndpointId: null,
        updatedAt: new Date(),
      })
      .where(eq(emailDomains.catchAllEndpointId, id))
      .returning({ domain: emailDomains.domain });

    console.log(
      "🌐 Updated",
      updatedDomains.length,
      "domains to remove catch-all endpoint"
    );

    // Delete email group entries if it's an email group
    let deletedGroupEmails = 0;
    if (existingEndpoint[0].type === "email_group") {
      console.log("📧 Deleting email group entries");
      const deletedGroups = await db
        .delete(emailGroups)
        .where(eq(emailGroups.endpointId, id))
        .returning();
      deletedGroupEmails = deletedGroups.length;
      console.log("📧 Deleted", deletedGroupEmails, "group email entries");
    }

    // Delete endpoint delivery history
    console.log("📊 Deleting endpoint delivery history");
    const deletedDeliveries = await db
      .delete(endpointDeliveries)
      .where(eq(endpointDeliveries.endpointId, id))
      .returning();

    console.log("📊 Deleted", deletedDeliveries.length, "delivery records");

    // Delete the endpoint
    console.log("🗑️ Deleting the endpoint");
    await db.delete(endpoints).where(eq(endpoints.id, id));

    console.log(
      "✅ DELETE /api/e2/endpoints/:id - Successfully deleted endpoint and cleaned up"
    );

    return {
      message: "Endpoint deleted successfully",
      cleanup: {
        emailAddressesUpdated: updatedEmailAddresses.length,
        emailAddresses: updatedEmailAddresses.map((e) => e.address),
        domainsUpdated: updatedDomains.length,
        domains: updatedDomains.map((d) => d.domain),
        groupEmailsDeleted: deletedGroupEmails,
        deliveriesDeleted: deletedDeliveries.length,
      },
    };
  },
  {
    params: EndpointParamsSchema,
    response: {
      200: DeleteEndpointResponse,
      401: ErrorResponse,
      404: NotFoundResponse,
      500: ErrorResponse,
    },
    detail: {
      tags: ["Endpoints"],
      summary: "Delete endpoint",
      description:
        "Delete an endpoint and clean up associated resources (email addresses become store-only, domains lose catch-all config, group entries and delivery history are deleted)",
    },
  }
);
