import "server-only";

import { createHash } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { withDb } from "@/db";
import {
  entityAliases,
  evidenceLinks,
  knowledgeClaims,
  knowledgeEntities,
  knowledgeRelations,
} from "@/db/schema";
import type { KnowledgeExtraction } from "./extract";

const EXTRACTION_VERSION = "knowledge-v1";

function stableId(prefix: string, ...parts: string[]) {
  const digest = createHash("sha256").update(parts.join("\u0000")).digest("hex").slice(0, 24);
  return `${prefix}-${digest}`;
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase("ja-JP");
}

export async function persistKnowledgeExtraction(input: {
  sourceDocumentId: string;
  sourceType: string;
  occurredAt: Date;
  extraction: KnowledgeExtraction;
}) {
  return withDb((db) =>
    db.transaction(async (tx) => {
      const [existingEntities, existingAliases, previousEvidence] = await Promise.all([
        tx.select().from(knowledgeEntities),
        tx.select().from(entityAliases),
        tx
          .select({
            id: evidenceLinks.id,
            claimId: evidenceLinks.claimId,
            relationId: evidenceLinks.relationId,
          })
          .from(evidenceLinks)
          .where(eq(evidenceLinks.sourceDocumentId, input.sourceDocumentId)),
      ]);

      const knownIds = new Set(existingEntities.map((entity) => entity.id));
      const typeById = new Map(existingEntities.map((entity) => [entity.id, entity.type]));
      const idsByName = new Map<string, Set<string>>();
      const addName = (type: string, name: string, id: string) => {
        const normalizedName = normalized(name);
        if (!normalizedName) return;
        const key = `${type}:${normalizedName}`;
        const ids = idsByName.get(key) ?? new Set<string>();
        ids.add(id);
        idsByName.set(key, ids);
      };
      for (const entity of existingEntities) addName(entity.type, entity.canonicalName, entity.id);
      for (const alias of existingAliases) {
        const type = typeById.get(alias.entityId);
        if (type) addName(type, alias.alias, alias.entityId);
      }

      const entityIdByTempId = new Map<string, string>();
      let createdEntities = 0;
      for (const entity of input.extraction.entities) {
        const exactIds = idsByName.get(`${entity.type}:${normalized(entity.canonicalName)}`);
        const exactId = exactIds?.size === 1 ? [...exactIds][0] : null;
        const matchedId =
          entity.matchedEntityId && knownIds.has(entity.matchedEntityId)
            ? entity.matchedEntityId
            : exactId;
        const entityId =
          matchedId ??
          stableId("entity", input.sourceDocumentId, entity.type, normalized(entity.canonicalName));
        entityIdByTempId.set(entity.tempId, entityId);

        if (!matchedId) {
          await tx
            .insert(knowledgeEntities)
            .values({
              id: entityId,
              type: entity.type,
              canonicalName: entity.canonicalName,
              description: null,
              propertiesJson: {},
            })
            .onConflictDoUpdate({
              target: knowledgeEntities.id,
              set: {
                type: entity.type,
                canonicalName: entity.canonicalName,
                updatedAt: new Date(),
              },
            });
          createdEntities += 1;
          knownIds.add(entityId);
        }

        for (const alias of new Set(entity.aliases.map((value) => value.trim()).filter(Boolean))) {
          await tx
            .insert(entityAliases)
            .values({
              id: stableId("alias", entityId, normalized(alias)),
              entityId,
              alias,
              sourceType: input.sourceType,
            })
            .onConflictDoNothing();
        }
      }

      const nextEvidenceIds = new Set<string>();
      const nextClaimIds = new Set<string>();
      const nextRelationIds = new Set<string>();
      let claims = 0;
      let relations = 0;

      for (const [index, claim] of input.extraction.claims.entries()) {
        const subjectEntityId = entityIdByTempId.get(claim.subjectTempId);
        if (!subjectEntityId) continue;
        const claimId = stableId("claim", input.sourceDocumentId, String(index));
        const evidenceId = stableId("evidence", claimId);
        await tx
          .insert(knowledgeClaims)
          .values({
            id: claimId,
            subjectEntityId,
            predicate: claim.predicate,
            valueText: claim.valueText,
            confidence: claim.confidence,
            status: "extracted",
            observedAt: input.occurredAt,
            extractionVersion: EXTRACTION_VERSION,
          })
          .onConflictDoUpdate({
            target: knowledgeClaims.id,
            set: {
              subjectEntityId,
              predicate: claim.predicate,
              valueText: claim.valueText,
              confidence: claim.confidence,
              status: "extracted",
              observedAt: input.occurredAt,
              extractionVersion: EXTRACTION_VERSION,
            },
          });
        await tx
          .insert(evidenceLinks)
          .values({
            id: evidenceId,
            claimId,
            relationId: null,
            sourceDocumentId: input.sourceDocumentId,
            quote: claim.evidenceQuote,
          })
          .onConflictDoUpdate({
            target: evidenceLinks.id,
            set: {
              claimId,
              relationId: null,
              sourceDocumentId: input.sourceDocumentId,
              quote: claim.evidenceQuote,
            },
          });
        nextClaimIds.add(claimId);
        nextEvidenceIds.add(evidenceId);
        claims += 1;
      }

      for (const [index, relation] of input.extraction.relations.entries()) {
        const fromEntityId = entityIdByTempId.get(relation.fromTempId);
        const toEntityId = entityIdByTempId.get(relation.toTempId);
        if (!fromEntityId || !toEntityId) continue;
        const relationId = stableId("relation", input.sourceDocumentId, String(index));
        const evidenceId = stableId("evidence", relationId);
        await tx
          .insert(knowledgeRelations)
          .values({
            id: relationId,
            fromEntityId,
            toEntityId,
            relationType: relation.relationType,
            label: relation.label,
            confidence: relation.confidence,
            status: "extracted",
            observedAt: input.occurredAt,
            extractionVersion: EXTRACTION_VERSION,
          })
          .onConflictDoUpdate({
            target: knowledgeRelations.id,
            set: {
              fromEntityId,
              toEntityId,
              relationType: relation.relationType,
              label: relation.label,
              confidence: relation.confidence,
              status: "extracted",
              observedAt: input.occurredAt,
              extractionVersion: EXTRACTION_VERSION,
            },
          });
        await tx
          .insert(evidenceLinks)
          .values({
            id: evidenceId,
            claimId: null,
            relationId,
            sourceDocumentId: input.sourceDocumentId,
            quote: relation.evidenceQuote,
          })
          .onConflictDoUpdate({
            target: evidenceLinks.id,
            set: {
              claimId: null,
              relationId,
              sourceDocumentId: input.sourceDocumentId,
              quote: relation.evidenceQuote,
            },
          });
        nextRelationIds.add(relationId);
        nextEvidenceIds.add(evidenceId);
        relations += 1;
      }

      const staleEvidenceIds = previousEvidence
        .map((item) => item.id)
        .filter((id) => !nextEvidenceIds.has(id));
      if (staleEvidenceIds.length) {
        await tx.delete(evidenceLinks).where(inArray(evidenceLinks.id, staleEvidenceIds));
      }
      const staleClaimIds = previousEvidence
        .flatMap((item) => (item.claimId ? [item.claimId] : []))
        .filter((id) => !nextClaimIds.has(id));
      if (staleClaimIds.length) {
        await tx.delete(knowledgeClaims).where(inArray(knowledgeClaims.id, staleClaimIds));
      }
      const staleRelationIds = previousEvidence
        .flatMap((item) => (item.relationId ? [item.relationId] : []))
        .filter((id) => !nextRelationIds.has(id));
      if (staleRelationIds.length) {
        await tx.delete(knowledgeRelations).where(inArray(knowledgeRelations.id, staleRelationIds));
      }

      return { entities: entityIdByTempId.size, createdEntities, claims, relations };
    }),
  );
}
