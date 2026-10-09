import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { SCORE_GRADES, SCORE_PLATES } from "@/components/scores/types";
import type { OcrScoreFields } from "@/lib/scores/ocr";

// Reads a Phoenix 2 result screen photo with Claude Haiku 5.5. Returns the
// same fields as the in-browser OCR so the form can fill itself either way.

const MODEL = "claude-haiku-5-5";
// Claude Haiku 5.5 list prices in USD per token for prompts up to 100K tokens.
const PRICE = { input: 0.10 / 1e6, output: 0.50 / 1e6, cacheWrite: 0.125 / 1e6, cacheRead: 0.01 / 1e6 };

export const AI_IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
export type AiImageType = (typeof AI_IMAGE_TYPES)[number];

const SYSTEM_PROMPT = `You read photos of the Pump It Up Phoenix 2 arcade result screen, usually taken with a phone at an angle, with glare, moving light streaks, and the cabinet frame around the screen. The photo can also be mirrored left to right.

Report what the screen shows:
- title: the song title in the bar near the top centre, above the judgment list. Copy it exactly, including punctuation and capitalisation. It is not the large stylised song logo near the bottom, not the player name, and not the player rank such as "[S] EXPERT LV.3".
- titleLatin: when the title is written in Korean, Japanese, or another non-Latin script, the song's romanized or English title as Pump It Up lists it; otherwise null.
- stepType and level: the round chart badge next to the score, labelled SINGLE, DOUBLE, or HALF-DOUBLE above the level number.
- score: the large score, up to 1,000,000 (leading zeros removed). Not the smaller "+N" number under it.
- grade: the large grade logo (for example SSS+, AA, A+, F).
- plate: the words under the grade, such as MARVELOUS GAME.
- perfect, great, good, bad, miss, maxCombo: the numbers beside PERFECT, GREAT, GOOD, BAD, MISS, and MAX COMBO. Ignore KCAL.
- machineName: the machine name the arcade set, usually an arcade or shop name, shown small at the bottom right of the screen. Copy it exactly.
- stagePass: true when the grade logo is in colour and a plate is shown; false when the grade logo is grey, silver, or black (often cracked) and there is no plate, which is how the game shows a failed stage. Null only when you cannot tell.

Use null for anything you cannot read with confidence. Never guess a number.`;

const nullable = (schema: Record<string, unknown>) => ({ anyOf: [schema, { type: "null" }] });
const count = nullable({ type: "integer" });

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "stepType", "level", "score", "grade", "plate", "perfect", "great", "good", "bad", "miss", "maxCombo", "stagePass", "machineName", "titleLatin"],
  properties: {
    title: nullable({ type: "string" }),
    stepType: nullable({ type: "string", enum: ["SINGLE", "DOUBLE", "HALFDOUBLE"] }),
    level: count,
    score: count,
    grade: nullable({ type: "string", enum: [...SCORE_GRADES] }),
    plate: nullable({ type: "string", enum: [...SCORE_PLATES] }),
    perfect: count,
    great: count,
    good: count,
    bad: count,
    miss: count,
    maxCombo: count,
    stagePass: nullable({ type: "boolean" }),
    machineName: nullable({ type: "string" }),
    titleLatin: nullable({ type: "string" }),
  },
};

const judgment = z.number().int().min(0).max(10_000).nullable();
const resultSchema = z.object({
  title: z.string().trim().max(200).nullable(),
  stepType: z.enum(["SINGLE", "DOUBLE", "HALFDOUBLE"]).nullable(),
  level: z.number().int().min(1).max(29).nullable(),
  score: z.number().int().min(0).max(1_000_000).nullable(),
  grade: z.enum(SCORE_GRADES).nullable(),
  plate: z.enum(SCORE_PLATES).nullable(),
  perfect: judgment,
  great: judgment,
  good: judgment,
  bad: judgment,
  miss: judgment,
  maxCombo: judgment,
  stagePass: z.boolean().nullable(),
  machineName: z.string().trim().max(200).nullable(),
  titleLatin: z.string().trim().max(200).nullable(),
});

export class AiReadError extends Error {
  // Set when the model ran (and was billed) but gave nothing usable.
  constructor(readonly code: "unavailable" | "refused" | "unreadable", readonly usage?: AiReadUsage) {
    super(code);
  }
}

export function aiReadAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type AiReadUsage = { model: string; inputTokens: number; outputTokens: number; costUsd: number };

export async function readScoreScreenshot(
  image: Buffer,
  mediaType: AiImageType,
): Promise<{ fields: OcrScoreFields; usage: AiReadUsage }> {
  if (!aiReadAvailable()) throw new AiReadError("unavailable");
  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: image.toString("base64") } },
        { type: "text", text: "Read this result screen." },
      ],
    }],
  });
  const { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } = response.usage;
  const usage: AiReadUsage = {
    model: MODEL,
    inputTokens: input_tokens + (cache_creation_input_tokens ?? 0) + (cache_read_input_tokens ?? 0),
    outputTokens: output_tokens,
    costUsd: input_tokens * PRICE.input + output_tokens * PRICE.output
      + (cache_creation_input_tokens ?? 0) * PRICE.cacheWrite + (cache_read_input_tokens ?? 0) * PRICE.cacheRead,
  };
  if (response.stop_reason === "refusal") throw new AiReadError("refused", usage);

  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  let parsed: z.infer<typeof resultSchema>;
  try {
    parsed = resultSchema.parse(JSON.parse(text));
  } catch {
    throw new AiReadError("unreadable", usage);
  }

  const fields: OcrScoreFields = {};
  const titles = [...new Set([parsed.title, parsed.titleLatin].filter((title): title is string => Boolean(title)))];
  if (titles.length > 0) {
    fields.title = titles[0];
    fields.titleCandidates = titles;
  }
  if (parsed.stepType) fields.stepType = parsed.stepType;
  if (parsed.level !== null) fields.level = parsed.level;
  if (parsed.score !== null) fields.score = parsed.score;
  if (parsed.grade) fields.grade = parsed.grade;
  if (parsed.plate) fields.plate = parsed.plate;
  for (const key of ["perfect", "great", "good", "bad", "miss", "maxCombo"] as const) {
    const value = parsed[key];
    if (value !== null) fields[key] = value;
  }
  if (parsed.stagePass !== null) fields.stagePass = parsed.stagePass;
  if (parsed.machineName) fields.machineName = parsed.machineName;
  return { fields, usage };
}
