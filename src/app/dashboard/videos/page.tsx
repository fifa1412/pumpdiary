import type { Metadata } from "next";
import { ArrowDown, ArrowUp, ExternalLink } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";
import { SyncButton } from "@/components/videos/sync-button";
import { chartOn, VERSION_LEVELS, type VersionLevel } from "@/lib/songs/chart-levels";
import { songDisplayTitle } from "@/lib/songs/song-title";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { youtubeVideoId } from "@/lib/youtube/video-id";

const SORTS = {
  views: "youtube_views",
  likes: "youtube_likes",
  comments: "youtube_comments",
  uploaded: "youtube_published_at",
  played: "played_at",
} as const;
type Sort = keyof typeof SORTS;
type Direction = "asc" | "desc";

const STEP_CODES = { SINGLE: "S", DOUBLE: "D", HALFDOUBLE: "HD" } as const;

type VideoRow = {
  id: number;
  series_id: number;
  played_at: string;
  video_url: string | null;
  youtube_video_id: string | null;
  youtube_title: string | null;
  youtube_views: number | null;
  youtube_likes: number | null;
  youtube_comments: number | null;
  youtube_synced_at: string | null;
  youtube_published_at: string | null;
  series: { name: string } | null;
  stepchart: {
    step_type: keyof typeof STEP_CODES;
    level: number;
    levels: VersionLevel[];
    song: { title: string; song_type: string } | null;
  } | null;
};

/** Whole days from a past moment to now. The page renders per request, so "now" is the request time. */
function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
}

/** Column header that sorts by its column; a second press flips the direction. */
function SortHeader({ column, label, sortLabel, sort, dir, className }: {
  column: Sort; label: string; sortLabel: string; sort: Sort; dir: Direction; className?: string;
}) {
  const active = column === sort;
  const Arrow = dir === "asc" ? ArrowUp : ArrowDown;
  const next: Direction = active && dir === "desc" ? "asc" : "desc";
  return (
    <th scope="col" className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={`/dashboard/videos?sort=${column}&dir=${next}`} aria-label={sortLabel}
        className="inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        {label}
        {active ? <Arrow aria-hidden="true" className="size-3.5" /> : null}
      </Link>
    </th>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("videos");
  return { title: t("title") };
}

export default async function VideoDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string | string[]; dir?: string | string[] }>;
}) {
  const [user, params, t, tc, locale] = await Promise.all([
    getCurrentUser(), searchParams, getTranslations("videos"), getTranslations("common"), getLocale(),
  ]);
  if (!user) redirect("/login");

  const rawSort = Array.isArray(params.sort) ? params.sort[0] : params.sort;
  const sort: Sort = rawSort && rawSort in SORTS ? (rawSort as Sort) : "views";
  const rawDir = Array.isArray(params.dir) ? params.dir[0] : params.dir;
  const dir: Direction = rawDir === "asc" ? "asc" : "desc";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("scores")
    .select(`id, series_id, played_at, video_url, youtube_video_id, youtube_title, youtube_views, youtube_likes, youtube_comments, youtube_synced_at, youtube_published_at, series:game_series(name), stepchart:stepcharts!scores_stepchart_id_fkey(step_type, level, ${VERSION_LEVELS}, song:songs!stepcharts_song_id_fkey(title, song_type))`)
    .eq("user_id", user.id)
    .or("youtube_video_id.not.is.null,video_url.neq.")
    // Clips with no number yet go last either way. More days online means an
    // earlier upload, so that column runs the other way round.
    .order(SORTS[sort], { ascending: (dir === "asc") !== (sort === "uploaded"), nullsFirst: false })
    .order("played_at", { ascending: false });
  const rows = ((data ?? []) as unknown as VideoRow[]).flatMap((row) => {
    const videoId = row.youtube_video_id || (row.video_url ? youtubeVideoId(row.video_url) : null);
    if (!videoId) return [];
    const chart = row.stepchart && chartOn(row.stepchart, row.series_id);
    const song = chart?.song ? `${songDisplayTitle(chart.song.title, chart.song.song_type)} ${STEP_CODES[chart.step_type]}${chart.level}` : "";
    return [{ ...row, videoId, song, notFound: Boolean(row.youtube_synced_at) && row.youtube_views === null }];
  });

  const lastSynced = rows.reduce<string | null>((latest, row) =>
    row.youtube_synced_at && (!latest || row.youtube_synced_at > latest) ? row.youtube_synced_at : latest, null);
  const total = (key: "youtube_views" | "youtube_likes" | "youtube_comments") =>
    rows.reduce((sum, row) => sum + (row[key] ?? 0), 0);
  const number = (value: number | null) => (value === null ? "–" : value.toLocaleString(locale));
  const daysOnline = (publishedAt: string | null) =>
    publishedAt ? t("daysOnline", { days: daysSince(publishedAt) }) : "–";

  const columns = [
    { sort: "views", label: t("columns.views") },
    { sort: "likes", label: t("columns.likes") },
    { sort: "comments", label: t("columns.comments") },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-5 px-4 py-10 sm:py-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
          <p className="text-xs text-muted-foreground">
            {t("clipCount", { count: rows.length })}
            {" · "}
            {lastSynced
              ? t("lastSynced", { date: new Date(lastSynced).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) })
              : t("neverSynced")}
          </p>
        </div>
        {rows.length > 0 ? (
          <div className="flex flex-wrap items-center gap-4">
            <dl aria-label={t("total")} className="grid grid-cols-3 gap-2">
              {columns.map((column) => (
                <div key={column.sort} className="min-w-24 rounded-[3px] border bg-card px-3 py-2 text-right">
                  <dt className="text-xs text-muted-foreground">{column.label}</dt>
                  <dd className="font-numeric text-xl font-semibold tabular-nums">
                    {number(lastSynced ? total(SORTS[column.sort]) : null)}
                  </dd>
                </div>
              ))}
            </dl>
            <SyncButton />
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">{tc("errors.generic")}</p>
      ) : rows.length === 0 ? (
        <Card><CardContent className="pt-6"><p className="text-muted-foreground">{t("empty")}</p></CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-[3px] border">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="bg-surface-deep text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">{t("columns.clip")}</th>
                {columns.map((column) => (
                  <SortHeader key={column.sort} column={column.sort} label={column.label} sortLabel={t("sortBy", { column: column.label })}
                    sort={sort} dir={dir} className="px-4 py-3 text-right" />
                ))}
                <SortHeader column="uploaded" label={t("columns.uploaded")} sortLabel={t("sortBy", { column: t("columns.uploaded") })}
                  sort={sort} dir={dir} className="px-4 py-3 text-right" />
                <SortHeader column="played" label={t("columns.played")} sortLabel={t("sortBy", { column: t("columns.played") })}
                  sort={sort} dir={dir} className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="max-w-md px-4 py-3">
                    <a href={`https://www.youtube.com/watch?v=${row.videoId}`} target="_blank" rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                      <span className="truncate">{row.youtube_title || row.song}</span>
                      <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" />
                      <span className="sr-only">{t("watch")}</span>
                    </a>
                    <Link href={`/scores/${row.id}`} className="block truncate text-xs text-muted-foreground hover:text-foreground">
                      {[row.song, row.series?.name].filter(Boolean).join(" · ")}
                    </Link>
                    {row.notFound ? <p className="text-xs text-destructive">{t("notFound")}</p> : null}
                  </td>
                  <td className="px-4 py-3 text-right font-numeric tabular-nums">{number(row.youtube_views)}</td>
                  <td className="px-4 py-3 text-right font-numeric tabular-nums">{number(row.youtube_likes)}</td>
                  <td className="px-4 py-3 text-right font-numeric tabular-nums">{number(row.youtube_comments)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-numeric tabular-nums">{daysOnline(row.youtube_published_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {new Date(row.played_at).toLocaleDateString(locale, { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
