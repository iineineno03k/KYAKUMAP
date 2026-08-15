import "server-only";
import { z } from "zod";
import { MODELS, orcaFetch } from "@/lib/orca";
import { knowledgeExtractionPrompt } from "@/lib/prompts";
import { clip, logTurn } from "@/lib/telemetry";

const extractionSchema = z.object({
  entities: z.array(
    z.object({
      tempId: z.string(),
      type: z.enum([
        "customer_person",
        "internal_member",
        "company",
        "department",
        "project",
        "topic",
      ]),
      canonicalName: z.string(),
      matchedEntityId: z.string().nullable(),
      aliases: z.array(z.string()),
    }),
  ),
  claims: z.array(
    z.object({
      subjectTempId: z.string(),
      predicate: z.string(),
      valueText: z.string(),
      evidenceQuote: z.string(),
      // OrcaRouterの構造化出力はJSON Schemaのminimum/maximumを受け付けない。
      // 範囲は生成後にコードで補正する。
      confidence: z.number(),
    }),
  ),
  relations: z.array(
    z.object({
      fromTempId: z.string(),
      toTempId: z.string(),
      relationType: z.string(),
      label: z.string(),
      evidenceQuote: z.string(),
      confidence: z.number(),
    }),
  ),
});
export type KnowledgeExtraction = z.infer<typeof extractionSchema>;

const knowledgeExtractionTool = {
  type: "function",
  function: {
    name: "return_knowledge_extraction",
    description: "原文から抽出した人物・事実・関係と根拠引用を返す",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        entities: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              tempId: { type: "string" },
              type: {
                type: "string",
                enum: [
                  "customer_person",
                  "internal_member",
                  "company",
                  "department",
                  "project",
                  "topic",
                ],
              },
              canonicalName: { type: "string" },
              matchedEntityId: { type: ["string", "null"] },
              aliases: { type: "array", items: { type: "string" } },
            },
            required: ["tempId", "type", "canonicalName", "matchedEntityId", "aliases"],
          },
        },
        claims: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              subjectTempId: { type: "string" },
              predicate: { type: "string" },
              valueText: { type: "string" },
              evidenceQuote: { type: "string" },
              confidence: { type: "number" },
            },
            required: ["subjectTempId", "predicate", "valueText", "evidenceQuote", "confidence"],
          },
        },
        relations: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              fromTempId: { type: "string" },
              toTempId: { type: "string" },
              relationType: { type: "string" },
              label: { type: "string" },
              evidenceQuote: { type: "string" },
              confidence: { type: "number" },
            },
            required: [
              "fromTempId",
              "toTempId",
              "relationType",
              "label",
              "evidenceQuote",
              "confidence",
            ],
          },
        },
      },
      required: ["entities", "claims", "relations"],
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

export async function extractKnowledge(input: Parameters<typeof knowledgeExtractionPrompt>[0]) {
  const startedAt = Date.now();
  const response = await orcaFetch("/chat/completions", {
    method: "POST",
    body: JSON.stringify({
      model: MODELS.knowledge,
      messages: [{ role: "user", content: knowledgeExtractionPrompt(input) }],
      tools: [knowledgeExtractionTool],
      tool_choice: {
        type: "function",
        function: { name: knowledgeExtractionTool.function.name },
      },
      temperature: 0.1,
    }),
  });
  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(`OrcaRouter ${response.status}: ${responseBody.slice(0, 500)}`);
  }
  const orcaResponse = orcaResponseSchema.parse(JSON.parse(responseBody));
  const toolCall = orcaResponse.choices[0]?.message.tool_calls.find(
    (item) => item.function.name === knowledgeExtractionTool.function.name,
  );
  if (!toolCall) throw new Error("OrcaRouterが知識抽出ツールを呼び出しませんでした");
  const result = extractionSchema.parse(JSON.parse(toolCall.function.arguments));
  const safe = {
    ...result,
    claims: result.claims
      .filter((item) => input.rawText.includes(item.evidenceQuote))
      .map((item) => ({ ...item, confidence: Math.max(0, Math.min(1, item.confidence)) })),
    relations: result.relations
      .filter((item) => input.rawText.includes(item.evidenceQuote))
      .map((item) => ({ ...item, confidence: Math.max(0, Math.min(1, item.confidence)) })),
  };
  await logTurn({
    kind: "knowledge",
    ms: Date.now() - startedAt,
    model: MODELS.knowledge,
    resolvedModel: response.headers.get("x-orca-resolved-model") ?? MODELS.knowledge,
    promptTokens: orcaResponse.usage?.prompt_tokens,
    completionTokens: orcaResponse.usage?.completion_tokens,
    input: clip(input.rawText),
    output: clip(JSON.stringify(safe)),
    note: "原文から知識グラフ候補を抽出",
  });
  return safe;
}
