/**
 * 実測ログを読む。
 *
 *   npm run logs           直近20件
 *   npm run logs -- 50     直近50件
 *   npm run logs -- --raw  生のJSONL（そのまま貼れる）
 *   npm run logs -- --clear 消す
 *
 * app/.logs/turns.jsonl は、実際にアプリを使ったときの記録がすべて入っている。
 * これを読めば、同じことをもう一度測り直さずに原因を追える。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { dim, ng, ROOT } from "./lib.mts";

const FILE = resolve(ROOT, ".logs/turns.jsonl");
const argv = process.argv.slice(2);

if (!existsSync(FILE)) {
  ng(`まだログがありません: ${FILE}`);
  dim("  npm run dev でアプリを動かして、1ターン喋ると記録されます。");
  process.exit(0);
}

if (argv.includes("--clear")) {
  writeFileSync(FILE, "");
  console.log("消しました。");
  process.exit(0);
}

type Rec = {
  at: string;
  kind: string;
  ms?: number;
  model?: string;
  resolvedModel?: string | null;
  thinkingTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  input?: string;
  output?: string;
  audioBytes?: number;
  status?: number;
  error?: string;
  stages?: Record<string, number>;
  sessionId?: string;
  note?: string;
};

const all = readFileSync(FILE, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((l) => {
    try {
      return JSON.parse(l) as Rec;
    } catch {
      return null;
    }
  })
  .filter((r): r is Rec => r !== null);

const n = Number(argv.find((a) => /^\d+$/.test(a)) ?? 20);
const recent = all.slice(-n);

if (argv.includes("--raw")) {
  for (const r of recent) console.log(JSON.stringify(r));
  process.exit(0);
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("ja-JP", { hour12: false });
const ms = (v?: number) => (v === undefined ? "" : `${v}ms`.padStart(8));
const KIND: Record<string, string> = {
  transcribe: "文字起こし",
  chat: "顧客AI    ",
  speech: "音声合成  ",
  coach: "タイム    ",
  reflect: "振り返り  ",
  persona: "ペルソナ  ",
  turn: "★1ターン  ",
  error: "✗エラー   ",
};

for (const r of recent) {
  const slow = (r.ms ?? 0) > 3000;
  const head = `${time(r.at)} ${KIND[r.kind] ?? r.kind} ${ms(r.ms)}`;
  console.log(slow || r.error ? `\x1b[31m${head}\x1b[0m` : head);

  const bits: string[] = [];
  if (r.model)
    bits.push(
      r.resolvedModel && r.resolvedModel !== r.model ? `${r.model}→${r.resolvedModel}` : r.model,
    );
  if (r.thinkingTokens) bits.push(`\x1b[33mthinking ${r.thinkingTokens}トークン\x1b[0m`);
  if (r.promptTokens !== undefined) bits.push(`in ${r.promptTokens}/out ${r.completionTokens}`);
  if (r.audioBytes) bits.push(`音声 ${Math.round(r.audioBytes / 1024)}KB`);
  if (r.note) bits.push(r.note);
  if (bits.length) dim(`    ${bits.join("  ")}`);

  if (r.stages) {
    const s = Object.entries(r.stages)
      .map(([k, v]) => `${k} ${v}ms`)
      .join(" | ");
    dim(`    ${s}`);
  }
  if (r.input) dim(`    入力: ${r.input}`);
  if (r.output) dim(`    出力: ${r.output}`);
  if (r.error) console.log(`    \x1b[31m${r.status ?? ""} ${r.error}\x1b[0m`);
}

// まとめ
const turns = all.filter((r) => r.kind === "turn" && r.ms);
if (turns.length) {
  const sorted = turns.map((t) => t.ms as number).sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  console.log();
  console.log(
    `1ターンの合計: ${turns.length}件  中央値 ${med}ms  最速 ${sorted[0]}ms  最遅 ${sorted.at(-1)}ms`,
  );
}
const thinking = all.filter((r) => (r.thinkingTokens ?? 0) > 0);
if (thinking.length) {
  console.log(
    `\x1b[33mthinking がまだ走っている呼び出しが ${thinking.length}件あります\x1b[0m（${[...new Set(thinking.map((r) => r.model))].join(", ")}）`,
  );
}
const errors = all.filter((r) => r.error);
if (errors.length) console.log(`\x1b[31mエラー ${errors.length}件\x1b[0m`);
