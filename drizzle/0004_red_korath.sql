CREATE TABLE "customer_panels" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_entity_id" text NOT NULL,
	"definition_id" text NOT NULL,
	"status" text NOT NULL,
	"summary" text,
	"unlock_hint" text,
	"unlocked_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_profiles" (
	"entity_id" text PRIMARY KEY NOT NULL,
	"company_entity_id" text NOT NULL,
	"owner_entity_id" text NOT NULL,
	"role_label" text NOT NULL,
	"image_url" text NOT NULL,
	"catchphrase" text NOT NULL,
	"accent" text NOT NULL,
	"next_contact_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entity_aliases" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_id" text NOT NULL,
	"alias" text NOT NULL,
	"source_type" text
);
--> statement-breakpoint
CREATE TABLE "evidence_links" (
	"id" text PRIMARY KEY NOT NULL,
	"claim_id" text,
	"relation_id" text,
	"source_document_id" text NOT NULL,
	"quote" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_claims" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_entity_id" text NOT NULL,
	"predicate" text NOT NULL,
	"value_text" text NOT NULL,
	"confidence" real NOT NULL,
	"status" text NOT NULL,
	"observed_at" timestamp with time zone,
	"extraction_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_entities" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"canonical_name" text NOT NULL,
	"description" text,
	"properties_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_relations" (
	"id" text PRIMARY KEY NOT NULL,
	"from_entity_id" text NOT NULL,
	"to_entity_id" text NOT NULL,
	"relation_type" text NOT NULL,
	"label" text NOT NULL,
	"confidence" real NOT NULL,
	"status" text NOT NULL,
	"observed_at" timestamp with time zone,
	"extraction_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "next_moves" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_entity_id" text NOT NULL,
	"customer_panel_id" text,
	"label" text NOT NULL,
	"reason" text NOT NULL,
	"status" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "panel_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"icon" text NOT NULL,
	"description" text NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "panel_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_panel_id" text NOT NULL,
	"claim_id" text,
	"relation_id" text
);
--> statement-breakpoint
CREATE TABLE "source_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"source_type" text NOT NULL,
	"external_id" text NOT NULL,
	"source_url" text,
	"title" text NOT NULL,
	"author_label" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"raw_text" text NOT NULL,
	"content_hash" text NOT NULL,
	"external_updated_at" timestamp with time zone,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "case_personas" CASCADE;--> statement-breakpoint
DROP TABLE "daily_reports" CASCADE;--> statement-breakpoint
DROP TABLE "members" CASCADE;--> statement-breakpoint
DROP TABLE "persona_sets" CASCADE;--> statement-breakpoint
DROP TABLE "persona_templates" CASCADE;--> statement-breakpoint
DROP TABLE "preparation_sessions" CASCADE;--> statement-breakpoint
DROP TABLE "preparation_turns" CASCADE;--> statement-breakpoint
DROP TABLE "sales_cases" CASCADE;--> statement-breakpoint
ALTER TABLE "customer_panels" ADD CONSTRAINT "customer_panels_customer_entity_id_knowledge_entities_id_fk" FOREIGN KEY ("customer_entity_id") REFERENCES "public"."knowledge_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_panels" ADD CONSTRAINT "customer_panels_definition_id_panel_definitions_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."panel_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_entity_id_knowledge_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."knowledge_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_company_entity_id_knowledge_entities_id_fk" FOREIGN KEY ("company_entity_id") REFERENCES "public"."knowledge_entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_owner_entity_id_knowledge_entities_id_fk" FOREIGN KEY ("owner_entity_id") REFERENCES "public"."knowledge_entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_aliases" ADD CONSTRAINT "entity_aliases_entity_id_knowledge_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."knowledge_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_claim_id_knowledge_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."knowledge_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_relation_id_knowledge_relations_id_fk" FOREIGN KEY ("relation_id") REFERENCES "public"."knowledge_relations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_source_document_id_source_documents_id_fk" FOREIGN KEY ("source_document_id") REFERENCES "public"."source_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_claims" ADD CONSTRAINT "knowledge_claims_subject_entity_id_knowledge_entities_id_fk" FOREIGN KEY ("subject_entity_id") REFERENCES "public"."knowledge_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_relations" ADD CONSTRAINT "knowledge_relations_from_entity_id_knowledge_entities_id_fk" FOREIGN KEY ("from_entity_id") REFERENCES "public"."knowledge_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_relations" ADD CONSTRAINT "knowledge_relations_to_entity_id_knowledge_entities_id_fk" FOREIGN KEY ("to_entity_id") REFERENCES "public"."knowledge_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "next_moves" ADD CONSTRAINT "next_moves_customer_entity_id_knowledge_entities_id_fk" FOREIGN KEY ("customer_entity_id") REFERENCES "public"."knowledge_entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "next_moves" ADD CONSTRAINT "next_moves_customer_panel_id_customer_panels_id_fk" FOREIGN KEY ("customer_panel_id") REFERENCES "public"."customer_panels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_evidence" ADD CONSTRAINT "panel_evidence_customer_panel_id_customer_panels_id_fk" FOREIGN KEY ("customer_panel_id") REFERENCES "public"."customer_panels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_evidence" ADD CONSTRAINT "panel_evidence_claim_id_knowledge_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."knowledge_claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "panel_evidence" ADD CONSTRAINT "panel_evidence_relation_id_knowledge_relations_id_fk" FOREIGN KEY ("relation_id") REFERENCES "public"."knowledge_relations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_panels_customer_definition_unique" ON "customer_panels" USING btree ("customer_entity_id","definition_id");--> statement-breakpoint
CREATE INDEX "customer_panels_customer_idx" ON "customer_panels" USING btree ("customer_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "entity_aliases_entity_alias_unique" ON "entity_aliases" USING btree ("entity_id","alias");--> statement-breakpoint
CREATE INDEX "entity_aliases_alias_idx" ON "entity_aliases" USING btree ("alias");--> statement-breakpoint
CREATE INDEX "evidence_links_source_idx" ON "evidence_links" USING btree ("source_document_id");--> statement-breakpoint
CREATE INDEX "knowledge_claims_subject_idx" ON "knowledge_claims" USING btree ("subject_entity_id");--> statement-breakpoint
CREATE INDEX "knowledge_entities_type_idx" ON "knowledge_entities" USING btree ("type");--> statement-breakpoint
CREATE INDEX "knowledge_relations_from_idx" ON "knowledge_relations" USING btree ("from_entity_id");--> statement-breakpoint
CREATE INDEX "knowledge_relations_to_idx" ON "knowledge_relations" USING btree ("to_entity_id");--> statement-breakpoint
CREATE INDEX "next_moves_customer_idx" ON "next_moves" USING btree ("customer_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "panel_definitions_key_unique" ON "panel_definitions" USING btree ("key");--> statement-breakpoint
CREATE INDEX "panel_evidence_panel_idx" ON "panel_evidence" USING btree ("customer_panel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "source_documents_source_external_unique" ON "source_documents" USING btree ("source_type","external_id");--> statement-breakpoint
CREATE INDEX "source_documents_occurred_at_idx" ON "source_documents" USING btree ("occurred_at");