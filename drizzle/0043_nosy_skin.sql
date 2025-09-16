CREATE TABLE "dub_integrations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_type" varchar(50) DEFAULT 'Bearer' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"scope" varchar(500) NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"dub_workspace_id" varchar(255),
	"dub_workspace_name" varchar(255),
	"last_used" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "dub_integrations_user_id_unique" UNIQUE("user_id")
);
