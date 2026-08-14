/**
 * スクリプト共通。OrcaRouter を素の fetch で叩く。
 * src/lib/prompts.ts を直接 import することで、プロンプトの二重管理を避ける。
 * （Node 24 は .ts を直接実行できる）
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function loadEnv(): void {
  for (const f of [".env.local", ".env"]) {
    const p = resolve(ROOT, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

export const BASE = process.env.ORCAROUTER_BASE_URL ?? "https://api.orcarouter.ai/v1";

export function apiKey(): string {
  const k = process.env.ORCAROUTER_API_KEY;
  if (!k) {
    console.error("✗ ORCAROUTER_API_KEY が無い。`npm run setup` を実行してください。");
    process.exit(1);
  }
  return k;
}

export type Usage = { prompt_tokens: number; completion_tokens: number; total_tokens: number };

let totalUsage: Usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
export function usageSoFar(): Usage {
  return { ...totalUsage };
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function chat(
  model: string,
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number; json?: boolean } = {},
): Promise<{ text: string; usage: Usage; resolvedModel: string | null; ms: number }> {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.7,
      ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const j = await res.json();
  const usage: Usage = j.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  totalUsage = {
    prompt_tokens: totalUsage.prompt_tokens + (usage.prompt_tokens ?? 0),
    completion_tokens: totalUsage.completion_tokens + (usage.completion_tokens ?? 0),
    total_tokens: totalUsage.total_tokens + (usage.total_tokens ?? 0),
  };
  return {
    text: j.choices?.[0]?.message?.content ?? "",
    usage,
    resolvedModel: res.headers.get("x-orca-resolved-model"),
    ms: Date.now() - t0,
  };
}

/** モデルが ```json ... ``` で包んでくることがあるので剥がす。 */
export function parseJson<T>(text: string): T {
  let s = text.trim();
  const fence = s.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (fence) s = fence[1].trim();
  // 前後に説明が付いた場合の救済
  if (!s.startsWith("{") && !s.startsWith("[")) {
    const i = s.search(/[{[]/);
    const j = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    if (i >= 0 && j > i) s = s.slice(i, j + 1);
  }
  return JSON.parse(s) as T;
}

export function readCases() {
  const p = resolve(ROOT, "src/data/cases.json");
  return JSON.parse(readFileSync(p, "utf8")).cases;
}

export function writeGenerated(name: string, model: string, items: unknown): string {
  const dir = resolve(ROOT, "src/data/generated");
  mkdirSync(dir, { recursive: true });
  const out = resolve(dir, `${name}.json`);
  writeFileSync(
    out,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), model, items }, null, 2)}\n`,
  );
  return out;
}

export const ok = (s: string) => console.log(`\x1b[32m✓\x1b[0m ${s}`);
export const ng = (s: string) => console.log(`\x1b[31m✗\x1b[0m ${s}`);
export const dim = (s: string) => console.log(`\x1b[2m${s}\x1b[0m`);
