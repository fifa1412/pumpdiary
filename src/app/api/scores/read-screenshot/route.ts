import Anthropic from "@anthropic-ai/sdk";

import { AI_IMAGE_TYPES, AiReadError, aiReadAvailable, readScoreScreenshot, type AiImageType } from "@/lib/scores/ai-read";
import { getCurrentUser } from "@/lib/supabase/server";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// A soft per-player cap that keeps a stuck client or a bored player from
// running up the API bill. It lives in server memory, so it resets on restart
// and is per instance; the spend limit in the Claude Console is the hard cap.
const DAILY_LIMIT = 50;
const usage = new Map<string, { day: string; count: number }>();

function takeQuota(userId: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const entry = usage.get(userId);
  if (!entry || entry.day !== day) {
    usage.set(userId, { day, count: 1 });
    return true;
  }
  if (entry.count >= DAILY_LIMIT) return false;
  entry.count += 1;
  return true;
}

function failure(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return failure(401, "unauthenticated");
  if (!aiReadAvailable()) return failure(503, "unavailable");

  let image: unknown;
  try {
    image = (await request.formData()).get("image");
  } catch {
    return failure(400, "invalid");
  }
  if (!(image instanceof File) || !(AI_IMAGE_TYPES as readonly string[]).includes(image.type) || image.size > MAX_IMAGE_BYTES) {
    return failure(400, "invalid");
  }
  if (!takeQuota(user.id)) return failure(429, "limit");

  try {
    const fields = await readScoreScreenshot(Buffer.from(await image.arrayBuffer()), image.type as AiImageType);
    return Response.json({ fields });
  } catch (error) {
    if (error instanceof AiReadError) return failure(error.code === "unavailable" ? 503 : 422, error.code);
    if (error instanceof Anthropic.RateLimitError) return failure(429, "busy");
    if (error instanceof Anthropic.APIError) return failure(502, "upstream");
    return failure(500, "error");
  }
}
