DROP TABLE "dub_integrations" CASCADE;--> statement-breakpoint
DROP TABLE "vip_allowed_senders" CASCADE;--> statement-breakpoint
DROP TABLE "vip_configs" CASCADE;--> statement-breakpoint
DROP TABLE "vip_email_attempts" CASCADE;--> statement-breakpoint
DROP TABLE "vip_payment_sessions" CASCADE;--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD COLUMN "qstash_schedule_id" varchar(255);--> statement-breakpoint
ALTER TABLE "scheduled_emails" ADD COLUMN "qstash_dlq_id" varchar(255);--> statement-breakpoint
ALTER TABLE "email_addresses" DROP COLUMN "is_vip_enabled";--> statement-breakpoint
ALTER TABLE "email_addresses" DROP COLUMN "vip_config_id";