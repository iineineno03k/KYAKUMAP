import "./load-env";
import { count, eq, inArray } from "drizzle-orm";
import { createDb } from "./index";
import {
  customerPanelItems,
  customerPanels,
  knowledgeEntities,
  knowledgeRelations,
  sourceDocuments,
} from "./schema";

async function main() {
  const db = createDb();
  try {
    const [customer] = await db
      .select()
      .from(knowledgeEntities)
      .where(eq(knowledgeEntities.id, "person-sato"));
    const customerPanelRows = await db
      .select({ id: customerPanels.id })
      .from(customerPanels)
      .where(eq(customerPanels.customerEntityId, "person-sato"));
    const [[panels], [items], [docs], [relations]] = await Promise.all([
      db
        .select({ count: count() })
        .from(customerPanels)
        .where(eq(customerPanels.customerEntityId, "person-sato")),
      db
        .select({ count: count() })
        .from(customerPanelItems)
        .where(
          inArray(
            customerPanelItems.customerPanelId,
            customerPanelRows.map((panel) => panel.id),
          ),
        ),
      db.select({ count: count() }).from(sourceDocuments),
      db.select({ count: count() }).from(knowledgeRelations),
    ]);
    if (
      !customer ||
      panels.count !== 5 ||
      items.count !== 25 ||
      docs.count < 3 ||
      relations.count < 2
    )
      throw new Error("顧客情報マップseedの検証に失敗しました。");
    process.stdout.write(
      `${JSON.stringify({
        customer: customer.canonicalName,
        panels: panels.count,
        panelItems: items.count,
        documents: docs.count,
        relations: relations.count,
      })}\nseed検証OK\n`,
    );
  } finally {
    await db.$client.end();
  }
}
main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
