import { Inbound } from "@inboundemail/sdk";
import { Elysia, t } from "elysia";
import { nanoid } from "nanoid";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { onboardingDemoEmails } from "@/lib/db/schema";

// Request schema
const SendDemoEmailBody = t.Object({
	apiKey: t.String({ description: "User's API key for sending" }),
	to: t.String({ description: "Recipient email address" }),
});

// Response schemas
const SendDemoSuccessResponse = t.Object({
	id: t.String(),
	messageId: t.Optional(t.String()),
});

const SendDemoErrorResponse = t.Object({
	error: t.String(),
});

export const sendOnboardingDemo = new Elysia().post(
	"/onboarding/demo",
	async ({ request, body, set }) => {
		console.log("📧 POST /api/e2/onboarding/demo - Starting request");

		// Get session - onboarding requires session auth (not API key)
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user?.id) {
			console.log("❌ No session found");
			set.status = 401;
			return { error: "Authentication required" };
		}

		const userId = session.user.id;
		console.log("✅ Session authenticated for userId:", userId);

		const { apiKey, to } = body;

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(to)) {
			console.log("❌ Invalid email format:", to);
			set.status = 400;
			return { error: "Invalid email address format" };
		}

		try {
			// Use the Inbound SDK to send the demo email
			const inbound = new Inbound(apiKey);

			console.log("📤 Sending demo email to:", to);

			const result = await inbound.emails.send({
				from: `demo@inbound.new`,
				to: to,
				subject: "Welcome to Inbound! Reply to complete setup",
				html: `
          <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 16px;">Welcome to Inbound!</h1>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
              This is a test email from your Inbound setup. Reply to this email to complete your onboarding.
            </p>
            <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
              Once you reply, we'll detect it automatically and you'll be ready to start receiving emails!
            </p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
            <p style="color: #888; font-size: 14px;">
              This email was sent from <a href="https://inbound.new" style="color: #0066cc;">Inbound</a>
            </p>
          </div>
        `,
				text: `Welcome to Inbound!\n\nThis is a test email from your Inbound setup. Reply to this email to complete your onboarding.\n\nOnce you reply, we'll detect it automatically and you'll be ready to start receiving emails!`,
			});

			if (result.error) {
				console.error("❌ SDK error sending demo email:", result.error);
				set.status = 500;
				return {
					error:
						typeof result.error === "string"
							? result.error
							: "Failed to send demo email",
				};
			}

			const emailId = result.data?.id || nanoid();
			console.log("✅ Demo email sent, ID:", emailId);

			// Store the demo email record for reply tracking
			const demoEmailId = nanoid();
			await db.insert(onboardingDemoEmails).values({
				id: demoEmailId,
				userId,
				emailId: emailId,
				messageId: emailId, // Use the email ID as message reference
				recipientEmail: to,
				sentAt: new Date(),
				replyReceived: false,
			});

			console.log("✅ Demo email record created:", demoEmailId);

			set.status = 201;
			return {
				id: emailId,
				messageId: emailId,
			};
		} catch (error) {
			console.error("❌ Failed to send demo email:", error);
			set.status = 500;
			return {
				error:
					error instanceof Error ? error.message : "Failed to send demo email",
			};
		}
	},
	{
		body: SendDemoEmailBody,
		response: {
			201: SendDemoSuccessResponse,
			400: SendDemoErrorResponse,
			401: SendDemoErrorResponse,
			500: SendDemoErrorResponse,
		},
		detail: {
			tags: ["Onboarding"],
			summary: "Send onboarding demo email",
			description:
				"Send a demo email during onboarding to verify email setup. User must reply to complete onboarding.",
		},
	},
);
