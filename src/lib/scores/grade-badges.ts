import { DEFAULT_GAME_VERSION } from "@/lib/scores/game-versions";

const GRADE_BADGE_BUCKET = "grade-badges";

// Grades a game version has an image for, in <folder>/<grade>.webp with "+"
// spelled "-plus" (uploaded by scripts/import-grade-badges/upload_grade_badges.mjs).
const VERSION_GRADES: Record<string, { folder: string; grades: readonly string[] }> = {
  "Phoenix 2": {
    folder: "phoenix2",
    grades: ["SSS+", "SSS", "SS+", "SS", "S+", "S", "AAA+", "AAA", "AA+", "AA", "A+", "A"],
  },
  Phoenix: {
    folder: "phoenix",
    grades: ["SSS+", "SSS", "SS+", "SS", "S+", "S", "AAA+", "AAA", "AA+", "AA", "A+", "A"],
  },
};

/**
 * Public URL of the grade image on a game version (game_series name, Phoenix 2
 * when left out), or null when that version has no image for the grade.
 */
export function gradeBadgeUrl(grade: string, version: string = DEFAULT_GAME_VERSION): string | null {
  const own = VERSION_GRADES[version];
  if (!own?.grades.includes(grade)) return null;
  const file = `${own.folder}/${grade.toLowerCase().replace("+", "-plus")}.webp`;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${GRADE_BADGE_BUCKET}/${file}`;
}
