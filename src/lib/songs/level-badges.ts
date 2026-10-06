import type { StepType } from "@/components/songs/types";

const LEVEL_BADGE_BUCKET = "level-badges";

// Highest level each step type has a badge image for (level-badges bucket).
const MAX_BADGE_LEVEL: Partial<Record<StepType, number>> = {
  SINGLE: 26,
  DOUBLE: 29,
};

/** Public URL of the badge image for a chart level, or null when there is none. */
export function levelBadgeUrl(stepType: StepType, level: number): string | null {
  const max = MAX_BADGE_LEVEL[stepType];
  if (!max || !Number.isInteger(level) || level < 1 || level > max) return null;
  const path = `${stepType.toLowerCase()}/${String(level).padStart(2, "0")}.webp`;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LEVEL_BADGE_BUCKET}/${path}`;
}
