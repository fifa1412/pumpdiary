import type { SongChart } from "@/components/songs/types";

export type SongOption = {
  id: number;
  title: string;
  composer: string;
  is_available: boolean;
  stepcharts: SongChart[];
};

export const SCORE_GRADES = [
  "SSS+", "SSS", "SS+", "SS", "S+", "S", "AAA+", "AAA",
  "AA+", "AA", "A+", "A", "B", "C", "D", "F",
] as const;

export const SCORE_PLATES = [
  "PERFECT GAME", "ULTIMATE GAME", "EXTREME GAME", "SUPERB GAME",
  "MARVELOUS GAME", "TALENTED GAME", "FAIR GAME", "ROUGH GAME",
] as const;
