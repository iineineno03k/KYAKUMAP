import { MODELS, orcaFetch } from "@/lib/orca";
import { clip, logTurn } from "@/lib/telemetry";

export const runtime = "nodejs";
export const maxDuration = 60;

const TIMEOUT_MS = 15_000;
const VOICES = new Set(["cedar", "onyx", "marin"]);
const DELIVERY_INSTRUCTIONS = {
  measured: "落ち着いた責任者として、結論を急がず自然な間を置いてください。",
  practical: "飾らず実務的に、親しみは保ちながら簡潔に話してください。",
  technical: "慎重で技術的に、条件を確かめるように区切って話してください。",
} as const;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    text?: unknown;
    voice?: unknown;
    delivery?: unknown;
  } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const voice = typeof body?.voice === "string" && VOICES.has(body.voice) ? body.voice : "cedar";
  const delivery =
    typeof body?.delivery === "string" && body.delivery in DELIVERY_INSTRUCTIONS
      ? (body.delivery as keyof typeof DELIVERY_INSTRUCTIONS)
      : "measured";
  if (!text) return Response.json({ error: "読み上げる文章がありません" }, { status: 400 });
  if (text.length > 500) {
    return Response.json({ error: "読み上げる文章が長すぎます" }, { status: 400 });
  }
  if (MODELS.tts === "browser") {
    return Response.json(
      { error: "ブラウザの音声合成を使用してください", fallback: "browser" },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await orcaFetch("/audio/speech", {
      method: "POST",
      body: JSON.stringify({
        model: MODELS.tts,
        input: text,
        voice,
        instructions: `日本語の自然な対話として読み上げてください。${DELIVERY_INSTRUCTIONS[delivery]}`,
        response_format: "mp3",
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      await logTurn({
        kind: "speech",
        ms: Date.now() - startedAt,
        model: MODELS.tts,
        input: clip(text, 120),
        status: response.status,
        error: clip(detail, 300),
      });
      return Response.json({ error: "音声を作れませんでした" }, { status: 502 });
    }
    const audio = await response.arrayBuffer();
    await logTurn({
      kind: "speech",
      ms: Date.now() - startedAt,
      model: MODELS.tts,
      input: clip(text, 120),
      audioBytes: audio.byteLength,
      note: `${voice} / ${delivery} / ${text.length}字`,
    });
    return new Response(audio, {
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    await logTurn({
      kind: "speech",
      ms: Date.now() - startedAt,
      model: MODELS.tts,
      input: clip(text, 120),
      status: timedOut ? 504 : 502,
      error: timedOut ? `タイムアウト（${TIMEOUT_MS}ms）` : clip(String(error), 300),
    });
    return Response.json(
      { error: timedOut ? "音声生成に時間がかかっています" : "音声を作れませんでした" },
      { status: timedOut ? 504 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
