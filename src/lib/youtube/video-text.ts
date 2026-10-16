// Title and description suggested for a play video uploaded to YouTube, e.g.
//   [PIU Phoenix 2] Odin S20 - Score 99.54%
//   [PIU Phoenix] [Full Song] MEGAHEARTZ S23 - Score 93.97%
//
//   Odin S20 : 1 Miss - Score 995,416 (SSS)
//   Perfect 1,227 / Great 5 / Good 1 / Bad 0 / Miss 1 / Max Combo 859
//   Record Date : 2026-10-03 @ Let's Play MBK Center (Thailand)
//   Player : FIFAZ
// The text is always English so every upload reads the same on YouTube.
// The game version ("PIU Phoenix 2" above) follows the version picked for the score.

import { DEFAULT_GAME_VERSION, gameVersionLabel } from "@/lib/scores/game-versions";

function titleVersion(version: string): string {
  return `[${gameVersionLabel(version)}]`;
}

// Added to every upload. The Thai tag is escaped because src/ holds no Thai text.
function gameTags(series: string): string[] {
  const version = gameVersionLabel(series);
  const name = version.replace(/^PIU /, "");
  return [
    "Pump It Up", "PIU", "pumpitup",
    `Pump It Up ${name}`, version, name,
    "\uD38C\uD504\uC787\uC5C5",
    "gameplay", "rhythm game", "dance game", "arcade", "\u0E40\u0E01\u0E21\u0E40\u0E15\u0E49\u0E19",
  ];
}

const STEP_TYPE_NAMES = { SINGLE: "Single", DOUBLE: "Double", HALFDOUBLE: "Half-Double" } as const;
const STEP_TYPE_CODES = { SINGLE: "S", DOUBLE: "D", HALFDOUBLE: "HD" } as const;
// Remix, Full Song, and Shortcut charts are marked in the title; normal songs are not.
const SONG_TYPE_TAGS = { NORMAL: "", REMIX: "[Remix]", FULLSONG: "[Full Song]", SHORTCUT: "[Shortcut]" } as const;

export type SongType = keyof typeof SONG_TYPE_TAGS;

export type VideoTextInput = {
  /** game_series name such as "XX"; Phoenix 2 when left out. */
  version?: string;
  /** XX and Prime scores have no 1,000,000 cap, so the title shows the score instead of a percentage. */
  uncappedScore?: boolean;
  chart: string;
  song?: { title: string; songType?: SongType; stepType: keyof typeof STEP_TYPE_NAMES; level: number };
  score?: number;
  grade?: string;
  judgments: { perfect?: number; great?: number; good?: number; bad?: number; miss?: number; maxCombo?: number };
  recordDate?: string;
  cabinet?: { name: string; country: string } | null;
  /** In-game player name read from the screenshot; the Player line is left out without it. */
  player?: string;
};

function count(value: number): string {
  return value.toLocaleString("en-US");
}

function isCount(value: number | undefined): value is number {
  return Number.isInteger(value);
}

/** 939720 -> "93.97"; truncated so a near-perfect score never shows as 100.00. */
export function scorePercent(score: number): string {
  return (Math.floor(score / 100) / 100).toFixed(2);
}

function missText(miss: number): string {
  return miss === 0 ? "ALL COMBO" : `${count(miss)} Miss`;
}

export function videoTitle({ version = DEFAULT_GAME_VERSION, uncappedScore, chart, song, score }: VideoTextInput): string {
  const result = isCount(score) ? ` - Score ${uncappedScore ? score : `${scorePercent(score)}%`}` : "";
  const songType = song?.songType ? SONG_TYPE_TAGS[song.songType] : "";
  return `${[titleVersion(version), songType, chart].filter(Boolean).join(" ")}${result}`;
}

/** One playlist per version and chart level, e.g. "PIU Phoenix 2 - Single Lv. 20". */
export function playlistTitle({ version = DEFAULT_GAME_VERSION, song }: VideoTextInput): string {
  const label = gameVersionLabel(version);
  return song ? `${label} - ${STEP_TYPE_NAMES[song.stepType]} Lv. ${song.level}` : label;
}

/** Song title, chart level tags, then the game tags. */
export function videoTags({ version = DEFAULT_GAME_VERSION, song }: VideoTextInput): string[] {
  const chartTags = song
    ? [
      song.title,
      `${STEP_TYPE_CODES[song.stepType]}${song.level}`,
      `${STEP_TYPE_NAMES[song.stepType]} ${song.level}`,
      `PIU ${STEP_TYPE_CODES[song.stepType]}${song.level}`,
    ]
    : [];
  return [...chartTags, ...gameTags(version)];
}

/** A title written for one version, moved to another: "[PIU Phoenix 2] Odin S20" -> "[PIU Phoenix] Odin S20". */
export function switchTitleVersion(text: string, from: string, to: string): string {
  return from === to ? text : text.replaceAll(titleVersion(from), titleVersion(to));
}

/**
 * A playlist name written for one version, moved to another: "PIU Phoenix 2 - Single Lv. 20" -> "PIU XX - Single Lv. 20".
 * Only the leading version is swapped, so "PIU Phoenix" never matches inside "PIU Phoenix 2".
 */
export function switchPlaylistVersion(text: string, from: string, to: string): string {
  const fromLabel = gameVersionLabel(from);
  const toLabel = gameVersionLabel(to);
  if (from === to) return text;
  if (text === fromLabel) return toLabel;
  return text.startsWith(`${fromLabel} - `) ? `${toLabel}${text.slice(fromLabel.length)}` : text;
}

/** Swaps the game tags of one version for another's and keeps every other tag. */
export function switchVersionTags(tags: string[], from: string, to: string): string[] {
  if (from === to) return tags;
  const fromTags = gameTags(from).map((tag) => tag.toLocaleLowerCase());
  const toTags = gameTags(to);
  const seen = new Set<string>();
  return tags.flatMap((tag) => {
    const index = fromTags.indexOf(tag.toLocaleLowerCase());
    const next = index >= 0 ? toTags[index] : tag;
    const key = next.toLocaleLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [next];
  });
}

export function videoDescription({ chart, score, grade, judgments, recordDate, cabinet, player }: VideoTextInput): string {
  const hasScore = isCount(score);
  const result = hasScore
    ? [isCount(judgments.miss) ? missText(judgments.miss) : "", `Score ${count(score)}${grade ? ` (${grade})` : ""}`]
      .filter(Boolean).join(" - ")
    : "";
  const counts = hasScore
    ? ([
      ["Perfect", judgments.perfect], ["Great", judgments.great], ["Good", judgments.good],
      ["Bad", judgments.bad], ["Miss", judgments.miss], ["Max Combo", judgments.maxCombo],
    ] satisfies [string, number | undefined][])
      .flatMap(([label, value]) => (isCount(value) ? [`${label} ${count(value)}`] : []))
      .join(" / ")
    : "";
  const record = recordDate
    ? `Record Date : ${recordDate}${cabinet ? ` @ ${cabinet.name} (${cabinet.country})` : ""}`
    : "";
  return [
    [chart, result].filter(Boolean).join(" : "),
    counts,
    record,
    player ? `Player : ${player}` : "",
  ].filter(Boolean).join("\n");
}
