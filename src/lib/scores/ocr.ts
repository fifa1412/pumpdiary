import type { SCORE_GRADES, SCORE_PLATES } from "@/components/scores/types";

export const OCR_CONFIDENCE_THRESHOLD = 70;

export type OcrScoreFields = {
  title?: string;
  stepType?: "SINGLE" | "DOUBLE" | "HALFDOUBLE";
  level?: number;
  score?: number;
  grade?: (typeof SCORE_GRADES)[number];
  perfect?: number;
  great?: number;
  good?: number;
  bad?: number;
  miss?: number;
  maxCombo?: number;
  plate?: (typeof SCORE_PLATES)[number];
  stagePass?: boolean;
};

type OcrWord = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } };
type OcrLine = { text: string; confidence: number; words: OcrWord[]; bbox: { x0: number; y0: number; x1: number; y1: number } };

const GRADES = ["SSS+", "SSS", "SS+", "SS", "S+", "S", "AAA+", "AAA", "AA+", "AA", "A+", "A", "B", "C", "D", "F"] as const;
const PLATES = ["PERFECT GAME", "ULTIMATE GAME", "EXTREME GAME", "SUPERB GAME", "MARVELOUS GAME", "TALENTED GAME", "FAIR GAME", "ROUGH GAME"] as const;

function reliable(line: OcrLine): boolean {
  const words = line.words.filter((word) => word.text.trim());
  return words.length > 0 && words.every((word) => word.confidence >= OCR_CONFIDENCE_THRESHOLD);
}

function numberAfterLabel(lines: OcrLine[], label: RegExp): number | undefined {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!reliable(line) || !label.test(line.text)) continue;
    const afterLabel = line.text.replace(label, " ");
    const candidates = [afterLabel];
    const nextLine = lines[index + 1];
    if (nextLine && reliable(nextLine)) candidates.push(nextLine.text);
    for (const candidate of candidates) {
      const match = candidate.replace(/,/g, "").match(/\b\d{1,7}\b/);
      if (match) return Number(match[0]);
    }
  }
  return undefined;
}

function phraseConfidence(lines: OcrLine[], phrase: string): boolean {
  const normalizedPhrase = phrase.replace(/[^A-Z0-9+]/gi, "").toUpperCase();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!reliable(line)) continue;
    const normalizedLine = line.text.replace(/[^A-Z0-9+]/gi, "").toUpperCase();
    if (normalizedLine.includes(normalizedPhrase)) return true;
    const nextLine = lines[index + 1];
    if (!nextLine || !reliable(nextLine)) continue;
    const lineCenterY = (line.bbox.y0 + line.bbox.y1) / 2;
    const nextLineCenterY = (nextLine.bbox.y0 + nextLine.bbox.y1) / 2;
    if (Math.abs(lineCenterY - nextLineCenterY) > 0.04) continue;
    const nextNormalizedLine = nextLine.text.replace(/[^A-Z0-9+]/gi, "").toUpperCase();
    if (`${normalizedLine}${nextNormalizedLine}`.includes(normalizedPhrase)) return true;
  }
  return false;
}

function matchesToken(line: OcrLine, value: string): boolean {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return reliable(line)
    && new RegExp(`(?:^|[^A-Z0-9])${escaped}(?:$|[^A-Z0-9])`, "i").test(line.text.trim());
}

function findPlate(lines: OcrLine[]): (typeof PLATES)[number] | undefined {
  return PLATES.find((plate) => phraseConfidence(lines, plate));
}

function parseTitle(lines: OcrLine[]): string | undefined {
  const candidates = lines.filter((line) => {
    if (!reliable(line)) return false;
    const text = line.text.trim().replace(/\s+/g, " ");
    if (!text || text.length > 60 || /#\s?\d+/.test(text)) return false;
    if (/\b(?:SINGLE|DOUBLE|HALF\s?DOUBLE|S\s?\d{1,2}|D\s?\d{1,2}|HD\s?\d{1,2})\b/i.test(text)) return false;
    if (/\b(?:PERFECT|GREAT|GOOD|BAD|MISS|MAX\s?COMBO|GAME|MARVELOUS|TALENTED|ULTIMATE|EXTREME|SUPERB|ROUGH|FAIR|PASS|FAILED|STAGE|SCORE|CREDIT|BGA|EXPERT|NORMAL|HARD|DARK|LV)\b/i.test(text)) return false;
    if (/^[\d\s,.:+%-]+$/.test(text)) return false;
    return text.replace(/[^\p{L}\p{N}]/gu, "").length >= 4;
  });
  candidates.sort((a, b) => {
    const centerDistance = (line: OcrLine) => Math.abs((line.bbox.x0 + line.bbox.x1) / 2 - 0.5);
    return centerDistance(a) - centerDistance(b) || b.confidence - a.confidence;
  });
  return candidates[0]?.text.trim().replace(/\s+/g, " ");
}

export function parseScoreOcr(lines: OcrLine[]): OcrScoreFields {
  const fields: OcrScoreFields = {};
  const chart = lines.filter(reliable).map((line) => line.text.match(/\b(HD|HALF\s?DOUBLE|DOUBLE|SINGLE|D|S)\s*[-:]?\s*(\d{1,2})\b/i)).find(Boolean);
  if (chart) {
    const type = chart[1].toUpperCase().replace(/\s+/g, "");
    fields.stepType = type === "S" || type === "SINGLE"
      ? "SINGLE"
      : type === "D" || type === "DOUBLE"
        ? "DOUBLE"
        : "HALFDOUBLE";
    fields.level = Number(chart[2]);
  }

  const title = parseTitle(lines);
  if (title) fields.title = title;

  for (const grade of GRADES) {
    if (lines.some((line) => grade.length === 1
      ? reliable(line) && line.text.trim().toUpperCase() === grade && line.bbox.y0 >= 0.4
      : matchesToken(line, grade))) {
      fields.grade = grade;
      break;
    }
  }

  const scoreLine = lines.find((line) => reliable(line) && /\b\d{6,7}\b/.test(line.text.replace(/,/g, "")));
  const scoreMatch = scoreLine?.text.replace(/,/g, "").match(/\b\d{6,7}\b/);
  if (scoreMatch) {
    const score = Number(scoreMatch[0]);
    if (score <= 1_000_000) fields.score = score;
  }

  const stats: ["perfect" | "great" | "good" | "bad" | "miss" | "maxCombo", RegExp][] = [
    ["perfect", /\bPERFECT\b/i],
    ["great", /\bGREAT\b/i],
    ["good", /\bGOOD\b/i],
    ["bad", /\bBAD\b/i],
    ["miss", /\bMISS\b/i],
    ["maxCombo", /\bMAX\s?COMBO\b/i],
  ];
  for (const [key, label] of stats) {
    const value = numberAfterLabel(lines, label);
    if (value !== undefined) fields[key] = value;
  }

  const plate = findPlate(lines);
  if (plate) fields.plate = plate;
  if (phraseConfidence(lines, "STAGE FAILED") || phraseConfidence(lines, "STAGE FAIL")) {
    fields.stagePass = false;
  } else if (phraseConfidence(lines, "STAGE CLEAR") || phraseConfidence(lines, "STAGE PASSED")) {
    fields.stagePass = true;
  }
  return fields;
}

export async function recognizeScoreImage(image: Blob, flipped = false): Promise<OcrScoreFields> {
  const { createWorker } = await import("tesseract.js");
  const assetBase = new URL("/ocr/", window.location.href);
  const worker = await createWorker("eng", 1, {
    workerPath: new URL("worker.min.js", assetBase).toString(),
    corePath: new URL("tesseract-core-lstm.wasm.js", assetBase).toString(),
    langPath: assetBase.toString(),
    gzip: true,
  });
  try {
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "11" as Parameters<typeof worker.setParameters>[0]["tessedit_pageseg_mode"],
    });
    const bitmap = await createImageBitmap(image);
    const cropLeft = Math.round(bitmap.width * 0.03);
    const cropTop = Math.round(bitmap.height * 0.16);
    const cropWidth = Math.round(bitmap.width * 0.92);
    const cropHeight = Math.round(bitmap.height * 0.68);
    const canvas = document.createElement("canvas");
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas-unavailable");
    if (flipped) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.filter = "grayscale(1) contrast(1.15)";
    context.drawImage(bitmap, cropLeft, cropTop, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    bitmap.close();
    const input = canvas;
    const result = await worker.recognize(input, {}, { blocks: true });
    const lines = result.data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.map((line) => ({
      text: line.text,
      confidence: line.confidence,
      bbox: { x0: line.bbox.x0 / cropWidth, y0: line.bbox.y0 / cropHeight, x1: line.bbox.x1 / cropWidth, y1: line.bbox.y1 / cropHeight },
      words: line.words.map((word) => ({ text: word.text, confidence: word.confidence, bbox: word.bbox })),
    })))) ?? [];
    return parseScoreOcr(lines);
  } finally {
    await worker.terminate();
  }
}
