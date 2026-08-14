import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * 1ターンで起きたことを、全部ファイルに残す。
 *
 * ブラウザのコンソールに出すだけだと、実際に使った人の結果を後から誰も読めない。
 * 読めないと、同じことをもう一度やって測り直すことになり、時間もAPI課金も二重にかかる。
 * だからサーバー側の追記ファイルを唯一の記録場所にする。
 *
 * 出力先: app/.logs/turns.jsonl（gitignore 済み）
 * 読み方: npm run logs
 */

const LOG_DIR = resolve(process.cwd(), ".logs");
const LOG_FILE = resolve(LOG_DIR, "turns.jsonl");

export type TelemetryRecord = {
  at: string;
  kind:
    | "transcribe"
    | "chat"
    | "speech"
    | "coach"
    | "reflect"
    | "persona"
    | "report"
    | "knowledge"
    | "turn"
    | "error";
  ms?: number;
  model?: string;
  resolvedModel?: string | null;
  /** Gemini の思考トークン。0 でないなら thinking が走っている。 */
  thinkingTokens?: number;
  promptTokens?: number;
  completionTokens?: number;
  /** 入出力の実物。何を言って何が返ったかが分からないと原因が特定できない。 */
  input?: string;
  output?: string;
  /** 音声の実サイズと長さ。遅延が長さに比例するかを後から確認するため。 */
  audioBytes?: number;
  audioSeconds?: number;
  status?: number;
  error?: string;
  /** クライアント側で測った工程ごとの内訳。 */
  stages?: Record<string, number>;
  sessionId?: string;
  note?: string;
};

let ready: Promise<void> | null = null;

async function ensureDir(): Promise<void> {
  if (!ready) ready = mkdir(LOG_DIR, { recursive: true }).then(() => undefined);
  return ready;
}

/** 記録に失敗してもアプリは落とさない。ログのために機能を止める理由がない。 */
export async function logTurn(record: Omit<TelemetryRecord, "at">): Promise<void> {
  try {
    await ensureDir();
    const line = JSON.stringify({ at: new Date().toISOString(), ...record });
    await appendFile(LOG_FILE, `${line}\n`, "utf8");
  } catch {
    // 握りつぶす
  }
}

/** 長い本文はそのままだと読みにくいので、頭を残して切る。 */
export function clip(s: string | undefined | null, n = 400): string | undefined {
  if (!s) return undefined;
  return s.length > n ? `${s.slice(0, n)}…（${s.length}字）` : s;
}

export const TELEMETRY_PATH = LOG_FILE;
