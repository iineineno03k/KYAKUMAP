CREATE TABLE "customer_panel_items" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_panel_id" text NOT NULL,
	"item_definition_id" text NOT NULL,
	"status" text NOT NULL,
	"value_text" text,
	"unlock_hint" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "panel_item_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"panel_definition_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"description" text NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_panel_items" ADD CONSTRAINT "customer_panel_items_customer_panel_id_customer_panels_id_fk" FOREIGN KEY ("customer_panel_id") REFERENCES "public"."customer_panels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_panel_items" ADD CONSTRAINT "customer_panel_items_item_definition_id_panel_item_definitions_id_fk" FOREIGN KEY ("item_definition_id") REFERENCES "public"."panel_item_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_item_definitions" ADD CONSTRAINT "panel_item_definitions_panel_definition_id_panel_definitions_id_fk" FOREIGN KEY ("panel_definition_id") REFERENCES "public"."panel_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_panel_items_panel_definition_unique" ON "customer_panel_items" USING btree ("customer_panel_id","item_definition_id");--> statement-breakpoint
CREATE INDEX "customer_panel_items_panel_idx" ON "customer_panel_items" USING btree ("customer_panel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "panel_item_definitions_panel_key_unique" ON "panel_item_definitions" USING btree ("panel_definition_id","key");