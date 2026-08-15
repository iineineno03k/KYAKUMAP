import "../src/db/load-env";

function option(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const rawLimit = option("--limit") ?? "1";
const limit = Number.parseInt(rawLimit, 10);
if (!Number.isInteger(limit) || limit < 1) {
  throw new Error("--limit には1以上の整数を指定してください");
}

const { syncNotionKnowledge } = await import("../src/server/ingestion/sync-notion");

try {
  const result = await syncNotionKnowledge({
    limit,
    force: process.argv.includes("--force"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.candidates > result.selected) {
    process.stdout.write(
      `未処理の更新候補が${result.candidates - result.selected}件あります。再実行してください。\n`,
    );
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.stderr.write("原文保存後に失敗した場合は --force を付けて再実行してください。\n");
  process.exitCode = 1;
}
