import type { StepType } from "@/components/songs/types";
import { DEFAULT_GAME_VERSION } from "@/lib/scores/game-versions";

const LEVEL_BADGE_BUCKET = "level-badges";

// Highest level each step type has a badge image for (level-badges bucket).
// These are the Phoenix badges, used for every version unless it has its own.
const MAX_BADGE_LEVEL: Partial<Record<StepType, number>> = {
  SINGLE: 26,
  DOUBLE: 29,
};

// Levels a game version has its own badge for, in <folder>/<step type>/NN.webp
// (uploaded by scripts/import-level-badges/upload_version_badges.mjs). Other
// levels fall back to the Phoenix badges.
const VERSION_BADGES: Record<string, { folder: string; levels: Partial<Record<StepType, readonly number[]>> }> = {
  "Phoenix 2": { folder: "phoenix2", levels: { SINGLE: [20, 21, 22, 23] } },
};

/**
 * Public URL of the badge image for a chart level on a game version (game_series
 * name, Phoenix 2 when left out), or null when there is none.
 */
export function levelBadgeUrl(stepType: StepType, level: number, version: string = DEFAULT_GAME_VERSION): string | null {
  if (!Number.isInteger(level) || level < 1) return null;
  const file = `${stepType.toLowerCase()}/${String(level).padStart(2, "0")}.webp`;
  const own = VERSION_BADGES[version];
  if (own?.levels[stepType]?.includes(level)) return badgeUrl(`${own.folder}/${file}`);
  const max = MAX_BADGE_LEVEL[stepType];
  return max && level <= max ? badgeUrl(file) : null;
}

function badgeUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${LEVEL_BADGE_BUCKET}/${path}`;
}
