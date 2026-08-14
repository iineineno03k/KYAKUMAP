import "./load-env";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDb } from "./index";

async function main() {
  const db = createDb();
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    process.stdout.write("migrationを適用しました。\n");
  } finally {
    await db.$client.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
