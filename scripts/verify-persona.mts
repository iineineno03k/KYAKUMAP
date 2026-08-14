/**
 * 山場の検証: 顧客AIが最後まで客として振る舞えるか。
 *
 *   npm run verify:persona                 # C-04 に対して「雑なプレイ」を流す
 *   npm run verify:persona -- C-01 careful # 案件とプレイの型を指定
 *   npm run verify:persona -- C-04 rough --turns 12 --save
 *
 * docs/prompts.md「顧客AIが客として振る舞わないときのチェックリスト」を機械判定する。
 * ここが通らないと製品が成立しないので、画面より先にこれを通す。
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { p2Customer } from "../src/lib/prompts.ts";
import type { Persona } from "../src/lib/types.ts";
import { type ChatMessage, chat, dim, ng, ok, ROOT, usageSoFar, writeGenerated } from "./lib.mts";

const argv = process.argv.slice(2);
const caseId = argv.find((a) => /^C-\d+$/.test(a)) ?? "C-04";
const style = argv.includes("careful") ? "careful" : "rough";
const turnsIdx = argv.indexOf("--turns");
const TURNS = turnsIdx >= 0 ? Number(argv[turnsIdx + 1]) : 10;
const save = argv.includes("--save");

const chatModel = process.env.ORCAROUTER_CHAT_MODEL ?? "openai/gpt-4o-mini";

const personasPath = resolve(ROOT, "src/data/generated/personas.json");
let persona: Persona;
try {
  persona = JSON.parse(readFileSync(personasPath, "utf8")).items[caseId];
  if (!persona) throw new Error(`${caseId} のペルソナが無い`);
} catch (e) {
  ng(`ペルソナを読めません: ${(e as Error).message}`);
  dim("  先に `npm run build:personas` を実行してください。");
  process.exit(1);
}

/**
 * 営業役。ここは検証用の固定台本ではなくLLMに演じさせる。
 * rough  = 企画書のデモ台本どおり「3分で価格を出す」雑なプレイ
 * careful = 型に沿ったプレイ（牛舎に入る・価格を出さない・後継者に会う）
 */
const REP_SYSTEM =
  style === "rough"
    ? `あなたは畜産飼料の直販営業の新人です。焦っており、早く商品と価格の話に持ち込もうとします。
現場（牛舎）を見せてほしいとは言いません。相手の課題を聞く前に、商品名・価格・値引きを出します。
1回の発言は1〜2文。営業担当者としての発言だけを書き、ト書きや説明を付けないでください。`
    : `あなたは畜産飼料の直販営業のベテランです。
初回は牛舎に入れてもらい、いまの飼養と給与設計を聞くことに徹します。商品名も価格も自分からは出しません。
相手が課題を口にするまで待ち、飼料以外の困りごとにも乗ります。決裁者だけでなく現場の人と話します。
1回の発言は1〜2文。営業担当者としての発言だけを書き、ト書きや説明を付けないでください。`;

console.log(`検証: ${caseId} / ${persona.label}`);
console.log(`  営業役: ${style}   顧客AI: ${chatModel}   ${TURNS}往復\n`);

const history: { role: "user" | "customer"; text: string }[] = [];
const latencies: number[] = [];

for (let i = 0; i < TURNS; i++) {
  // ── 営業役の発言 ──
  const repMessages: ChatMessage[] = [
    { role: "system", content: REP_SYSTEM },
    ...history.map((h) => ({
      role: (h.role === "user" ? "assistant" : "user") as "assistant" | "user",
      content: h.text,
    })),
  ];
  if (history.length === 0) {
    repMessages.push({ role: "user", content: "（訪問した。最初の一言を言ってください）" });
  }
  const rep = await chat(chatModel, repMessages, { temperature: 0.9, maxTokens: 120 });
  const repText = rep.text.trim();
  history.push({ role: "user", text: repText });
  console.log(`\x1b[36m営業\x1b[0m ${repText}`);

  // ── 顧客AIの応答（本番と同じ経路: P2 + 直近12往復）──
  const custMessages: ChatMessage[] = [
    { role: "system", content: p2Customer(persona) },
    ...history.slice(-12).map((h) => ({
      role: (h.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: h.text,
    })),
  ];
  const cust = await chat(chatModel, custMessages, { temperature: 0.8, maxTokens: 220 });
  const custText = cust.text.trim();
  latencies.push(cust.ms);
  history.push({ role: "customer", text: custText });
  console.log(`\x1b[33m顧客\x1b[0m ${custText}  \x1b[2m(${cust.ms}ms)\x1b[0m\n`);
}

/* ── 判定 ───────────────────────────────────────────────────── */
console.log("─".repeat(70));
console.log("判定（docs/prompts.md「顧客AIが客として振る舞わないときのチェックリスト」）\n");

const customerLines = history.filter((h) => h.role === "customer").map((h) => h.text);
const joined = customerLines.join("\n");
let failures = 0;
const check = (label: string, bad: boolean, detail: string) => {
  if (bad) {
    ng(`${label} — ${detail}`);
    failures++;
  } else {
    ok(label);
  }
};

// 1. すぐ買う
const buySignals = /(購入|導入し(ます|たい)|契約|買います|お願いします、?それで|発注)/;
const bought = customerLines.filter((l) => buySignals.test(l));
check(
  "すぐ買わない",
  style === "rough" && bought.length > 0,
  `雑なプレイなのに購入寄りの発言: ${bought.slice(0, 2).join(" / ")}`,
);

// 2. 説教・褒め（客が先生になる）
const coachSignals =
  /(良い質問|いい質問|大事です|重要です|〜すべき|べきです|аdvice|アドバイス|おっしゃると?おり素晴らし|勉強になり)/;
const coached = customerLines.filter((l) => coachSignals.test(l));
check(
  "助言・評価をしない",
  coached.length > 0,
  `助言らしき発言: ${coached.slice(0, 2).join(" / ")}`,
);

// 3. メタ発言
const metaSignals = /(AI|人工知能|ロールプレイ|シミュレーション|私はモデル|アシスタント)/;
const meta = customerLines.filter((l) => metaSignals.test(l));
check("メタ発言をしない", meta.length > 0, meta.slice(0, 2).join(" / "));

// 3b. 客が正解を教えていないか（opening を自分から要求する = 先生になっている）
const teachSignals =
  /(見てもら(え|い)|見に来て|入って(み|もら)|聞いてもら|理解してもら|してほしい|していただけ|してください|してもらえ)/;
const teaching = customerLines.filter((l) => teachSignals.test(l));
check(
  "正解を教えない（opening を自分から要求しない）",
  teaching.length > customerLines.length * 0.25,
  `客の側から要求している発言が ${teaching.length}/${customerLines.length} 件: ${teaching.slice(0, 2).join(" / ")}`,
);

// 4. 短さ（2〜3文）
const longLines = customerLines.filter((l) => l.replace(/\s/g, "").length > 140);
check(
  "2〜3文に収まっている",
  longLines.length > customerLines.length * 0.3,
  `140字超が ${longLines.length}/${customerLines.length} 件`,
);

// 5. 業界用語（一般的な「難しい客」になっていないか）
const vocab = persona.vocabulary ?? [];
const usedVocab = vocab.filter((v) => joined.includes(v));
check(
  "この客の業界用語を使っている",
  vocab.length > 0 && usedVocab.length === 0,
  `vocabulary ${JSON.stringify(vocab)} が一度も出ていない`,
);
if (vocab.length === 0)
  dim("   （このペルソナには vocabulary が無い。P1の入力の情報量が足りていない）");
else dim(`   使われた語: ${usedVocab.join(", ") || "（なし）"}`);

// 6. resistance が効いているか
const triggers = (persona.resistance ?? []).map((r) => r.trigger);
check("resistance が定義されている", triggers.length === 0, "空。この客は落ちにくくない");

// 7. レイテンシ（商談として成立するか）
const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
const p95 = latencies.slice().sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] ?? avg;
check("往復2秒以内", avg > 2000, `平均 ${avg}ms / p95 ${p95}ms`);
dim(`   平均 ${avg}ms  最遅 ${Math.max(...latencies)}ms`);

// 8. 開き具合。rough と careful でここが変わらないと、巻き戻す意味が無い。
const refusal = /(検討し|結構です|他も|他社|忙しい|またの機会|今は.*ない|お断り|遠慮)/;
const refusals = customerLines.filter((l) => refusal.test(l)).length;
const opennessPct = Math.round(((customerLines.length - refusals) / customerLines.length) * 100);
console.log();
dim(
  `開き具合: ${opennessPct}%  （断り文句なしの応答 ${customerLines.length - refusals}/${customerLines.length}）`,
);
dim(`  rough と careful で この数字が動かないなら、巻き戻して別の入り方を試す意味が無い。`);

console.log();
const u = usageSoFar();
dim(`usage: ${JSON.stringify(u)}  （営業役の生成も含む。本番は顧客AI側のみ）`);

if (save) {
  const transcript = history
    .map((h) => `${h.role === "user" ? "営業" : "顧客"}: ${h.text}`)
    .join("\n");
  const out = writeGenerated(`verify-${caseId}-${style}`, chatModel, transcript);
  dim(`ログ: ${out}`);
}

console.log();
if (failures === 0) {
  ok(`すべて通過。顧客AIは客として振る舞えている（${caseId} / ${style}）`);
} else {
  ng(`${failures}件が不合格。プロンプトかペルソナかモデルを直してから画面へ進むこと。`);
  process.exit(1);
}
