import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

type JsonObject = Record<string, unknown>;

/** 外部サービスから取得した原文。AIの派生結果を混ぜないSSoT。 */
export const sourceDocuments = pgTable(
  "source_documents",
  {
    id: text("id").primaryKey(),
    sourceType: text("source_type").notNull(),
    externalId: text("external_id").notNull(),
    sourceUrl: text("source_url"),
    title: text("title").notNull(),
    authorLabel: text("author_label"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    rawText: text("raw_text").notNull(),
    contentHash: text("content_hash").notNull(),
    externalUpdatedAt: timestamp("external_updated_at", { withTimezone: true }),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("source_documents_source_external_unique").on(table.sourceType, table.externalId),
    index("source_documents_occurred_at_idx").on(table.occurredAt),
  ],
);

/** 人物・企業・部署・案件など、媒体をまたいで同一性を解決したノード。 */
export const knowledgeEntities = pgTable(
  "knowledge_entities",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    canonicalName: text("canonical_name").notNull(),
    description: text("description"),
    propertiesJson: jsonb("properties_json").$type<JsonObject>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("knowledge_entities_type_idx").on(table.type)],
);

export const entityAliases = pgTable(
  "entity_aliases",
  {
    id: text("id").primaryKey(),
    entityId: text("entity_id")
      .notNull()
      .references(() => knowledgeEntities.id, { onDelete: "cascade" }),
    alias: text("alias").notNull(),
    sourceType: text("source_type"),
  },
  (table) => [
    uniqueIndex("entity_aliases_entity_alias_unique").on(table.entityId, table.alias),
    index("entity_aliases_alias_idx").on(table.alias),
  ],
);

/** エンティティに関するスカラー事実。必ずevidence_linksから原文へ戻れる。 */
export const knowledgeClaims = pgTable(
  "knowledge_claims",
  {
    id: text("id").primaryKey(),
    subjectEntityId: text("subject_entity_id")
      .notNull()
      .references(() => knowledgeEntities.id, { onDelete: "cascade" }),
    predicate: text("predicate").notNull(),
    valueText: text("value_text").notNull(),
    confidence: real("confidence").notNull(),
    status: text("status").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }),
    extractionVersion: text("extraction_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("knowledge_claims_subject_idx").on(table.subjectEntityId)],
);

/** エンティティ同士の有向エッジ。Graph DBへ投影できる派生インデックス。 */
export const knowledgeRelations = pgTable(
  "knowledge_relations",
  {
    id: text("id").primaryKey(),
    fromEntityId: text("from_entity_id")
      .notNull()
      .references(() => knowledgeEntities.id, { onDelete: "cascade" }),
    toEntityId: text("to_entity_id")
      .notNull()
      .references(() => knowledgeEntities.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    label: text("label").notNull(),
    confidence: real("confidence").notNull(),
    status: text("status").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }),
    extractionVersion: text("extraction_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("knowledge_relations_from_idx").on(table.fromEntityId),
    index("knowledge_relations_to_idx").on(table.toEntityId),
  ],
);

/** claim/relationのどちらにも付けられる原文根拠。 */
export const evidenceLinks = pgTable(
  "evidence_links",
  {
    id: text("id").primaryKey(),
    claimId: text("claim_id").references(() => knowledgeClaims.id, { onDelete: "cascade" }),
    relationId: text("relation_id").references(() => knowledgeRelations.id, {
      onDelete: "cascade",
    }),
    sourceDocumentId: text("source_document_id")
      .notNull()
      .references(() => sourceDocuments.id, { onDelete: "cascade" }),
    quote: text("quote").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("evidence_links_source_idx").on(table.sourceDocumentId)],
);

/** 顧客人物ノードにだけ必要な表示・担当情報。知識グラフのノード本体とは分離。 */
export const customerProfiles = pgTable("customer_profiles", {
  entityId: text("entity_id")
    .primaryKey()
    .references(() => knowledgeEntities.id, { onDelete: "cascade" }),
  companyEntityId: text("company_entity_id")
    .notNull()
    .references(() => knowledgeEntities.id),
  ownerEntityId: text("owner_entity_id")
    .notNull()
    .references(() => knowledgeEntities.id),
  roleLabel: text("role_label").notNull(),
  imageUrl: text("image_url").notNull(),
  catchphrase: text("catchphrase").notNull(),
  accent: text("accent").notNull(),
  nextContactAt: timestamp("next_contact_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** 会社・商材ごとに固定する情報領域。AIがターンごとに勝手に変えない。 */
export const panelDefinitions = pgTable(
  "panel_definitions",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    title: text("title").notNull(),
    icon: text("icon").notNull(),
    description: text("description").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [uniqueIndex("panel_definitions_key_unique").on(table.key)],
);

/** 知識グラフを営業準備向けの情報領域へ投影したもの。 */
export const customerPanels = pgTable(
  "customer_panels",
  {
    id: text("id").primaryKey(),
    customerEntityId: text("customer_entity_id")
      .notNull()
      .references(() => knowledgeEntities.id, { onDelete: "cascade" }),
    definitionId: text("definition_id")
      .notNull()
      .references(() => panelDefinitions.id),
    status: text("status").notNull(),
    summary: text("summary"),
    unlockHint: text("unlock_hint"),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("customer_panels_customer_definition_unique").on(
      table.customerEntityId,
      table.definitionId,
    ),
    index("customer_panels_customer_idx").on(table.customerEntityId),
  ],
);

/** パネルを構成する評価観点。5分の1だけ分かってパネル全体が開くことを防ぐ。 */
export const panelItemDefinitions = pgTable(
  "panel_item_definitions",
  {
    id: text("id").primaryKey(),
    panelDefinitionId: text("panel_definition_id")
      .notNull()
      .references(() => panelDefinitions.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull(),
    weight: integer("weight").notNull().default(1),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [
    uniqueIndex("panel_item_definitions_panel_key_unique").on(table.panelDefinitionId, table.key),
  ],
);

/** 顧客ごとの小項目の充足状態。情報充足度はこの重み付き充足率から計算する。 */
export const customerPanelItems = pgTable(
  "customer_panel_items",
  {
    id: text("id").primaryKey(),
    customerPanelId: text("customer_panel_id")
      .notNull()
      .references(() => customerPanels.id, { onDelete: "cascade" }),
    itemDefinitionId: text("item_definition_id")
      .notNull()
      .references(() => panelItemDefinitions.id),
    status: text("status").notNull(),
    valueText: text("value_text"),
    unlockHint: text("unlock_hint"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("customer_panel_items_panel_definition_unique").on(
      table.customerPanelId,
      table.itemDefinitionId,
    ),
    index("customer_panel_items_panel_idx").on(table.customerPanelId),
  ],
);

export const panelEvidence = pgTable(
  "panel_evidence",
  {
    id: text("id").primaryKey(),
    customerPanelId: text("customer_panel_id")
      .notNull()
      .references(() => customerPanels.id, { onDelete: "cascade" }),
    claimId: text("claim_id").references(() => knowledgeClaims.id, { onDelete: "cascade" }),
    relationId: text("relation_id").references(() => knowledgeRelations.id, {
      onDelete: "cascade",
    }),
  },
  (table) => [index("panel_evidence_panel_idx").on(table.customerPanelId)],
);

export const nextMoves = pgTable(
  "next_moves",
  {
    id: text("id").primaryKey(),
    customerEntityId: text("customer_entity_id")
      .notNull()
      .references(() => knowledgeEntities.id, { onDelete: "cascade" }),
    customerPanelId: text("customer_panel_id").references(() => customerPanels.id, {
      onDelete: "set null",
    }),
    label: text("label").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [index("next_moves_customer_idx").on(table.customerEntityId)],
);

export const sourceDocumentsRelations = relations(sourceDocuments, ({ many }) => ({
  evidence: many(evidenceLinks),
}));

export const knowledgeEntitiesRelations = relations(knowledgeEntities, ({ many }) => ({
  aliases: many(entityAliases),
  claims: many(knowledgeClaims),
  outgoingRelations: many(knowledgeRelations, { relationName: "outgoing" }),
  incomingRelations: many(knowledgeRelations, { relationName: "incoming" }),
  panels: many(customerPanels),
}));

export const knowledgeRelationsRelations = relations(knowledgeRelations, ({ one, many }) => ({
  from: one(knowledgeEntities, {
    fields: [knowledgeRelations.fromEntityId],
    references: [knowledgeEntities.id],
    relationName: "outgoing",
  }),
  to: one(knowledgeEntities, {
    fields: [knowledgeRelations.toEntityId],
    references: [knowledgeEntities.id],
    relationName: "incoming",
  }),
  evidence: many(evidenceLinks),
}));

export const knowledgeClaimsRelations = relations(knowledgeClaims, ({ one, many }) => ({
  subject: one(knowledgeEntities, {
    fields: [knowledgeClaims.subjectEntityId],
    references: [knowledgeEntities.id],
  }),
  evidence: many(evidenceLinks),
}));

export const customerPanelsRelations = relations(customerPanels, ({ one, many }) => ({
  customer: one(knowledgeEntities, {
    fields: [customerPanels.customerEntityId],
    references: [knowledgeEntities.id],
  }),
  definition: one(panelDefinitions, {
    fields: [customerPanels.definitionId],
    references: [panelDefinitions.id],
  }),
  evidence: many(panelEvidence),
  items: many(customerPanelItems),
}));
