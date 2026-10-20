import Anthropic from "@anthropic-ai/sdk";
import { createClient as createTokenClient } from "@supabase/supabase-js";

import { getAiBudget } from "@/lib/scores/ai-budget";
import {
  AI_IMAGE_TYPES,
  AiReadError,
  aiReadAvailable,
  readScoreScreenshot,
  type AiImageType,
  type AiReadUsage,
} from "@/lib/scores/ai-read";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
// Per-player cap so one stuck client or bored player can't drain the budget.
const DAILY_LIMIT = 50;

function failure(status: number, error: string) {
  return Response.json({ error }, { status });
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

// The website signs in with a cookie; the iPhone app sends its Supabase access
// token instead. Either way the queries below run as that player.
async function requestPlayer(request: Request): Promise<{ supabase: Supabase; userId: string } | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) {
    const user = await getCurrentUser();
    return user ? { supabase: await createClient(), userId: user.id } : null;
  }
  const supabase = createTokenClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  return error || !data.user ? null : { supabase: supabase as unknown as Supabase, userId: data.user.id };
}

async function readsToday(supabase: Supabase, userId: string): Promise<number | null> {
  const startOfDay = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
  const { count, error } = await supabase
    .from("screenshot_reads")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay);
  return error ? null : count ?? 0;
}

async function logUsage(supabase: Supabase, userId: string, usage: AiReadUsage) {
  await supabase.from("screenshot_reads").insert({
    user_id: userId,
    model: usage.model,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cost_usd: usage.costUsd,
  });
}

/** Site-wide AI budget for the progress bar; `null` budget when AI reading is off. */
export async function GET(request: Request) {
  const player = await requestPlayer(request);
  if (!player) return failure(401, "unauthenticated");
  if (!aiReadAvailable()) return Response.json({ budget: null });
  return Response.json({ budget: await getAiBudget(player.supabase) });
}

export async function POST(request: Request) {
  const player = await requestPlayer(request);
  if (!player) return failure(401, "unauthenticated");
  const { supabase, userId } = player;
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

  const [budget, todayCount] = await Promise.all([getAiBudget(supabase), readsToday(supabase, userId)]);
  // No configured budget means no spending; the form falls back to OCR.
  if (!budget || budget.remainingReads < 1) return failure(503, "budget");
  if (todayCount === null) return failure(500, "error");
  if (todayCount >= DAILY_LIMIT) return failure(429, "limit");

  try {
    const { fields, usage } = await readScoreScreenshot(Buffer.from(await image.arrayBuffer()), image.type as AiImageType);
    await logUsage(supabase, userId, usage);
    return Response.json({ fields });
  } catch (error) {
    if (error instanceof AiReadError) {
      if (error.usage) await logUsage(supabase, userId, error.usage);
      return failure(error.code === "unavailable" ? 503 : 422, error.code);
    }
    if (error instanceof Anthropic.RateLimitError) return failure(429, "busy");
    if (error instanceof Anthropic.APIError) return failure(502, "upstream");
    return failure(500, "error");
  }
}
