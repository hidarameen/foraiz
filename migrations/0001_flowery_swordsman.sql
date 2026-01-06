ALTER TABLE "logs" DROP CONSTRAINT "logs_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_session_id_sessions_id_fk";
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "options" SET DEFAULT '{"withCaption":true,"dropAuthor":false,"aiRewrite":{"isEnabled":false,"provider":"openai","model":"gpt-4o-mini","rules":[]}}'::jsonb;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;