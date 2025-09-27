-- Explicitly drop VIP tables (they should not be renamed)
DROP TABLE IF EXISTS "vip_allowed_senders" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "vip_configs" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "vip_email_attempts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "vip_payment_sessions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "dub_integrations" CASCADE;--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD COLUMN "qstash_schedule_id" varchar(255);--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD COLUMN "qstash_dlq_id" varchar(255);--> statement-breakpoint
-- Drop VIP columns from email_addresses table
ALTER TABLE "email_addresses" DROP COLUMN IF EXISTS "is_vip_enabled";--> statement-breakpoint
ALTER TABLE "email_addresses" DROP COLUMN IF EXISTS "vip_config_id";--> statement-breakpoint