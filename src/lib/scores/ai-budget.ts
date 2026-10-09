import "server-only";

import type { createClient } from "@/lib/supabase/server";

// The AI reader's budget is the prepaid Claude credit, set by hand in
// AI_CREDIT_USD and raised after each top-up. Spend is what this site has
// logged in screenshot_reads, so it drifts from the real balance if the same
// API key is used elsewhere.

// Used until there are real reads to average over.
const ESTIMATED_COST_USD = 0.0005;

export type AiBudget = {
  budgetUsd: number;
  spentUsd: number;
  remainingUsd: number;
  remainingReads: number;
};

export function aiCreditUsd(): number | null {
  const value = Number(process.env.AI_CREDIT_USD);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function getAiBudget(supabase: Awaited<ReturnType<typeof createClient>>): Promise<AiBudget | null> {
  const budgetUsd = aiCreditUsd();
  if (budgetUsd === null) return null;
  const { data, error } = await supabase.rpc("ai_read_totals").single<{ read_count: number | string; spent_usd: number | string }>();
  if (error || !data) return null;
  const readCount = Number(data.read_count);
  const spentUsd = Number(data.spent_usd);
  const averageCost = readCount > 0 && spentUsd > 0 ? spentUsd / readCount : ESTIMATED_COST_USD;
  const remainingUsd = Math.max(0, budgetUsd - spentUsd);
  return { budgetUsd, spentUsd, remainingUsd, remainingReads: Math.floor(remainingUsd / averageCost) };
}
