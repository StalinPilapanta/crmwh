ALTER TABLE "account" ADD COLUMN IF NOT EXISTS "issuer" text;--> statement-breakpoint
ALTER TABLE "media_asset" ADD COLUMN IF NOT EXISTS "transcript" text;
