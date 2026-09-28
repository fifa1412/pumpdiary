import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { ChartBadges } from "./chart-badges";
import type { SongWithCharts } from "./types";

export async function SongRow({ song }: { song: SongWithCharts }) {
  const t = await getTranslations("songs");

  const bpm =
    song.bpm_min === song.bpm_max
      ? song.bpm_min
      : `${song.bpm_min}\u2013${song.bpm_max}`;

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2 className="font-display text-lg font-semibold leading-tight">
          {song.title}
        </h2>
        <Badge variant="outline">{t(`types.${song.song_type}`)}</Badge>
        {!song.is_available && (
          <Badge variant="secondary" className="text-muted-foreground">
            {t("removed")}
          </Badge>
        )}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {song.composer}
        <span aria-hidden> · </span>
        {t("bpm", { bpm })}
        {song.game_series && (
          <>
            <span aria-hidden> · </span>
            {t("debut", { series: song.game_series.name })}
          </>
        )}
      </p>
      {song.stepcharts.length > 0 && (
        <div className="mt-3">
          <ChartBadges charts={song.stepcharts} label={t("chartsLabel")} />
        </div>
      )}
    </li>
  );
}
