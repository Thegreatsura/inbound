import { Client as QStashClient } from "@upstash/qstash";
import { and, eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { db } from "@/lib/db";
import {
	SCHEDULED_EMAIL_STATUS,
	scheduledEmails,
	sentEmails,
	structuredEmails,
} from "@/lib/db/schema";
import { validateAndRateLimit } from "../lib/auth";

// Response schemas
const CancelEmailSuccessResponse = t.Object({
	success: t.Boolean(),
	message: t.String(),
	id: t.String(),
});

const CancelEmailErrorResponse = t.Object({
	error: t.String(),
});

export const cancelEmail = new Elysia().delete(
	"/emails/:id",
	async ({ request, params, set }) => {
		console.log(
			"🗑️ DELETE /api/e2/emails/:id - Starting request for:",
			params.id,
		);

		// Auth & rate limit validation
		const userId = await validateAndRateLimit(request, set);
		console.log("✅ Authentication successful for userId:", userId);

		const emailId = params.id;
		console.log("🗑️ Cancelling scheduled email:", emailId);

		// Fetch the scheduled email
		const [scheduledEmail] = await db
			.select()
			.from(scheduledEmails)
			.where(
				and(
					eq(scheduledEmails.id, emailId),
					eq(scheduledEmails.userId, userId),
				),
			)
			.limit(1);

		if (!scheduledEmail) {
			// Check if it's a received or sent email to provide a better error message
			const [receivedEmail] = await db
				.select({ id: structuredEmails.id })
				.from(structuredEmails)
				.where(
					and(
						eq(structuredEmails.id, emailId),
						eq(structuredEmails.userId, userId),
					),
				)
				.limit(1);

			if (receivedEmail) {
				set.status = 400;
				return {
					error:
						"Cannot delete a received email. Use PATCH /emails/:id to update email metadata (is_read, is_archived).",
				};
			}

			const [sent] = await db
				.select({ id: sentEmails.id })
				.from(sentEmails)
				.where(and(eq(sentEmails.id, emailId), eq(sentEmails.userId, userId)))
				.limit(1);

			if (sent) {
				set.status = 400;
				return {
					error: "Cannot delete a sent email.",
				};
			}

			set.status = 404;
			return { error: "Email not found" };
		}

		// Check if already sent
		if (scheduledEmail.status === SCHEDULED_EMAIL_STATUS.SENT) {
			console.log("⚠️ Email already sent, cannot cancel:", emailId);
			set.status = 400;
			return { error: "Cannot cancel an email that has already been sent" };
		}

		// Check if already cancelled
		if (scheduledEmail.status === SCHEDULED_EMAIL_STATUS.CANCELLED) {
			console.log("✅ Email already cancelled:", emailId);
			return {
				success: true,
				message: "Email already cancelled",
				id: emailId,
			};
		}

		// Cancel in QStash if we have a schedule ID
		if (scheduledEmail.qstashScheduleId) {
			try {
				const qstashClient = new QStashClient({
					token: process.env.QSTASH_TOKEN!,
				});

				console.log(
					"🗑️ Deleting from QStash, messageId:",
					scheduledEmail.qstashScheduleId,
				);

				// QStash uses messages.delete for scheduled messages
				await qstashClient.messages.delete(scheduledEmail.qstashScheduleId);

				console.log("✅ Deleted from QStash successfully");
			} catch (qstashError) {
				console.error(
					"⚠️ Failed to delete from QStash (continuing anyway):",
					qstashError,
				);
				// Continue with database cancellation even if QStash deletion fails
				// The webhook will handle the case where the email is already cancelled
			}
		}

		// Update database record to cancelled
		await db
			.update(scheduledEmails)
			.set({
				status: SCHEDULED_EMAIL_STATUS.CANCELLED,
				updatedAt: new Date(),
			})
			.where(eq(scheduledEmails.id, emailId));

		console.log("✅ Scheduled email cancelled successfully:", emailId);

		return {
			success: true,
			message: "Scheduled email cancelled successfully",
			id: emailId,
		};
	},
	{
		params: t.Object({
			id: t.String(),
		}),
		response: {
			200: CancelEmailSuccessResponse,
			400: CancelEmailErrorResponse,
			401: CancelEmailErrorResponse,
			404: CancelEmailErrorResponse,
			500: CancelEmailErrorResponse,
		},
		detail: {
			tags: ["Emails"],
			summary: "Cancel scheduled email",
			description:
				"Cancel a scheduled email by ID. Only works for emails that haven't been sent yet.",
		},
	},
);
