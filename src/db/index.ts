import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL が未設定です。app/.env.example を参照してPostgreSQLの接続文字列を設定してください。",
    );
  }
  return url;
}

export function createDb(url = databaseUrl()) {
  const client = postgres(url, { max: 1, prepare: false });
  return drizzle({ client, schema });
}

export type Database = ReturnType<typeof createDb>;

/** Server Component / Actionの短い処理で接続を確実に解放する。 */
export async function withDb<T>(run: (db: Database) => Promise<T>): Promise<T> {
  const db = createDb();
  try {
    return await run(db);
  } finally {
    await db.$client.end();
  }
}
