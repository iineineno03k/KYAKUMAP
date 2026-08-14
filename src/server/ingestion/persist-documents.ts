import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { withDb } from "@/db";
import { sourceDocuments } from "@/db/schema";
import type { IngestedDocument } from "./types";

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export async function persistDocuments(documents: IngestedDocument[]) {
  let imported = 0;
  let updated = 0;
  let unchanged = 0;
  for (const document of documents) {
    const contentHash = hash(document.rawText);
    await withDb(async (db) => {
      const [existing] = await db
        .select()
        .from(sourceDocuments)
        .where(
          and(
            eq(sourceDocuments.sourceType, document.sourceType),
            eq(sourceDocuments.externalId, document.externalId),
          ),
        );
      if (existing?.contentHash === contentHash) {
        unchanged += 1;
        return;
      }
      const values = { ...document, contentHash, ingestedAt: new Date() };
      if (existing) {
        await db.update(sourceDocuments).set(values).where(eq(sourceDocuments.id, existing.id));
        updated += 1;
      } else {
        await db.insert(sourceDocuments).values({ id: `source-${crypto.randomUUID()}`, ...values });
        imported += 1;
      }
    });
  }
  return { imported, updated, unchanged, syncedAt: new Date().toISOString() };
}
