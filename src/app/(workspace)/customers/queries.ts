import { asc, eq } from "drizzle-orm";
import { withDb } from "@/db";
import {
  customerPanelItems,
  customerPanels,
  customerProfiles,
  knowledgeEntities,
  knowledgeRelations,
  nextMoves,
  panelDefinitions,
  panelItemDefinitions,
} from "@/db/schema";
export async function getCustomerCards() {
  return withDb(async (db) => {
    const [profiles, entities, panels, items, relations, moves] = await Promise.all([
      db.select().from(customerProfiles).orderBy(asc(customerProfiles.nextContactAt)),
      db.select().from(knowledgeEntities),
      db
        .select({
          id: customerPanels.id,
          customerId: customerPanels.customerEntityId,
          status: customerPanels.status,
          sortOrder: panelDefinitions.sortOrder,
        })
        .from(customerPanels)
        .innerJoin(panelDefinitions, eq(customerPanels.definitionId, panelDefinitions.id)),
      db
        .select({
          customerPanelId: customerPanelItems.customerPanelId,
          status: customerPanelItems.status,
          label: panelItemDefinitions.label,
        })
        .from(customerPanelItems)
        .innerJoin(
          panelItemDefinitions,
          eq(customerPanelItems.itemDefinitionId, panelItemDefinitions.id),
        ),
      db.select().from(knowledgeRelations),
      db.select().from(nextMoves).orderBy(asc(nextMoves.sortOrder)),
    ]);
    const byId = new Map(entities.map((entity) => [entity.id, entity]));
    return profiles.map((profile) => {
      const customer = byId.get(profile.entityId);
      const company = byId.get(profile.companyEntityId);
      const customerPanelRows = panels.filter((panel) => panel.customerId === profile.entityId);
      const panelIds = new Set(customerPanelRows.map((panel) => panel.id));
      const customerItems = items.filter((item) => panelIds.has(item.customerPanelId));
      const customerMoves = moves.filter(
        (move) => move.customerEntityId === profile.entityId && move.status === "open",
      );
      const firstMissingItem = customerItems.find((item) => item.status === "missing");
      const relation = relations.find(
        (item) => item.fromEntityId === profile.entityId || item.toEntityId === profile.entityId,
      );
      const counterpartId = relation
        ? relation.fromEntityId === profile.entityId
          ? relation.toEntityId
          : relation.fromEntityId
        : null;
      const counterpart = counterpartId ? byId.get(counterpartId) : null;
      return {
        id: profile.entityId,
        name: customer?.canonicalName ?? "名称未設定",
        company: company?.canonicalName ?? "",
        role: profile.roleLabel,
        imageUrl: profile.imageUrl,
        nextContactAt: profile.nextContactAt,
        accent: profile.accent,
        checkCount: customerMoves.length || (firstMissingItem ? 1 : 0),
        firstCheck: customerMoves[0]?.label ?? firstMissingItem?.label ?? null,
        ready: customerPanelRows.some((panel) => panel.status === "ready"),
        discovery:
          relation && counterpart
            ? `${counterpart.canonicalName}さんと「${relation.label}」`
            : null,
      };
    });
  });
}
