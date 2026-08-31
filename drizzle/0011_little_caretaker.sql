CREATE TABLE IF NOT EXISTS "kb_entry_media" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"kb_entry_id" text NOT NULL,
	"media_asset_id" text NOT NULL,
	"short_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kb_entry_media" ADD CONSTRAINT "kb_entry_media_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_entry_media" ADD CONSTRAINT "kb_entry_media_kb_entry_id_kb_entry_id_fk" FOREIGN KEY ("kb_entry_id") REFERENCES "public"."kb_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kb_entry_media" ADD CONSTRAINT "kb_entry_media_media_asset_id_media_asset_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kb_media_org_idx" ON "kb_entry_media" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "kb_media_entry_idx" ON "kb_entry_media" USING btree ("kb_entry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kb_media_entry_asset_uq" ON "kb_entry_media" USING btree ("kb_entry_id","media_asset_id");--> statement-breakpoint
CREATE UNIQUE INDEX "kb_media_short_id_uq" ON "kb_entry_media" USING btree ("organization_id","short_id");