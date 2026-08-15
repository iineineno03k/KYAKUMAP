import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { withDb } from "@/db";
import { sourceDocuments } from "@/db/schema";
import type { IngestedDocument } from "./types";

export function documentContentHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export type PersistedDocument = {
  id: string;
  title: string;
  status: "imported" | "updated" | "unchanged";
};

export async function persistDocuments(documents: IngestedDocument[]) {
  let imported = 0;
  let updated = 0;
  let unchanged = 0;
  const persisted: PersistedDocument[] = [];
  for (const document of documents) {
    const contentHash = documentContentHash(document.rawText);
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
        persisted.push({ id: existing.id, title: document.title, status: "unchanged" });
        return;
      }
      const values = { ...document, contentHash, ingestedAt: new Date() };
      if (existing) {
        await db.update(sourceDocuments).set(values).where(eq(sourceDocuments.id, existing.id));
        updated += 1;
        persisted.push({ id: existing.id, title: document.title, status: "updated" });
      } else {
        const id = `source-${crypto.randomUUID()}`;
        await db.insert(sourceDocuments).values({ id, ...values });
        imported += 1;
        persisted.push({ id, title: document.title, status: "imported" });
      }
    });
  }
  return { imported, updated, unchanged, persisted, syncedAt: new Date().toISOString() };
}
