import fs from "node:fs";
import path from "node:path";

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadEnvFile(path.resolve(".env.local"));

const baseUrl = process.env.ORCAROUTER_BASE_URL || "https://api.orcarouter.ai/v1";
const model = process.env.ORCAROUTER_CUSTOMER_CHAT_MODEL || "deepseek/deepseek-v4-flash-free";
const apiKey = process.env.ORCAROUTER_API_KEY;

if (!apiKey) {
  console.error("NG: ORCAROUTER_API_KEY が設定されていません");
  process.exit(1);
}

const catalogResponse = await fetch(`${baseUrl}/models`);
const catalog = await catalogResponse.json();
const selected = catalog.data?.find((item) => item.id === model);
if (!selected) {
  console.error(`NG: 現在のモデル一覧に ${model} がありません`);
  process.exit(1);
}
if (selected.pricing?.request !== "0.000000") {
  console.error(`NG: ${model} は無料requestモデルとして確認できません`);
  process.exit(1);
}

const response = await fetch(`${baseUrl}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    max_tokens: 80,
    messages: [
      {
        role: "user",
        content:
          'JSONだけを返してください。形式は {"status":"known","answer":"動作確認OK","evidenceIds":[],"suggestedEntityIds":[]} です。',
      },
    ],
    response_format: { type: "json_object" },
  }),
});
const body = await response.json().catch(() => null);
if (!response.ok) {
  const reason = body?.error?.metadata?.reason || body?.error?.code || "unknown";
  console.error(`NG: HTTP ${response.status} / ${reason}`);
  if (reason === "err_free_access_denied") {
    console.error(
      "OrcaRouterのプロフィールで、一定期間利用しているGitHubアカウントを連携してください。",
    );
  } else if (reason === "err_free_prompt_cap") {
    console.error("無料枠のprompt上限を超えています。入力を短くしてください。");
  } else if (reason === "err_free_rate") {
    console.error("無料枠のrate limitです。時間を置いて1回だけ再試行してください。");
  }
  process.exit(1);
}

const text = body?.choices?.[0]?.message?.content;
if (!text) {
  console.error("NG: 応答本文がありません");
  process.exit(1);
}
console.log(`OK: ${model}`);
console.log(text);
