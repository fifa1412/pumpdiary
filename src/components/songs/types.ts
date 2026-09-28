export const SONG_TYPES = ["NORMAL", "REMIX", "FULLSONG", "SHORTCUT"] as const;
export type SongType = (typeof SONG_TYPES)[number];

export const STEP_TYPES = ["SINGLE", "DOUBLE", "HALFDOUBLE"] as const;
export type StepType = (typeof STEP_TYPES)[number];

export type SongChart = {
  step_type: StepType;
  level: number;
};

export type SongWithCharts = {
  id: number;
  title: string;
  composer: string;
  song_type: SongType;
  bpm_min: number;
  bpm_max: number;
  is_available: boolean;
  game_series: { name: string } | null;
  stepcharts: SongChart[];
};
