import type { SCORE_GRADES, SCORE_PLATES } from "@/components/scores/types";

export const OCR_FIELD_CONFIDENCE = {
  titleWord: 40,
  chartWord: 40,
  scoreWord: 70,
  scoreRegionWord: 60,
  judgmentWord: 70,
  plateAnchorWord: 70,
  plateGameWord: 35,
  plateRegionWord: 70,
  gradeWord: 60,
  singleLetterGrade: 70,
  stagePassWord: 80,
} as const;

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

function usefulWords(line: OcrLine): OcrWord[] {
  return line.words.filter((word) => /[\p{L}\p{N}]/u.test(word.text));
}

function lineCenter(line: OcrLine): { x: number; y: number } {
  return {
    x: (line.bbox.x0 + line.bbox.x1) / 2,
    y: (line.bbox.y0 + line.bbox.y1) / 2,
  };
}

function normalizedWord(value: string): string {
  return value.normalize("NFKD").replace(/[^A-Z0-9+]/gi, "").toUpperCase();
}

function editSimilarity(left: string, right: string): number {
  const a = normalizedWord(left);
  const b = normalizedWord(right);
  if (!a || !b) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let row = 1; row <= a.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= b.length; column += 1) {
      const above = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + (a[row - 1] === b[column - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

function confidentPhrase(lines: OcrLine[], phrase: string, threshold: number): boolean {
  const tokens = phrase.split(/\s+/).map(normalizedWord).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const first = lines[index];
    const firstWords = usefulWords(first).filter((word) => word.confidence >= threshold);
    const firstText = firstWords.map((word) => normalizedWord(word.text)).join("");
    if (firstText.includes(tokens.join(""))) return true;

    const next = lines[index + 1];
    if (!next) continue;
    if (Math.abs(lineCenter(first).y - lineCenter(next).y) > 0.09) continue;
    const joined = [...firstWords, ...usefulWords(next).filter((word) => word.confidence >= threshold)]
      .map((word) => normalizedWord(word.text)).join("");
    if (joined.includes(tokens.join(""))) return true;
  }
  return false;
}

function numericWord(word: OcrWord, threshold: number = OCR_FIELD_CONFIDENCE.judgmentWord): number | undefined {
  if (word.confidence < threshold) return undefined;
  const digits = word.text.match(/^(\d{1,5})$/)?.[1];
  return digits ? Number(digits) : undefined;
}

function numberNearLabel(lines: OcrLine[], label: string): number | undefined {
  const expected = label.split(/\s+/).map(normalizedWord).filter(Boolean);
  const candidates: { value: number; confidence: number; labelConfidence: number; distance: number }[] = [];
  for (const labelLine of lines) {
    const labelWords = usefulWords(labelLine).filter((word) => word.confidence >= 60);
    const matched = expected.map((token) => labelWords.find((word) => editSimilarity(word.text, token) >= 0.82));
    if (matched.some((word) => !word)) continue;
    const labelX = Math.min(...matched.map((word) => word!.bbox.x0));
    const labelY = (labelLine.bbox.y0 + labelLine.bbox.y1) / 2;
    if (labelX < 0.42 || labelX > 0.78 || labelY < 0.35 || labelY > 0.7) continue;
    const labelConfidence = Math.min(...matched.map((word) => word!.confidence));
    for (const valueLine of lines) {
      const valueY = (valueLine.bbox.y0 + valueLine.bbox.y1) / 2;
      if (Math.abs(valueY - labelY) > 0.028) continue;
      for (const word of usefulWords(valueLine)) {
        const value = numericWord(word);
        if (value === undefined || value > 5_000 || word.bbox.x1 > labelX + 0.015) continue;
        candidates.push({ value, confidence: word.confidence, labelConfidence, distance: Math.abs(valueY - labelY) });
      }
    }
  }
  candidates.sort((a, b) => b.confidence + b.labelConfidence - a.confidence - a.labelConfidence || a.distance - b.distance);
  return candidates[0]?.value;
}

function labelY(lines: OcrLine[], label: string): number | undefined {
  const expected = label.split(/\s+/).map(normalizedWord).filter(Boolean);
  for (const line of lines) {
    const words = usefulWords(line).filter((word) => word.confidence >= 70);
    const matched = expected.map((token) => words.find((word) => editSimilarity(word.text, token) >= 0.82));
    const x = matched[0] && (matched[0].bbox.x0 + matched[0].bbox.x1) / 2;
    const y = (line.bbox.y0 + line.bbox.y1) / 2;
    if (matched.every(Boolean) && x !== undefined && x >= 0.42 && x <= 0.78 && y >= 0.35 && y <= 0.7) return y;
  }
  return undefined;
}

function numberAtAnchoredRow(lines: OcrLine[], expectedY: number): number | undefined {
  const candidates = lines.flatMap((line) => usefulWords(line).flatMap((word) => {
    const value = numericWord(word, 50);
    const x = (word.bbox.x0 + word.bbox.x1) / 2;
    const y = (word.bbox.y0 + word.bbox.y1) / 2;
    return value !== undefined && value <= 5_000 && x >= 0.32 && x <= 0.43 && Math.abs(y - expectedY) <= 0.008
      ? [{ value, confidence: word.confidence, distance: Math.abs(y - expectedY) }]
      : [];
  }));
  candidates.sort((a, b) => b.confidence - a.confidence || a.distance - b.distance);
  return candidates[0]?.value;
}

function judgmentRowOffset(lines: OcrLine[]): number | undefined {
  const numbers = lines.flatMap((line) => usefulWords(line).flatMap((word) => {
    const value = numericWord(word, 50);
    const x = (word.bbox.x0 + word.bbox.x1) / 2;
    const y = (word.bbox.y0 + word.bbox.y1) / 2;
    return value !== undefined && value <= 5_000 && x >= 0.33 && x <= 0.4 && y >= 0.34 && y <= 0.7
      ? [{ y, confidence: word.confidence }] : [];
  }));
  let best: { offset: number; matches: number; error: number } | undefined;
  for (const number of numbers) {
    for (let index = 0; index < 6; index += 1) {
      const offset = number.y - (0.396 + index * 0.0492);
      if (offset < -0.005 || offset > 0.04) continue;
      const distances = Array.from({ length: 6 }, (_, row) =>
        Math.min(...numbers.map((candidate) => Math.abs(candidate.y - (0.396 + row * 0.0492 + offset))), Infinity),
      );
      const matches = distances.filter((distance) => distance <= 0.008).length;
      const error = distances.filter((distance) => distance <= 0.008).reduce((sum, distance) => sum + distance, 0);
      const strongMatches = numbers.filter((candidate) => candidate.confidence >= 80
        && Array.from({ length: 6 }, (_, row) => Math.abs(candidate.y - (0.396 + row * 0.0492 + offset))).some((distance) => distance <= 0.008)).length;
      if (matches >= 3 && strongMatches >= 2
        && (!best || matches > best.matches || (matches === best.matches && error < best.error))) {
        best = { offset, matches, error };
      }
    }
  }
  return best?.offset;
}

function findPlate(lines: OcrLine[], cropped = false): (typeof PLATES)[number] | undefined {
  const words = lines.flatMap(usefulWords);
  for (const plate of PLATES) {
    const firstToken = plate.split(" ")[0];
    for (const first of words) {
      if (normalizedWord(first.text) !== firstToken
        || first.confidence < (cropped ? OCR_FIELD_CONFIDENCE.plateRegionWord : OCR_FIELD_CONFIDENCE.plateAnchorWord)) continue;
      const firstX = (first.bbox.x0 + first.bbox.x1) / 2;
      const firstY = (first.bbox.y0 + first.bbox.y1) / 2;
      if (!cropped && (firstX < 0.1 || firstX > 0.35 || firstY < 0.6 || firstY > 0.83)) continue;
      if (words.some((second) => {
        const secondX = (second.bbox.x0 + second.bbox.x1) / 2;
        const secondY = (second.bbox.y0 + second.bbox.y1) / 2;
        return (normalizedWord(second.text) === "GAME" || (normalizedWord(second.text) === "GAM" && second.confidence >= 80))
          && second.confidence >= (cropped ? OCR_FIELD_CONFIDENCE.plateRegionWord : OCR_FIELD_CONFIDENCE.plateGameWord)
          && Math.abs(secondX - firstX) <= (cropped ? 0.3 : 0.1)
          && secondY >= firstY && secondY - firstY <= (cropped ? 0.6 : 0.13);
      })) return plate;
    }
  }
  return undefined;
}

function parseTitle(lines: OcrLine[]): string | undefined {
  const candidates = lines.filter((line) => {
    const center = lineCenter(line);
    const text = line.text.trim().replace(/\s+/g, " ");
    const words = usefulWords(line);
    const contentWords = words.filter((word) => normalizedWord(word.text).length > 1);
    if (center.y < 0.07 || center.y > 0.3 || center.x < 0.38 || center.x > 0.62 || line.confidence < 40 || !text || text.length > 60 || /#\s?\d+/.test(text)) return false;
    if (contentWords.length === 0 || contentWords.some((word) => word.confidence < OCR_FIELD_CONFIDENCE.titleWord)) return false;
    if (/\b(?:LET'?S\s+PLAY|MBK\s+CENTER|FIFAZ|SINGLE|DOUBLE|HALF\s?DOUBLE|S\s?\d{1,2}|D\s?\d{1,2}|HD\s?\d{1,2})\b/i.test(text)) return false;
    if (/\b(?:PERFECT|GREAT|GOOD|BAD|MISS|MAX\s?COMBO|GAME|MARVELOUS|TALENTED|ULTIMATE|EXTREME|SUPERB|ROUGH|FAIR|PASS|FAILED|STAGE|SCORE|CREDIT|BGA|ABSOLUTE|EXPER\w*|NORMAL|HARD|DARK|LV)\b/i.test(text)) return false;
    if (/^[\d\s,.:+%-]+$/.test(text)) return false;
    const letters = text.replace(/[^\p{L}]/gu, "").length;
    const digits = text.replace(/[^\p{N}]/gu, "").length;
    return letters >= 4 || (digits === 4 && letters === 0);
  });
  candidates.sort((a, b) => b.confidence - a.confidence || Math.abs(lineCenter(a).y - 0.22) - Math.abs(lineCenter(b).y - 0.22));
  return candidates[0]?.text.trim().replace(/\s+/g, " ");
}

export function parseScoreOcr(lines: OcrLine[]): OcrScoreFields {
  const fields: OcrScoreFields = {};
  const chart = lines.map((line) => {
    const match = line.text.trim().match(/^(?:\[)?(HD|HALF\s?DOUBLE|DOUBLE|SINGLE|D|S)\s*[-:]?\s*(\d{1,2})(?:\])?$/i);
    return match && usefulWords(line).every((word) => word.confidence >= OCR_FIELD_CONFIDENCE.chartWord) ? match : undefined;
  }).find(Boolean);
  if (chart) {
    const type = chart[1].toUpperCase().replace(/\s+/g, "");
    const level = Number(chart[2]);
    if (level >= 1 && level <= 29) {
      fields.stepType = type === "S" || type === "SINGLE"
      ? "SINGLE"
      : type === "D" || type === "DOUBLE"
        ? "DOUBLE"
        : "HALFDOUBLE";
      fields.level = level;
    }
  }

  const title = parseTitle(lines);
  if (title) fields.title = title;

  for (const grade of GRADES) {
    if (lines.some((line) => {
      const center = lineCenter(line);
      return center.y >= 0.42 && center.y <= 0.78 && usefulWords(line).some((word) => {
        const wordX = (word.bbox.x0 + word.bbox.x1) / 2;
        return wordX >= 0.08 && wordX <= 0.32 && normalizedWord(word.text) === grade
          && word.confidence >= (grade.length === 1 ? OCR_FIELD_CONFIDENCE.singleLetterGrade : OCR_FIELD_CONFIDENCE.gradeWord);
      });
    })) {
      fields.grade = grade;
      break;
    }
  }

  const fullScore = lines.flatMap((line) => usefulWords(line).flatMap((word) => {
    const digits = word.text.replace(/,/g, "").match(/^(\d{6,7})$/)?.[1];
    const score = digits ? Number(digits) : undefined;
    const x = (word.bbox.x0 + word.bbox.x1) / 2;
    const y = (word.bbox.y0 + word.bbox.y1) / 2;
    return score !== undefined && score <= 1_000_000 && x >= 0.08 && x <= 0.4 && y >= 0.28 && y <= 0.52
      && word.confidence >= OCR_FIELD_CONFIDENCE.scoreWord
      ? [{ score, confidence: word.confidence }]
      : [];
  }));
  fullScore.sort((a, b) => b.confidence - a.confidence);
  if (fullScore[0]) fields.score = fullScore[0].score;

  const stats: ["perfect" | "great" | "good" | "bad" | "miss" | "maxCombo", string][] = [
    ["perfect", "PERFECT"],
    ["great", "GREAT"],
    ["good", "GOOD"],
    ["bad", "BAD"],
    ["miss", "MISS"],
    ["maxCombo", "MAX COMBO"],
  ];
  const anchors = stats.flatMap(([, label], index) => {
    const y = labelY(lines, label);
    return y === undefined ? [] : [{ offset: y - (0.396 + index * 0.0492) }];
  });
  const labelOffset = anchors.length > 0
    && anchors.every((anchor) => Math.abs(anchor.offset - anchors[0].offset) <= 0.02)
    ? anchors.reduce((sum, anchor) => sum + anchor.offset, 0) / anchors.length
    : undefined;
  const rowOffset = labelOffset ?? judgmentRowOffset(lines);
  for (const [index, [key, label]] of stats.entries()) {
    const value = numberNearLabel(lines, label);
    if (value !== undefined) fields[key] = value;
    else if (rowOffset !== undefined) {
      const anchoredValue = numberAtAnchoredRow(lines, 0.396 + index * 0.0492 + rowOffset);
      if (anchoredValue !== undefined) fields[key] = anchoredValue;
    }
  }

  const plate = findPlate(lines);
  if (plate) fields.plate = plate;
  if (confidentPhrase(lines, "STAGE FAILED", OCR_FIELD_CONFIDENCE.stagePassWord - 25)
    || confidentPhrase(lines, "STAGE FAIL", OCR_FIELD_CONFIDENCE.stagePassWord - 25)
    || lines.some((line) => lineCenter(line).y > 0.45 && usefulWords(line).some((word) =>
      /^(?:FAILED|FAIL)$/.test(normalizedWord(word.text)) && word.confidence >= OCR_FIELD_CONFIDENCE.stagePassWord - 10,
    ))) {
    fields.stagePass = false;
  } else if (confidentPhrase(lines, "STAGE CLEAR", OCR_FIELD_CONFIDENCE.stagePassWord - 25)
    || confidentPhrase(lines, "STAGE PASSED", OCR_FIELD_CONFIDENCE.stagePassWord - 25)
    || lines.some((line) => lineCenter(line).y > 0.45 && usefulWords(line).some((word) =>
      normalizedWord(word.text) === "PASS" && word.confidence >= OCR_FIELD_CONFIDENCE.stagePassWord,
    ))) {
    fields.stagePass = true;
  }
  return fields;
}

function recognizedFieldCount(fields: OcrScoreFields): number {
  return [
    fields.stepType,
    fields.score,
    fields.grade,
    fields.perfect,
    fields.great,
    fields.good,
    fields.bad,
    fields.miss,
    fields.maxCombo,
    fields.plate,
    fields.stagePass,
  ].filter((value) => value !== undefined).length;
}

export async function recognizeScoreImage(image: Blob, flipped = false, signal?: AbortSignal): Promise<OcrScoreFields> {
  if (signal?.aborted) throw new DOMException("OCR cancelled", "AbortError");
  const { createWorker } = await import("tesseract.js");
  const assetBase = new URL("/ocr/", window.location.href);
  const worker = await createWorker("eng", 1, {
    workerPath: new URL("worker.min.js", assetBase).toString(),
    corePath: new URL("tesseract-core-lstm.wasm.js", assetBase).toString(),
    langPath: assetBase.toString(),
    gzip: true,
  });
  let bitmap: ImageBitmap | undefined;
  let workerTerminated = false;
  let termination: ReturnType<typeof worker.terminate> | undefined;
  const terminateWorker = () => {
    if (workerTerminated) return;
    workerTerminated = true;
    termination = worker.terminate();
    void termination;
  };
  signal?.addEventListener("abort", terminateWorker, { once: true });
  try {
    if (signal?.aborted) throw new DOMException("OCR cancelled", "AbortError");
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "11" as Parameters<typeof worker.setParameters>[0]["tessedit_pageseg_mode"],
    });
    bitmap = await createImageBitmap(image);
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
    const input = canvas;
    if (signal?.aborted) throw new DOMException("OCR cancelled", "AbortError");
    const result = await worker.recognize(input, {}, { blocks: true });
    if (signal?.aborted) throw new DOMException("OCR cancelled", "AbortError");
    const lines = result.data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.map((line) => ({
      text: line.text,
      confidence: line.confidence,
      bbox: { x0: line.bbox.x0 / cropWidth, y0: line.bbox.y0 / cropHeight, x1: line.bbox.x1 / cropWidth, y1: line.bbox.y1 / cropHeight },
      words: line.words.map((word) => ({
        text: word.text,
        confidence: word.confidence,
        bbox: {
          x0: word.bbox.x0 / cropWidth,
          y0: word.bbox.y0 / cropHeight,
          x1: word.bbox.x1 / cropWidth,
          y1: word.bbox.y1 / cropHeight,
        },
      })),
    })))) ?? [];
    const fields = parseScoreOcr(lines);
    if (fields.score === undefined) {
      const scoreCanvas = document.createElement("canvas");
      const scale = 4;
      const scoreLeft = Math.round(bitmap.width * (flipped ? 0.64 : 0.14));
      const scoreTop = Math.round(bitmap.height * 0.4);
      const scoreWidth = Math.round(bitmap.width * 0.22);
      const scoreHeight = Math.round(bitmap.height * 0.08);
      scoreCanvas.width = scoreWidth * scale;
      scoreCanvas.height = scoreHeight * scale;
      const scoreContext = scoreCanvas.getContext("2d");
      if (scoreContext) {
        scoreContext.filter = "grayscale(1) contrast(1.35)";
        if (flipped) {
          scoreContext.translate(scoreCanvas.width, 0);
          scoreContext.scale(-1, 1);
        }
        scoreContext.drawImage(bitmap, scoreLeft, scoreTop, scoreWidth, scoreHeight, 0, 0, scoreCanvas.width, scoreCanvas.height);
        await worker.setParameters({
          tessedit_pageseg_mode: "11" as Parameters<typeof worker.setParameters>[0]["tessedit_pageseg_mode"],
          tessedit_char_whitelist: "0123456789",
        });
        if (signal?.aborted) throw new DOMException("OCR cancelled", "AbortError");
        const scoreResult = await worker.recognize(scoreCanvas, {}, { blocks: true });
        if (signal?.aborted) throw new DOMException("OCR cancelled", "AbortError");
        const values = scoreResult.data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) =>
          line.words.flatMap((word) => {
            const digits = word.text.replace(/,/g, "").match(/^(\d{6,7})$/)?.[1];
            const score = digits ? Number(digits) : undefined;
            return score !== undefined && score <= 1_000_000 && word.confidence >= OCR_FIELD_CONFIDENCE.scoreRegionWord ? [{ score, confidence: word.confidence }] : [];
          }),
        ))) ?? [];
        values.sort((a, b) => b.confidence - a.confidence);
        if (values[0]) fields.score = values[0].score;
      }
    }
    if (fields.score === undefined) {
      const readings: number[] = [];
      for (const region of [
        { left: 0.125, top: 0.39, width: 0.235, height: 0.07, contrast: 1 },
        { left: 0.17, top: 0.405, width: 0.17, height: 0.055, contrast: 1.1 },
      ]) {
        if (signal?.aborted) throw new DOMException("OCR cancelled", "AbortError");
        const left = Math.round(bitmap.width * (flipped ? 1 - region.left - region.width : region.left));
        const top = Math.round(bitmap.height * region.top);
        const width = Math.round(bitmap.width * region.width);
        const height = Math.round(bitmap.height * region.height);
        const scoreCanvas = document.createElement("canvas");
        scoreCanvas.width = width;
        scoreCanvas.height = height;
        const context = scoreCanvas.getContext("2d");
        if (!context) break;
        context.filter = `grayscale(1) contrast(${region.contrast})`;
        if (flipped) {
          context.translate(width, 0);
          context.scale(-1, 1);
        }
        context.drawImage(bitmap, left, top, width, height, 0, 0, width, height);
        await worker.setParameters({
          tessedit_pageseg_mode: "13" as Parameters<typeof worker.setParameters>[0]["tessedit_pageseg_mode"],
          tessedit_char_whitelist: "0123456789",
        });
        const reading = (await worker.recognize(scoreCanvas)).data.text.trim().match(/^\d{6,7}$/)?.[0];
        if (reading) readings.push(Number(reading));
      }
      if (readings.length === 2 && readings[0] === readings[1] && readings[0] <= 1_000_000) {
        fields.score = readings[0];
      }
    }
    if (fields.plate === undefined) {
      const plateLeft = Math.round(bitmap.width * (flipped ? 0.58 : 0.12));
      const plateTop = Math.round(bitmap.height * 0.62);
      const plateWidth = Math.round(bitmap.width * 0.3);
      const plateHeight = Math.round(bitmap.height * 0.11);
      const scale = 2;
      const plateCanvas = document.createElement("canvas");
      plateCanvas.width = plateWidth * scale;
      plateCanvas.height = plateHeight * scale;
      const plateContext = plateCanvas.getContext("2d");
      if (plateContext) {
        plateContext.filter = "grayscale(1) contrast(1.4)";
        if (flipped) {
          plateContext.translate(plateCanvas.width, 0);
          plateContext.scale(-1, 1);
        }
        plateContext.drawImage(bitmap, plateLeft, plateTop, plateWidth, plateHeight, 0, 0, plateCanvas.width, plateCanvas.height);
        await worker.setParameters({
          tessedit_pageseg_mode: "6" as Parameters<typeof worker.setParameters>[0]["tessedit_pageseg_mode"],
          tessedit_char_whitelist: "",
        });
        if (signal?.aborted) throw new DOMException("OCR cancelled", "AbortError");
        const plateResult = await worker.recognize(plateCanvas, {}, { blocks: true });
        if (signal?.aborted) throw new DOMException("OCR cancelled", "AbortError");
        const plateLines = plateResult.data.blocks?.flatMap((block) => block.paragraphs.flatMap((paragraph) => paragraph.lines.map((line) => ({
          text: line.text,
          confidence: line.confidence,
          bbox: { x0: line.bbox.x0 / plateCanvas.width, y0: line.bbox.y0 / plateCanvas.height, x1: line.bbox.x1 / plateCanvas.width, y1: line.bbox.y1 / plateCanvas.height },
          words: line.words.map((word) => ({
            text: word.text,
            confidence: word.confidence,
            bbox: { x0: word.bbox.x0 / plateCanvas.width, y0: word.bbox.y0 / plateCanvas.height, x1: word.bbox.x1 / plateCanvas.width, y1: word.bbox.y1 / plateCanvas.height },
          })),
        })))) ?? [];
        fields.plate = findPlate(plateLines, true);
      }
    }
    if (!flipped && recognizedFieldCount(fields) === 0) {
      terminateWorker();
      const reversedFields = await recognizeScoreImage(image, true, signal);
      if (recognizedFieldCount(reversedFields) > 0) return reversedFields;
    }
    return fields;
  } finally {
    signal?.removeEventListener("abort", terminateWorker);
    bitmap?.close();
    if (!workerTerminated) terminateWorker();
    await termination;
  }
}
