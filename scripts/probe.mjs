#!/usr/bin/env node
/**
 * OrcaRouter 疎通スクリプト。
 * UI に組み込む前に、未確認の API 仕様を実レスポンスで確かめるためのもの。
 *
 *   node scripts/probe.mjs            # 全部
 *   node scripts/probe.mjs chat tts   # 個別
 *
 * キーは .env.local か環境変数 ORCAROUTER_API_KEY から読む。
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = resolve(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const BASE = process.env.ORCAROUTER_BASE_URL ?? "https://api.orcarouter.ai/v1";
const KEY = process.env.ORCAROUTER_API_KEY;
if (!KEY) {
  console.error("✗ ORCAROUTER_API_KEY が無い。app/.env.local に設定してください。");
  process.exit(1);
}

const M = {
  chat: process.env.ORCAROUTER_CHAT_MODEL ?? "openai/gpt-4o-mini",
  audio: process.env.ORCAROUTER_AUDIO_MODEL ?? "google/gemini-2.5-flash",
  tts: process.env.ORCAROUTER_TTS_MODEL ?? "openai/gpt-4o-mini-tts",
  voice: process.env.ORCAROUTER_TTS_VOICE ?? "alloy",
};

const H = { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const ORCA_HDRS = [
  "x-orca-resolved-model",
  "x-orca-router",
  "x-orca-fallback-model",
  "x-orca-fallback-level",
  "x-orca-cache",
];

function showHeaders(res) {
  const found = ORCA_HDRS.filter((h) => res.headers.get(h)).map(
    (h) => `${h}: ${res.headers.get(h)}`,
  );
  console.log("   headers:", found.length ? found.join(" | ") : "(x-orca-* なし)");
}

const ok = (s) => console.log(`\x1b[32m✓\x1b[0m ${s}`);
const ng = (s) => console.log(`\x1b[31m✗\x1b[0m ${s}`);

// ── 1. 非ストリーミング chat + usage ──────────────────────────────
async function probeChat() {
  console.log("\n── chat (non-stream) ──");
  const t0 = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      model: M.chat,
      messages: [{ role: "user", content: "「はい」とだけ返してください。" }],
      max_tokens: 20,
    }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) {
    ng(`${res.status} ${await res.text()}`);
    return;
  }
  const j = await res.json();
  ok(`${M.chat} → "${j.choices[0].message.content.trim()}" (${ms}ms)`);
  console.log("   usage:", JSON.stringify(j.usage));
  console.log("   model(body):", j.model);
  showHeaders(res);
}

// ── 2. ストリーミング + include_usage ─────────────────────────────
async function probeStream() {
  console.log("\n── chat (SSE stream + include_usage) ──");
  const t0 = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      model: M.chat,
      messages: [{ role: "user", content: "1から5まで数えてください。数字だけ。" }],
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: 60,
    }),
  });
  if (!res.ok) {
    ng(`${res.status} ${await res.text()}`);
    return;
  }
  showHeaders(res);
  let text = "";
  let usage = null;
  let firstTokenMs = null;
  let buf = "";
  for await (const chunk of res.body) {
    buf += Buffer.from(chunk).toString("utf8");
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;
      let ev;
      try {
        ev = JSON.parse(data);
      } catch {
        continue;
      }
      const d = ev.choices?.[0]?.delta?.content;
      if (d) {
        if (firstTokenMs === null) firstTokenMs = Date.now() - t0;
        text += d;
      }
      if (ev.usage) usage = ev.usage;
    }
  }
  ok(
    `stream → "${text.trim().replace(/\n/g, " ")}" (first token ${firstTokenMs}ms, total ${Date.now() - t0}ms)`,
  );
  if (usage) ok(`最終 usage が SSE に来た: ${JSON.stringify(usage)}`);
  else ng("SSE の最後に usage が来なかった → include_usage が効いていない");
}

// ── 3. TTS ───────────────────────────────────────────────────────
async function probeTts() {
  console.log("\n── TTS /v1/audio/speech ──");
  const t0 = Date.now();
  const res = await fetch(`${BASE}/audio/speech`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      model: M.tts,
      input: "どうも。今日はどういったご用件でしょうか。",
      voice: M.voice,
    }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) {
    ng(`${res.status} ${await res.text()}`);
    return null;
  }
  const ct = res.headers.get("content-type");
  const buf = Buffer.from(await res.arrayBuffer());
  const out = resolve(ROOT, "scripts/.probe-speech.mp3");
  writeFileSync(out, buf);
  ok(`${M.tts} / voice=${M.voice} → ${buf.length} bytes, Content-Type: ${ct} (${ms}ms)`);
  console.log(`   保存: ${out}`);
  showHeaders(res);
  return out;
}

// ── 4. 音声入力（TTSで作った音声を文字起こしさせる往復テスト）────
async function probeAudioIn(mp3Path) {
  console.log("\n── audio input (input_audio → 文字起こし) ──");
  const p = mp3Path ?? resolve(ROOT, "scripts/.probe-speech.mp3");
  if (!existsSync(p)) {
    ng("入力音声が無い。先に tts を通してください。");
    return;
  }
  const b64 = readFileSync(p).toString("base64");
  const t0 = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({
      model: M.audio,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "この音声は日本語の発話です。忠実に文字起こしし、説明を付けず本文だけ返してください。",
            },
            { type: "input_audio", input_audio: { data: b64, format: "mp3" } },
          ],
        },
      ],
    }),
  });
  const ms = Date.now() - t0;
  if (!res.ok) {
    ng(`${res.status} ${await res.text()}`);
    return;
  }
  const j = await res.json();
  ok(`${M.audio} → "${j.choices[0].message.content.trim()}" (${ms}ms)`);
  console.log("   usage:", JSON.stringify(j.usage));
  showHeaders(res);
}

// ── 5. 課金・残高（ワークスペース集計） ───────────────────────────
async function probeBilling() {
  console.log("\n── billing (ワークスペース集計) ──");
  for (const path of ["/dashboard/billing/usage", "/dashboard/billing/subscription"]) {
    const res = await fetch(`${BASE}${path}`, { headers: H });
    const body = await res.text();
    if (res.ok) ok(`${path} → ${body.slice(0, 300)}`);
    else ng(`${path} → ${res.status} ${body.slice(0, 200)}`);
  }
}

// ── 6. WAV / WebM が input_audio で通るか（ブラウザ録音形式の確認）──
async function probeAudioFormats() {
  console.log("\n── input_audio の format 受理テスト ──");
  const p = resolve(ROOT, "scripts/.probe-speech.mp3");
  if (!existsSync(p)) {
    ng("先に tts を通してください。");
    return;
  }
  const b64 = readFileSync(p).toString("base64");
  for (const format of ["mp3", "wav", "webm", "ogg", "m4a"]) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({
        model: M.audio,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "この音声に日本語の発話が含まれるか、はい/いいえで答えて。" },
              { type: "input_audio", input_audio: { data: b64, format } },
            ],
          },
        ],
        max_tokens: 10,
      }),
    });
    // 中身は mp3 のままなので、通る＝format 文字列が受理された、の確認だけ
    if (res.ok) ok(`format="${format}" → 200 (受理)`);
    else ng(`format="${format}" → ${res.status} ${(await res.text()).slice(0, 160)}`);
  }
}

const ALL = {
  chat: probeChat,
  stream: probeStream,
  tts: probeTts,
  audioin: probeAudioIn,
  billing: probeBilling,
  formats: probeAudioFormats,
};

const args = process.argv.slice(2);
const names = args.length ? args : ["chat", "stream", "tts", "audioin", "billing", "formats"];
console.log(`base: ${BASE}\nkey:  ${KEY.slice(0, 12)}…`);
let mp3 = null;
for (const n of names) {
  const fn = ALL[n];
  if (!fn) {
    ng(`unknown probe: ${n} (${Object.keys(ALL).join(", ")})`);
    continue;
  }
  try {
    const r = await fn(n === "audioin" ? mp3 : undefined);
    if (n === "tts") mp3 = r;
  } catch (e) {
    ng(`${n} threw: ${e.message}`);
  }
}
console.log();
