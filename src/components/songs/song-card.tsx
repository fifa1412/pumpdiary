import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { ChartBadges } from "./chart-badges";
import type { SongWithCharts } from "./types";

export async function SongCard({ song }: { song: SongWithCharts }) {
  const t = await getTranslations("songs");

  const bpm =
    song.bpm_min === song.bpm_max
      ? song.bpm_min
      : `${song.bpm_min}\u2013${song.bpm_max}`;

  return (
    <li className="flex h-full min-h-56 flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2
          title={song.title}
          className="line-clamp-2 font-display text-lg font-semibold leading-tight"
        >
          {song.title}
        </h2>
        <Badge variant="outline" className="shrink-0">
          {t(`types.${song.song_type}`)}
        </Badge>
      </div>
      {!song.is_available && (
        <div className="mt-1.5">
          <Badge variant="secondary" className="text-muted-foreground">
            {t("removed")}
          </Badge>
        </div>
      )}
      <p className="mt-2 truncate text-sm text-muted-foreground">
        {song.composer}
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {t("bpm", { bpm })}
        {song.game_series && (
          <>
            <span aria-hidden> · </span>
            {t("debut", { series: song.game_series.name })}
          </>
        )}
      </p>
      {song.stepcharts.length > 0 && (
        <div className="mt-auto pt-3">
          <ChartBadges charts={song.stepcharts} label={t("chartsLabel")} />
        </div>
      )}
    </li>
  );
}
