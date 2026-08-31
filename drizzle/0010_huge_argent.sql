ALTER TABLE "agent_profile" ADD COLUMN IF NOT EXISTS "followup_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_profile" ADD COLUMN IF NOT EXISTS "followup_reminder_text" text;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN IF NOT EXISTS "followup_stage" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN IF NOT EXISTS "followup_last_at" timestamp;
