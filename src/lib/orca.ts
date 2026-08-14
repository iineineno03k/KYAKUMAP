import { createOpenAI } from "@ai-sdk/openai";

function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

/**
 * OrcaRouter への接続。OpenRouter ではない。
 * APIキーはサーバー側でのみ参照する。NEXT_PUBLIC_ を付けてはいけない。
 */
export const ORCA_BASE_URL = env("ORCAROUTER_BASE_URL") ?? "https://api.orcarouter.ai/v1";

export function orcaApiKey(): string {
  const key = env("ORCAROUTER_API_KEY");
  if (!key) {
    throw new Error("ORCAROUTER_API_KEY が設定されていません。app/.env.local に設定してください。");
  }
  return key;
}

/** Vercel AI SDK 用。streamText / generateText はこれ経由。 */
export const orca = createOpenAI({
  baseURL: ORCA_BASE_URL,
  apiKey: env("ORCAROUTER_API_KEY") ?? "",
});

export const MODELS = {
  /** 原文からエンティティ・事実・関係候補を一度で抽出する。 */
  knowledge: env("ORCAROUTER_KNOWLEDGE_MODEL") ?? "anthropic/claude-haiku-4.5",
  /** 根拠付き知識を、顧客本人らしい一人称へ変換する。 */
  customerChat:
    env("ORCAROUTER_CUSTOMER_CHAT_MODEL") ??
    env("ORCAROUTER_KNOWLEDGE_MODEL") ??
    "anthropic/claude-haiku-4.5",
  /** 顧客AIの返答を人物ごとの声で読み上げる。 */
  tts: env("ORCAROUTER_TTS_MODEL") ?? "openai/gpt-4o-mini-tts",
} as const;

/** OrcaRouter が返すルーティング由来のレスポンスヘッダー。 */
export const ORCA_HEADERS = [
  "x-orca-resolved-model",
  "x-orca-router",
  "x-orca-fallback-model",
  "x-orca-fallback-level",
] as const;

export function readOrcaHeaders(h: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of ORCA_HEADERS) {
    const v = h.get(name);
    if (v) out[name] = v;
  }
  return out;
}

/** 素の fetch で OrcaRouter を叩く（TTS・音声入力など AI SDK を通さないもの）。 */
export async function orcaFetch(
  path: string,
  init: RequestInit & { body?: BodyInit },
): Promise<Response> {
  return fetch(`${ORCA_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${orcaApiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}
