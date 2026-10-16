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
