import "server-only";
import { generateObject } from "ai";
import { z } from "zod";
import { MODELS, orca } from "@/lib/orca";
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
      confidence: z.number().min(0).max(1),
    }),
  ),
  relations: z.array(
    z.object({
      fromTempId: z.string(),
      toTempId: z.string(),
      relationType: z.string(),
      label: z.string(),
      evidenceQuote: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});
export type KnowledgeExtraction = z.infer<typeof extractionSchema>;
export async function extractKnowledge(input: Parameters<typeof knowledgeExtractionPrompt>[0]) {
  const startedAt = Date.now();
  const result = await generateObject({
    model: orca(MODELS.knowledge),
    schema: extractionSchema,
    prompt: knowledgeExtractionPrompt(input),
    temperature: 0.1,
  });
  const safe = {
    ...result.object,
    claims: result.object.claims.filter((item) => input.rawText.includes(item.evidenceQuote)),
    relations: result.object.relations.filter((item) => input.rawText.includes(item.evidenceQuote)),
  };
  await logTurn({
    kind: "knowledge",
    ms: Date.now() - startedAt,
    model: MODELS.knowledge,
    input: clip(input.rawText),
    output: clip(JSON.stringify(safe)),
    note: "原文から知識グラフ候補を抽出",
  });
  return safe;
}
