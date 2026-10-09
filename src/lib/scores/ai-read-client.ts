import type { OcrScoreFields } from "@/lib/scores/ocr";

const MAX_EDGE = 1600;

// Downscale (and un-mirror) the photo before upload; the model needs no more
// than this to read the screen, and smaller uploads cost less.
async function prepareImage(image: Blob, flipped: boolean): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas-unavailable");
    if (flipped) {
      context.translate(canvas.width, 0);
      context.scale(-1, 1);
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    if (!blob) throw new Error("encode-failed");
    return blob;
  } finally {
    bitmap.close();
  }
}

/**
 * Reads the result screen on the server with Claude. Returns null when the
 * server can't (no API key, daily limit, upstream error) so the caller can
 * fall back to in-browser OCR.
 */
export async function readScreenshotWithAi(image: Blob, flipped: boolean, signal?: AbortSignal): Promise<OcrScoreFields | null> {
  try {
    const body = new FormData();
    body.append("image", await prepareImage(image, flipped), "screenshot.webp");
    const response = await fetch("/api/scores/read-screenshot", { method: "POST", body, signal });
    if (!response.ok) return null;
    const { fields } = await response.json() as { fields?: OcrScoreFields };
    return fields ?? null;
  } catch (error) {
    if (signal?.aborted) throw error;
    return null;
  }
}
