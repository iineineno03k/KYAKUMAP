CREATE TABLE "case_personas" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"persona_template_id" text NOT NULL,
	"display_name" text NOT NULL,
	"overrides_json" jsonb NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"author_id" text NOT NULL,
	"report_date" date NOT NULL,
	"activity_type" text,
	"body" text NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"external_id" text,
	"extracted_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"role_label" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona_sets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"config_json" jsonb NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persona_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"persona_set_id" text NOT NULL,
	"label" text NOT NULL,
	"role" text NOT NULL,
	"base_persona_json" jsonb NOT NULL,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "preparation_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"case_id" text NOT NULL,
	"case_persona_id" text NOT NULL,
	"member_id" text NOT NULL,
	"source_session_id" text,
	"status" text NOT NULL,
	"persona_snapshot_json" jsonb NOT NULL,
	"selected_plan_json" jsonb,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "preparation_turns" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"parent_turn_id" text,
	"role" text NOT NULL,
	"body" text NOT NULL,
	"at_seconds" real NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_cases" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"customer_name" text NOT NULL,
	"stage" text NOT NULL,
	"outcome" text NOT NULL,
	"next_visit_at" timestamp with time zone,
	"summary" text,
	"facts_json" jsonb NOT NULL,
	"needs_discussion" boolean DEFAULT false NOT NULL,
	"recommendations_json" jsonb NOT NULL,
	"result_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_personas" ADD CONSTRAINT "case_personas_case_id_sales_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."sales_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_personas" ADD CONSTRAINT "case_personas_persona_template_id_persona_templates_id_fk" FOREIGN KEY ("persona_template_id") REFERENCES "public"."persona_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_case_id_sales_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."sales_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_reports" ADD CONSTRAINT "daily_reports_author_id_members_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "persona_templates" ADD CONSTRAINT "persona_templates_persona_set_id_persona_sets_id_fk" FOREIGN KEY ("persona_set_id") REFERENCES "public"."persona_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_sessions" ADD CONSTRAINT "preparation_sessions_case_id_sales_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."sales_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_sessions" ADD CONSTRAINT "preparation_sessions_case_persona_id_case_personas_id_fk" FOREIGN KEY ("case_persona_id") REFERENCES "public"."case_personas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_sessions" ADD CONSTRAINT "preparation_sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_sessions" ADD CONSTRAINT "preparation_sessions_source_session_id_preparation_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "public"."preparation_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_turns" ADD CONSTRAINT "preparation_turns_session_id_preparation_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."preparation_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preparation_turns" ADD CONSTRAINT "preparation_turns_parent_turn_id_preparation_turns_id_fk" FOREIGN KEY ("parent_turn_id") REFERENCES "public"."preparation_turns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_cases" ADD CONSTRAINT "sales_cases_owner_id_members_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "case_personas_case_id_idx" ON "case_personas" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "case_personas_template_id_idx" ON "case_personas" USING btree ("persona_template_id");--> statement-breakpoint
CREATE INDEX "daily_reports_case_id_idx" ON "daily_reports" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "daily_reports_author_id_idx" ON "daily_reports" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "persona_templates_set_id_idx" ON "persona_templates" USING btree ("persona_set_id");--> statement-breakpoint
CREATE INDEX "preparation_sessions_case_id_idx" ON "preparation_sessions" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "preparation_sessions_case_persona_id_idx" ON "preparation_sessions" USING btree ("case_persona_id");--> statement-breakpoint
CREATE INDEX "preparation_sessions_member_id_idx" ON "preparation_sessions" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "preparation_sessions_source_session_id_idx" ON "preparation_sessions" USING btree ("source_session_id");--> statement-breakpoint
CREATE INDEX "preparation_turns_session_id_idx" ON "preparation_turns" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "preparation_turns_parent_turn_id_idx" ON "preparation_turns" USING btree ("parent_turn_id");--> statement-breakpoint
CREATE INDEX "preparation_turns_session_time_idx" ON "preparation_turns" USING btree ("session_id","at_seconds");--> statement-breakpoint
CREATE INDEX "sales_cases_owner_id_idx" ON "sales_cases" USING btree ("owner_id");