import "server-only";

import { eq, or } from "drizzle-orm";
import { withDb } from "@/db";
import {
  customerPanels,
  customerProfiles,
  evidenceLinks,
  knowledgeClaims,
  knowledgeEntities,
  knowledgeRelations,
  nextMoves,
  panelDefinitions,
  sourceDocuments,
} from "@/db/schema";
import type { CustomerAiPromptContext } from "@/lib/prompts";

type PersonaProperties = {
  firstPerson?: unknown;
  speechStyle?: unknown;
  voice?: unknown;
  speechDelivery?: unknown;
};

function persona(properties: Record<string, unknown>) {
  const value = properties as PersonaProperties;
  return {
    firstPerson: typeof value.firstPerson === "string" ? value.firstPerson : "私",
    speechStyle:
      typeof value.speechStyle === "string" ? value.speechStyle : "落ち着いた自然な業務会話",
    voice:
      value.voice === "cedar" || value.voice === "onyx" || value.voice === "marin"
        ? value.voice
        : "cedar",
    speechDelivery:
      value.speechDelivery === "measured" ||
      value.speechDelivery === "practical" ||
      value.speechDelivery === "technical"
        ? value.speechDelivery
        : "measured",
  } as const;
}

export async function getCustomerAiContext(
  customerId: string,
  messages: CustomerAiPromptContext["messages"],
) {
  return withDb(async (db) => {
    const [profile] = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.entityId, customerId));
    if (!profile) return null;

    const [
      entities,
      profiles,
      claims,
      directRelations,
      allRelations,
      evidence,
      documents,
      panels,
      moves,
    ] = await Promise.all([
      db.select().from(knowledgeEntities),
      db.select().from(customerProfiles),
      db.select().from(knowledgeClaims).where(eq(knowledgeClaims.subjectEntityId, customerId)),
      db
        .select()
        .from(knowledgeRelations)
        .where(
          or(
            eq(knowledgeRelations.fromEntityId, customerId),
            eq(knowledgeRelations.toEntityId, customerId),
          ),
        ),
      db.select().from(knowledgeRelations),
      db.select().from(evidenceLinks),
      db.select().from(sourceDocuments),
      db
        .select({
          id: customerPanels.id,
          title: panelDefinitions.title,
          status: customerPanels.status,
          unlockHint: customerPanels.unlockHint,
        })
        .from(customerPanels)
        .innerJoin(panelDefinitions, eq(customerPanels.definitionId, panelDefinitions.id))
        .where(eq(customerPanels.customerEntityId, customerId)),
      db.select().from(nextMoves).where(eq(nextMoves.customerEntityId, customerId)),
    ]);

    const byId = new Map(entities.map((entity) => [entity.id, entity]));
    const profilesById = new Map(profiles.map((item) => [item.entityId, item]));
    const docsById = new Map(documents.map((doc) => [doc.id, doc]));
    const customer = byId.get(customerId);
    const company = byId.get(profile.companyEntityId);
    if (!customer) return null;

    const claimFacts = claims.flatMap((claim) => {
      const links = evidence.filter((item) => item.claimId === claim.id);
      return links.flatMap((link) => {
        const doc = docsById.get(link.sourceDocumentId);
        if (!doc) return [];
        return [
          {
            evidenceId: link.id,
            predicate: claim.predicate,
            value: claim.valueText,
            status: claim.status,
            sourceTitle: doc.title,
            sourceAuthor: doc.authorLabel ?? "記録者不明",
            sourceUrl: doc.sourceUrl,
            quote: link.quote,
          },
        ];
      });
    });

    const relationFacts = directRelations.flatMap((relation) => {
      const entityId =
        relation.fromEntityId === customerId ? relation.toEntityId : relation.fromEntityId;
      const person = byId.get(entityId);
      if (!person) return [];
      return evidence
        .filter((item) => item.relationId === relation.id)
        .flatMap((link) => {
          const doc = docsById.get(link.sourceDocumentId);
          if (!doc) return [];
          return [
            {
              evidenceId: link.id,
              entityId,
              personName: person.canonicalName,
              label: relation.label,
              status: relation.status,
              sourceTitle: doc.title,
              sourceAuthor: doc.authorLabel ?? "記録者不明",
              sourceUrl: doc.sourceUrl,
              quote: link.quote,
            },
          ];
        });
    });

    const directIds = new Set(relationFacts.map((item) => item.entityId));
    const holderReasons = new Map<string, string>();
    for (const relation of relationFacts) {
      holderReasons.set(
        relation.entityId,
        `${customer.canonicalName}と「${relation.label}」の記録がある`,
      );
    }
    for (const relation of allRelations) {
      const fromDirect = directIds.has(relation.fromEntityId);
      const toDirect = directIds.has(relation.toEntityId);
      if (!fromDirect && !toDirect) continue;
      const holderId = fromDirect ? relation.toEntityId : relation.fromEntityId;
      if (holderId === customerId || directIds.has(holderId)) continue;
      const viaId = fromDirect ? relation.fromEntityId : relation.toEntityId;
      const via = byId.get(viaId);
      if (!via || !evidence.some((item) => item.relationId === relation.id)) continue;
      holderReasons.set(holderId, `${via.canonicalName}を介して「${relation.label}」の記録がある`);
    }

    const informationHolders = [...holderReasons].flatMap(([entityId, pathReason]) => {
      const entity = byId.get(entityId);
      if (!entity) return [];
      return [
        {
          entityId,
          name: entity.canonicalName,
          description: entity.description ?? "",
          pathReason,
          href: profilesById.has(entityId) ? `/customers/${entityId}` : null,
        },
      ];
    });
    const person = persona(customer.propertiesJson);
    const unknowns = panels
      .filter((panel) => panel.status === "locked")
      .map((panel) => ({
        panel: panel.title,
        hint: panel.unlockHint ?? "未確認",
        nextMove: moves.find((move) => move.customerPanelId === panel.id)?.label ?? null,
      }));

    return {
      promptContext: {
        customer: {
          id: customer.id,
          name: customer.canonicalName,
          company: company?.canonicalName ?? "",
          role: profile.roleLabel,
          firstPerson: person.firstPerson,
          speechStyle: person.speechStyle,
        },
        facts: claimFacts.map(({ sourceUrl: _sourceUrl, ...fact }) => fact),
        relations: relationFacts.map(({ sourceUrl: _sourceUrl, ...relation }) => relation),
        informationHolders: informationHolders.map(({ href: _href, ...item }) => item),
        unknowns,
        messages,
      } satisfies CustomerAiPromptContext,
      evidence: [...claimFacts, ...relationFacts],
      informationHolders,
      voice: person.voice,
      speechDelivery: person.speechDelivery,
      firstPerson: person.firstPerson,
    };
  });
}
