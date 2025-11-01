import { betterAuth } from "better-auth";
import { db } from "../db/index";
import { Dub } from "dub";
import { dubAnalytics } from "@dub/better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { stripe } from "@better-auth/stripe";
import { admin, apiKey, oAuthProxy } from "better-auth/plugins";
import { magicLink } from "better-auth/plugins";
import { createAuthMiddleware } from "better-auth/api";
import { eq, and } from "drizzle-orm";
import Stripe from "stripe";
import * as schema from "../db/schema";
import { nanoid } from "nanoid";
import { Resend } from "resend";
import { Inbound } from "@inboundemail/sdk";
import path from "path";
import fs from "fs";
import { render } from "@react-email/components";
import MagicLinkEmail from "@/emails/magic-link-email";

const dub = new Dub();

const RESEND_AUTUMN_AUDIENCE_ID = "515e5071-4d0e-4117-9c12-e8ddd29b807e"

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const resend = new Resend(process.env.RESEND_API_KEY);
const inbound = new Inbound(process.env.INBOUND_API_KEY!);

export const auth = betterAuth({
    baseURL: process.env.NODE_ENV === 'development'
        ? "https://dev.inbound.new"
        : process.env.VERCEL_ENV === 'preview'
            ? `https://${process.env.VERCEL_BRANCH_URL}`
            : "https://inbound.new",
    trustedOrigins: process.env.NODE_ENV === 'development' 
        ? ["https://dev.inbound.new"] 
        : [
            process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
            process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : undefined,
            "https://inbound.new"
        ].filter(Boolean) as string[],
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: schema
    }),
    socialProviders: {
        github: {
            clientId: process.env.GITHUB_CLIENT_ID as string,
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
            // Always use production URL for OAuth proxy to work properly
            redirectURI: "https://inbound.new/api/auth/callback/github"
        },
        google: { 
            prompt: "select_account", 
            clientId: process.env.GOOGLE_CLIENT_ID as string, 
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
            // Always use production URL for OAuth proxy to work properly
            redirectURI: "https://inbound.new/api/auth/callback/google"
        },
    },
    session: {
        updateAge: 24 * 60 * 60, // 24 hours
        expiresIn: 60 * 60 * 24 * 7, // 7 days
    },
    user: {
        additionalFields: {
            featureFlags: {
                type: "string",
                required: false,
                defaultValue: null
            }
        }
    },
    plugins: [
        dubAnalytics({
            dubClient: dub,
          }),
        oAuthProxy({
            productionURL: process.env.BETTER_AUTH_URL || "https://inbound.new",
            currentURL: process.env.NODE_ENV === 'development' 
                ? "http://localhost:3000" 
                : process.env.VERCEL_URL 
                    ? `https://${process.env.VERCEL_URL}` 
                    : process.env.VERCEL_BRANCH_URL 
                        ? `https://${process.env.VERCEL_BRANCH_URL}` 
                        : undefined
        }),
        apiKey(
            {
                rateLimit: {
                    enabled: false
                }
            }
        ),
        admin(),
        magicLink({
            expiresIn: 300, // 5 minutes
            disableSignUp: false, // Allow new user creation via magic link
            sendMagicLink: async ({ email, url, token }, request) => {
                console.log(`📧 Sending magic link to ${email}`);
                
                if (process.env.NODE_ENV === 'development') {
                    // In development, log the magic link to console for easy access
                    console.log(`🔗 Magic Link URL: ${url}`);
                    console.log(`🎫 Token: ${token}`);
                }

                try {
                    const { data, error } = await inbound.emails.send({
                        from: 'inbound <signin@inbound.new>',
                        to: email,
                        subject: 'Sign in to inbound',
                        html: await render(MagicLinkEmail(url)),
                        text: `Sign in to inbound\n\nClick this link to sign in: ${url}\n\nThis link will expire in 5 minutes.`,
                        replyTo: 'support@inbound.new'
                    });

                    if (error) {
                        console.error('❌ Failed to send magic link email:', error);
                        throw new Error(`Failed to send email: ${error}`);
                    }

                    console.log('✅ Magic link email sent successfully:', data?.id);
                } catch (error) {
                    console.error('❌ Error sending magic link:', error);
                    throw error;
                }
            }
        }),        
        stripe({
            stripeClient,
            stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
            createCustomerOnSignUp: true
        })
    ],
    hooks: {
        after: createAuthMiddleware(async (ctx) => {
            // Check if this is actually a new user creation (not just a login)
            if (ctx.context.newSession?.user) {
                const user = ctx.context.newSession.user;
                
                // Check if user was created very recently (within last 10 seconds)
                // This indicates actual signup vs existing user login
                const userCreatedAt = new Date(user.createdAt);
                const now = new Date();
                const timeDiffSeconds = (now.getTime() - userCreatedAt.getTime()) / 1000;
                
                if (timeDiffSeconds < 10) {
                    console.log('New user signed up with email: ', user.email);
                    await resend.contacts.create({
                        audienceId: RESEND_AUTUMN_AUDIENCE_ID,
                        email: user.email,
                        firstName: user.name,
                        lastName: user.name,
                    })
                    // need to redirect to onboarding page
                    throw ctx.redirect("/onboarding-demo");
                } else {
                    console.log('Existing user logged in with email: ', user.email);
                    // need to redirect to dashboard
                    throw ctx.redirect("/logs");
                }
            }
        })
    }
})