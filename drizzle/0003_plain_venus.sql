ALTER TABLE "daily_reports" ADD COLUMN "external_url" text;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD COLUMN "external_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD COLUMN "content_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "daily_reports_source_external_id_unique" ON "daily_reports" USING btree ("source","external_id");