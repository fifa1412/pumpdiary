import type { SupabaseClient } from "@supabase/supabase-js";

import { SCORE_GRADES } from "@/components/scores/types";

// Game versions a score can be logged on. Each row of game_series with
// score_rules set is one; the rules decide the score cap, grades, and plates.
//   phoenix: Phoenix and Phoenix 2. Out of 1,000,000, full grade ladder, plates.
//   classic: XX and Prime. No 1,000,000 cap, SSS..F grades, no plates.

export type ScoreRules = "phoenix" | "classic";

export type GameVersion = { id: number; name: string; rules: ScoreRules };

/** game_series name of the version new scores start on. */
export const DEFAULT_GAME_VERSION = "Phoenix 2";

/** Highest score each rule set accepts; the database checks the same limits. */
export const MAX_SCORE: Record<ScoreRules, number> = { phoenix: 1_000_000, classic: 99_999_999 };

export const CLASSIC_GRADES = ["SSS", "SS", "S", "A", "B", "C", "D", "F"] as const satisfies readonly (typeof SCORE_GRADES)[number][];

export function gradesFor(rules: ScoreRules): readonly (typeof SCORE_GRADES)[number][] {
  return rules === "classic" ? CLASSIC_GRADES : SCORE_GRADES;
}

type ScoreGrade = (typeof SCORE_GRADES)[number];

// Lowest score for each grade, best grade first. Phoenix 2 raised every cutoff
// below AAA; its B, C and D cutoffs are community figures, not official ones.
// XX and Prime grade on judgments, not on the score, so they have none.
const PHOENIX_TOP: [number, ScoreGrade][] = [
  [995_000, "SSS+"], [990_000, "SSS"], [985_000, "SS+"], [980_000, "SS"],
  [975_000, "S+"], [970_000, "S"], [960_000, "AAA+"], [950_000, "AAA"],
];
const GRADE_CUTOFFS: Record<string, [number, ScoreGrade][]> = {
  "Phoenix 2": [
    ...PHOENIX_TOP,
    [940_000, "AA+"], [920_000, "AA"], [900_000, "A+"], [800_000, "A"],
    [700_000, "B"], [600_000, "C"], [500_000, "D"], [0, "F"],
  ],
  Phoenix: [
    ...PHOENIX_TOP,
    [925_000, "AA+"], [900_000, "AA"], [825_000, "A+"], [750_000, "A"],
    [700_000, "B"], [600_000, "C"], [450_000, "D"], [0, "F"],
  ],
};

/** Whether a version's grade follows from the score alone. */
export function gradesFromScore(version: string): boolean {
  return version in GRADE_CUTOFFS;
}

/** The grade a score earns on a version (game_series name), or null when the version or score gives none. */
export function gradeFromScore(score: number, version: string): ScoreGrade | null {
  const cutoffs = GRADE_CUTOFFS[version];
  if (!cutoffs || !Number.isInteger(score) || score < 0 || score > MAX_SCORE.phoenix) return null;
  return cutoffs.find(([cutoff]) => score >= cutoff)![1];
}

/** "Phoenix 2" -> "PIU Phoenix 2", "Prime" -> "PIU Prime". Game terms, so the same in every locale. */
export function gameVersionLabel(name: string): string {
  return `PIU ${name}`;
}

// Each version has its own colour wherever it is shown. Full class names so Tailwind picks them up.
const TONES: Record<string, { text: string; fill: string; border: string }> = {
  "Phoenix 2": { text: "text-version-phoenix-2", fill: "bg-version-phoenix-2 border-version-phoenix-2", border: "border-version-phoenix-2" },
  Phoenix: { text: "text-version-phoenix", fill: "bg-version-phoenix border-version-phoenix", border: "border-version-phoenix" },
  XX: { text: "text-version-xx", fill: "bg-version-xx border-version-xx", border: "border-version-xx" },
  Prime: { text: "text-version-prime", fill: "bg-version-prime border-version-prime", border: "border-version-prime" },
};
const NEUTRAL_TONE = { text: "text-muted-foreground", fill: "bg-muted border-muted", border: "border-border" };

/** Colour classes for a version: `text` for labels, `fill` for a filled chip (pair with text-version-foreground), `border` for an outline. */
export function gameVersionTone(name: string): { text: string; fill: string; border: string } {
  return TONES[name] ?? NEUTRAL_TONE;
}

/** Versions that take scores, newest first. */
export async function fetchGameVersions(supabase: SupabaseClient): Promise<GameVersion[]> {
  const { data } = await supabase
    .from("game_series")
    .select("id, name, score_rules")
    .not("score_rules", "is", null)
    .order("sort_order", { ascending: false });
  const rows = (data ?? []) as { id: number; name: string; score_rules: string | null }[];
  return rows.flatMap(({ id, name, score_rules: rules }) =>
    rules === "phoenix" || rules === "classic" ? [{ id, name, rules }] : []);
}

/** The version a ?version= search param names, falling back to the default version. */
export function pickGameVersion(versions: GameVersion[], raw: string | string[] | undefined): GameVersion | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return versions.find((version) => String(version.id) === value)
    ?? versions.find((version) => version.name === DEFAULT_GAME_VERSION)
    ?? versions[0];
}
