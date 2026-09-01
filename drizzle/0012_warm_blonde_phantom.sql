ALTER TABLE "agent_profile" ADD COLUMN IF NOT EXISTS "reengage_text" text;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN IF NOT EXISTS "awaiting_reply_at" timestamp;--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN IF NOT EXISTS "reengage_stage" integer DEFAULT 0 NOT NULL;
