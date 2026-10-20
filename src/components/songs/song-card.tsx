import Image from "next/image";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { playableCharts } from "@/lib/songs/charts";
import { jacketUrl } from "@/lib/songs/jackets";
import { songDisplayTitle } from "@/lib/songs/song-title";
import { ChartBadges } from "./chart-badges";
import type { SongWithCharts } from "./types";

export async function SongCard({ song }: { song: SongWithCharts }) {
  const t = await getTranslations("songs");
  const charts = playableCharts(song.stepcharts, song.is_available);

  const bpm =
    song.bpm_min === song.bpm_max
      ? song.bpm_min
      : `${song.bpm_min}\u2013${song.bpm_max}`;

  return (
    <li className="flex h-full min-h-56 flex-col rounded-[3px] border border-border border-t-[3px] border-t-primary bg-card p-4 transition-colors hover:border-primary/40">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <h2
          title={songDisplayTitle(song.title, song.song_type)}
          className="line-clamp-2 font-display text-lg font-semibold leading-tight"
        >
          {songDisplayTitle(song.title, song.song_type)}
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
        <span className="font-numeric tabular-nums">{t("bpm", { bpm })}</span>
        {song.game_series && (
          <>
            <span aria-hidden> · </span>
            {t("debut", { series: song.game_series.name })}
          </>
        )}
      </p>
      {song.jacket_path && (
        <div className="relative mt-3 aspect-[4/3] w-full overflow-hidden rounded-[3px] border border-border bg-muted">
          <Image
            src={jacketUrl(song.jacket_path)}
            alt=""
            fill
            unoptimized
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      )}
      {charts.length > 0 && (
        <div className="mt-auto pt-3">
          <ChartBadges
            charts={charts}
            label={t("chartsLabel")}
          />
        </div>
      )}
    </li>
  );
}
