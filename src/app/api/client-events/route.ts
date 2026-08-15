import { clip, logTurn } from "@/lib/telemetry";

const EVENTS = new Set(["audio_playback_failed"]);
const PHASES = new Set(["autoplay", "manual", "decode"]);

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    event?: unknown;
    phase?: unknown;
    reason?: unknown;
    customerId?: unknown;
    sessionId?: unknown;
  } | null;
  const event = typeof body?.event === "string" && EVENTS.has(body.event) ? body.event : null;
  const phase = typeof body?.phase === "string" && PHASES.has(body.phase) ? body.phase : null;
  if (!event || !phase) {
    return Response.json({ error: "記録できないイベントです" }, { status: 400 });
  }

  const customerId = typeof body?.customerId === "string" ? clip(body.customerId, 80) : undefined;
  const sessionId = typeof body?.sessionId === "string" ? clip(body.sessionId, 120) : undefined;
  const reason = typeof body?.reason === "string" ? clip(body.reason, 240) : undefined;
  await logTurn({
    kind: "error",
    input: event,
    error: reason,
    sessionId,
    note: `${phase}${customerId ? ` / customer:${customerId}` : ""}`,
  });
  return new Response(null, { status: 204 });
}
