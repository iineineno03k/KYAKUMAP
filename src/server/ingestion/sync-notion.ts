import "server-only";

import { eq } from "drizzle-orm";
import { withDb } from "@/db";
import { entityAliases, knowledgeEntities, sourceDocuments } from "@/db/schema";
import { clip, logTurn } from "@/lib/telemetry";
import { extractKnowledge } from "@/server/knowledge/extract";
import { persistKnowledgeExtraction } from "@/server/knowledge/persist-extraction";
import { notionConnector } from "./notion-connector";
import { documentContentHash, persistDocuments } from "./persist-documents";

async function knownEntitiesForExtraction() {
  return withDb(async (db) => {
    const [entities, aliases] = await Promise.all([
      db.select().from(knowledgeEntities),
      db.select().from(entityAliases),
    ]);
    const aliasesByEntity = new Map<string, string[]>();
    for (const alias of aliases) {
      const values = aliasesByEntity.get(alias.entityId) ?? [];
      values.push(alias.alias);
      aliasesByEntity.set(alias.entityId, values);
    }
    return entities.map((entity) => ({
      id: entity.id,
      name: entity.canonicalName,
      aliases: aliasesByEntity.get(entity.id) ?? [],
    }));
  });
}

export async function syncNotionKnowledge(options: { limit?: number; force?: boolean } = {}) {
  const startedAt = Date.now();
  const limit = Math.max(1, Math.floor(options.limit ?? 1));
  const fetched = await notionConnector.fetchDocuments();
  const existing = await withDb((db) =>
    db
      .select({
        externalId: sourceDocuments.externalId,
        contentHash: sourceDocuments.contentHash,
      })
      .from(sourceDocuments)
      .where(eq(sourceDocuments.sourceType, notionConnector.sourceType)),
  );
  const hashByExternalId = new Map(existing.map((item) => [item.externalId, item.contentHash]));
  const candidates = fetched.filter(
    (document) =>
      options.force ||
      hashByExternalId.get(document.externalId) !== documentContentHash(document.rawText),
  );
  const selected = candidates.slice(0, limit);
  const rawSync = await persistDocuments(selected);
  const results: Array<{
    sourceDocumentId: string;
    title: string;
    entities: number;
    createdEntities: number;
    claims: number;
    relations: number;
  }> = [];

  for (const persisted of rawSync.persisted) {
    const sourceDocument = await withDb(async (db) => {
      const [row] = await db
        .select()
        .from(sourceDocuments)
        .where(eq(sourceDocuments.id, persisted.id));
      return row;
    });
    if (!sourceDocument) throw new Error(`原文 ${persisted.id} を保存後に取得できませんでした`);

    const extraction = await extractKnowledge({
      title: sourceDocument.title,
      authorLabel: sourceDocument.authorLabel,
      rawText: sourceDocument.rawText,
      knownEntities: await knownEntitiesForExtraction(),
    });
    const saved = await persistKnowledgeExtraction({
      sourceDocumentId: sourceDocument.id,
      sourceType: sourceDocument.sourceType,
      occurredAt: sourceDocument.occurredAt,
      extraction,
    });
    results.push({
      sourceDocumentId: sourceDocument.id,
      title: sourceDocument.title,
      ...saved,
    });
  }

  const summary = {
    fetched: fetched.length,
    candidates: candidates.length,
    selected: selected.length,
    imported: rawSync.imported,
    updated: rawSync.updated,
    unchanged: rawSync.unchanged,
    results,
    syncedAt: new Date().toISOString(),
  };
  await logTurn({
    kind: "knowledge",
    ms: Date.now() - startedAt,
    input: `Notion提出済み記録 ${fetched.length}件 / 上限 ${limit}件`,
    output: clip(JSON.stringify(summary)),
    note: "Notion原文同期 → OrcaRouter知識抽出 → 知識テーブル保存",
  });
  return summary;
}
