CREATE TABLE "ai_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"api_key" text,
	"is_active" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "ai_configs_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer,
	"source_channel" text,
	"destination_channel" text,
	"message_id" text,
	"status" text NOT NULL,
	"details" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_name" text NOT NULL,
	"phone_number" text NOT NULL,
	"session_string" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"last_active" timestamp
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"session_id" integer NOT NULL,
	"source_channels" text[] NOT NULL,
	"destination_channels" text[] NOT NULL,
	"filters" jsonb DEFAULT '{"mediaTypes":{"text":true,"photo":true,"video":true,"document":true,"audio":true,"voice":true,"sticker":true,"videoNote":true,"animation":true,"poll":true,"contact":true,"location":true,"invoice":true},"aiFilters":{"isEnabled":false,"provider":"openai","model":"gpt-4o-mini","mode":"blacklist","blacklistRules":[],"whitelistRules":[]}}'::jsonb,
	"options" jsonb DEFAULT '{"withCaption":true,"dropAuthor":false}'::jsonb,
	"is_active" boolean DEFAULT false,
	"status" text DEFAULT 'stopped',
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"display_name" text,
	"roles" text[] DEFAULT '{"user"}',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;