ALTER TABLE "preparation_sessions" ADD COLUMN "recording_url" text;--> statement-breakpoint
ALTER TABLE "preparation_sessions" ADD COLUMN "recording_captions_url" text;--> statement-breakpoint
ALTER TABLE "preparation_sessions" ADD COLUMN "highlight_start_seconds" real;--> statement-breakpoint
ALTER TABLE "preparation_sessions" ADD COLUMN "highlight_end_seconds" real;--> statement-breakpoint
ALTER TABLE "preparation_sessions" ADD COLUMN "highlight_title" text;--> statement-breakpoint
ALTER TABLE "preparation_sessions" ADD COLUMN "highlight_takeaway" text;