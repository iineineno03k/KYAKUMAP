import { z } from "zod";
import { MODELS, orcaFetch } from "@/lib/orca";
import { groundedCustomerReplyPrompt } from "@/lib/prompts";
import { clip, logTurn } from "@/lib/telemetry";
import { getCustomerAiContext } from "@/server/customer-ai/context";

export const runtime = "nodejs";
export const maxDuration = 60;

const requestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        text: z.string().trim().min(1).max(1000),
      }),
    )
    .min(1)
    .max(12),
  sessionId: z.string().trim().max(120).optional(),
});

const replySchema = z.object({
  status: z.enum(["known", "partial", "unknown"]),
  answer: z.string(),
  // OrcaRouterの構造化出力はJSON SchemaのmaxItemsを受け付けない。
  // 件数上限は生成後にsliceして守る。
  evidenceIds: z.array(z.string()),
  suggestedEntityIds: z.array(z.string()),
});

const customerAnswerTool = {
  type: "function",
  function: {
    name: "return_customer_answer",
    description: "根拠付き顧客AIの回答を確定する",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        status: { type: "string", enum: ["known", "partial", "unknown"] },
        answer: { type: "string" },
        evidenceIds: { type: "array", items: { type: "string" } },
        suggestedEntityIds: { type: "array", items: { type: "string" } },
      },
      required: ["status", "answer", "evidenceIds", "suggestedEntityIds"],
    },
  },
} as const;

const orcaResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        tool_calls: z.array(
          z.object({
            function: z.object({
              name: z.string(),
              arguments: z.string(),
            }),
          }),
        ),
      }),
    }),
  ),
  usage: z
    .object({
      prompt_tokens: z.number().optional(),
      completion_tokens: z.number().optional(),
    })
    .optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "質問内容を確認できませんでした" }, { status: 400 });
  }
  const { customerId } = await params;
  const context = await getCustomerAiContext(customerId, parsed.data.messages);
  if (!context) return Response.json({ error: "顧客が見つかりません" }, { status: 404 });

  const startedAt = Date.now();
  try {
    const response = await orcaFetch("/chat/completions", {
      method: "POST",
      headers: parsed.data.sessionId
        ? { "X-OrcaRouter-Session-Id": parsed.data.sessionId }
        : undefined,
      body: JSON.stringify({
        model: MODELS.customerChat,
        messages: [{ role: "user", content: groundedCustomerReplyPrompt(context.promptContext) }],
        tools: [customerAnswerTool],
        tool_choice: {
          type: "function",
          function: { name: customerAnswerTool.function.name },
        },
        temperature: 0.35,
      }),
    });
    const responseBody = await response.text();
    if (!response.ok) {
      throw new Error(`OrcaRouter ${response.status}: ${responseBody.slice(0, 500)}`);
    }
    const orcaResponse = orcaResponseSchema.parse(JSON.parse(responseBody));
    const toolCall = orcaResponse.choices[0]?.message.tool_calls.find(
      (item) => item.function.name === customerAnswerTool.function.name,
    );
    if (!toolCall) throw new Error("OrcaRouterが回答ツールを呼び出しませんでした");
    const result = replySchema.parse(JSON.parse(toolCall.function.arguments));
    const validEvidence = new Map(context.evidence.map((item) => [item.evidenceId, item]));
    const validHolders = new Map(context.informationHolders.map((item) => [item.entityId, item]));
    const selectedEvidence = [...new Set(result.evidenceIds)].slice(0, 5).flatMap((id) => {
      const item = validEvidence.get(id);
      return item ? [item] : [];
    });
    let selectedPeople = [...new Set(result.suggestedEntityIds)].slice(0, 4).flatMap((id) => {
      const item = validHolders.get(id);
      return item ? [item] : [];
    });
    const unsupported = result.status !== "unknown" && selectedEvidence.length === 0;
    const status = unsupported ? "unknown" : result.status;
    if (status === "unknown" && selectedPeople.length === 0) {
      // 情報不足時は会話を行き止まりにしない。近傍グラフに候補がある場合、
      // 遷移可能な顧客1人と、社内の情報保持者1人を優先して返す。
      const linkedCustomer = context.informationHolders.find((item) => item.href);
      const internalHolder = context.informationHolders.find((item) => !item.href);
      selectedPeople = [linkedCustomer, internalHolder].filter(
        (item): item is NonNullable<typeof item> => Boolean(item),
      );
    }
    const answer = unsupported
      ? `そのことは、今ある${context.firstPerson}の情報ではまだ分からないな。`
      : result.answer.trim().slice(0, 500);

    await logTurn({
      kind: "chat",
      ms: Date.now() - startedAt,
      model: MODELS.customerChat,
      resolvedModel: response.headers.get("x-orca-resolved-model") ?? MODELS.customerChat,
      promptTokens: orcaResponse.usage?.prompt_tokens,
      completionTokens: orcaResponse.usage?.completion_tokens,
      sessionId: parsed.data.sessionId,
      input: clip(parsed.data.messages.at(-1)?.text),
      output: clip(answer),
      note: `根拠付き顧客AI / ${status} / evidence:${selectedEvidence.length} / people:${selectedPeople.length}`,
    });

    return Response.json({
      status,
      answer,
      evidence: selectedEvidence,
      suggestedPeople: selectedPeople,
      speech: { voice: context.voice, delivery: context.speechDelivery },
    });
  } catch (error) {
    await logTurn({
      kind: "error",
      ms: Date.now() - startedAt,
      model: MODELS.customerChat,
      input: clip(parsed.data.messages.at(-1)?.text),
      error: clip(error instanceof Error ? error.message : String(error)),
      note: "根拠付き顧客AI",
    });
    return Response.json({ error: "顧客AIから返事を受け取れませんでした" }, { status: 502 });
  }
}
