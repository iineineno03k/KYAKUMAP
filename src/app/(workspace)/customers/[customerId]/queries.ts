import { asc, eq, inArray } from "drizzle-orm";
import { withDb } from "@/db";
import {
  customerPanelItems,
  customerPanels,
  customerProfiles,
  evidenceLinks,
  knowledgeClaims,
  knowledgeEntities,
  knowledgeRelations,
  nextMoves,
  panelDefinitions,
  panelEvidence,
  panelItemDefinitions,
  sourceDocuments,
} from "@/db/schema";
export async function getCustomerBoard(customerId: string) {
  return withDb(async (db) => {
    const [profile] = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.entityId, customerId));
    if (!profile) return null;
    const [entities, profiles, panels, moves, outgoing] = await Promise.all([
      db.select().from(knowledgeEntities),
      db.select().from(customerProfiles),
      db
        .select({
          id: customerPanels.id,
          title: panelDefinitions.title,
          icon: panelDefinitions.icon,
          status: customerPanels.status,
          summary: customerPanels.summary,
          unlockHint: customerPanels.unlockHint,
          sortOrder: panelDefinitions.sortOrder,
        })
        .from(customerPanels)
        .innerJoin(panelDefinitions, eq(customerPanels.definitionId, panelDefinitions.id))
        .where(eq(customerPanels.customerEntityId, customerId))
        .orderBy(asc(panelDefinitions.sortOrder)),
      db
        .select()
        .from(nextMoves)
        .where(eq(nextMoves.customerEntityId, customerId))
        .orderBy(asc(nextMoves.sortOrder)),
      db.select().from(knowledgeRelations),
    ]);
    const byId = new Map(entities.map((entity) => [entity.id, entity]));
    const profilesById = new Map(profiles.map((item) => [item.entityId, item]));
    const profileIds = new Set(profiles.map((item) => item.entityId));
    const customer = byId.get(profile.entityId);
    if (!customer) return null;
    const rawSalesProfile = customer.propertiesJson.salesProfile;
    const salesProfile =
      rawSalesProfile && typeof rawSalesProfile === "object"
        ? Object.fromEntries(
            Object.entries(rawSalesProfile).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : {};
    const panelIds = panels.map((panel) => panel.id);
    const items = panelIds.length
      ? await db
          .select({
            id: customerPanelItems.id,
            panelId: customerPanelItems.customerPanelId,
            label: panelItemDefinitions.label,
            description: panelItemDefinitions.description,
            weight: panelItemDefinitions.weight,
            status: customerPanelItems.status,
            valueText: customerPanelItems.valueText,
            unlockHint: customerPanelItems.unlockHint,
            sortOrder: panelItemDefinitions.sortOrder,
          })
          .from(customerPanelItems)
          .innerJoin(
            panelItemDefinitions,
            eq(customerPanelItems.itemDefinitionId, panelItemDefinitions.id),
          )
          .where(inArray(customerPanelItems.customerPanelId, panelIds))
          .orderBy(asc(panelItemDefinitions.sortOrder))
      : [];
    const links = panelIds.length
      ? await db
          .select()
          .from(panelEvidence)
          .where(inArray(panelEvidence.customerPanelId, panelIds))
      : [];
    const claimIds = links.flatMap((link) => (link.claimId ? [link.claimId] : []));
    const relationIds = links.flatMap((link) => (link.relationId ? [link.relationId] : []));
    const [claims, relations, allEvidence, documents] = await Promise.all([
      claimIds.length
        ? db.select().from(knowledgeClaims).where(inArray(knowledgeClaims.id, claimIds))
        : [],
      relationIds.length
        ? db.select().from(knowledgeRelations).where(inArray(knowledgeRelations.id, relationIds))
        : [],
      db.select().from(evidenceLinks),
      db.select().from(sourceDocuments),
    ]);
    const docsById = new Map(documents.map((doc) => [doc.id, doc]));
    const evidence = links.flatMap((link) => {
      const claim = claims.find((item) => item.id === link.claimId);
      const relation = relations.find((item) => item.id === link.relationId);
      const sourceLink = allEvidence.find(
        (item) => item.claimId === claim?.id || item.relationId === relation?.id,
      );
      const doc = sourceLink ? docsById.get(sourceLink.sourceDocumentId) : null;
      if (!doc) return [];
      return [
        {
          id: link.id,
          panelId: link.customerPanelId,
          fact: claim?.valueText ?? relation?.label ?? "",
          sourceLabel: doc.title,
          authorName: doc.authorLabel ?? "記録者不明",
          sourceUrl: doc.sourceUrl,
        },
      ];
    });
    const adjacentIds = new Set([customerId]);
    let frontier = new Set([customerId]);
    for (let depth = 0; depth < 2; depth += 1) {
      const nextFrontier = new Set<string>();
      for (const relation of outgoing) {
        if (frontier.has(relation.fromEntityId)) nextFrontier.add(relation.toEntityId);
        if (frontier.has(relation.toEntityId)) nextFrontier.add(relation.fromEntityId);
      }
      for (const entityId of nextFrontier) adjacentIds.add(entityId);
      frontier = nextFrontier;
    }
    const graphRelations = outgoing.filter(
      (relation) => adjacentIds.has(relation.fromEntityId) && adjacentIds.has(relation.toEntityId),
    );
    const directIds = new Set(
      graphRelations.flatMap((relation) => {
        if (relation.fromEntityId === customerId) return [relation.toEntityId];
        if (relation.toEntityId === customerId) return [relation.fromEntityId];
        return [];
      }),
    );
    const graphNodes = [...adjacentIds].flatMap((entityId) => {
      const entity = byId.get(entityId);
      if (!entity) return [];
      return [
        {
          id: entity.id,
          name: entity.canonicalName,
          description: entity.description ?? "",
          type: entity.type,
          imageUrl: profilesById.get(entity.id)?.imageUrl ?? null,
          depth: entity.id === customerId ? 0 : directIds.has(entity.id) ? 1 : 2,
          href: profileIds.has(entity.id) ? `/customers/${entity.id}` : null,
        },
      ];
    });
    const graphEdges = graphRelations.map((relation) => {
      const source = allEvidence.find((item) => item.relationId === relation.id);
      const doc = source ? docsById.get(source.sourceDocumentId) : null;
      return {
        id: relation.id,
        from: relation.fromEntityId,
        to: relation.toEntityId,
        label: relation.label,
        confidence: relation.confidence,
        status: relation.status,
        sourceLabel: doc?.title ?? "根拠記録",
      };
    });
    return {
      customer: {
        id: profile.entityId,
        name: customer.canonicalName,
        company: byId.get(profile.companyEntityId)?.canonicalName ?? "",
        role: profile.roleLabel,
        imageUrl: profile.imageUrl,
        catchphrase: profile.catchphrase,
        nextContactAt: profile.nextContactAt,
        accent: profile.accent,
        ownerName: byId.get(profile.ownerEntityId)?.canonicalName ?? "",
        salesProfile,
      },
      panels: panels.map((panel) => ({
        ...panel,
        items: items.filter((item) => item.panelId === panel.id),
      })),
      evidence,
      graph: { nodes: graphNodes, edges: graphEdges },
      moves,
    };
  });
}
