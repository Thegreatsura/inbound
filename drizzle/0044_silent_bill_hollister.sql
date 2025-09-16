CREATE TABLE "dub_oauth_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_type" text DEFAULT 'Bearer',
	"expires_in" integer,
	"access_token_expires_at" timestamp,
	"scope" text,
	"dub_workspace_id" text,
	"dub_workspace_name" text,
	"dub_workspace_slug" text,
	"is_active" boolean DEFAULT true,
	"last_synced_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dub_oauth_integrations" ADD CONSTRAINT "dub_oauth_integrations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;