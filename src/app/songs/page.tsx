import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SearchForm } from "@/components/songs/search-form";
import { SongsPagination } from "@/components/songs/pagination";
import { SongRow } from "@/components/songs/song-row";
import type { SongWithCharts } from "@/components/songs/types";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 50;

const SONG_SELECT =
  "id, title, composer, song_type, bpm_min, bpm_max, is_available, game_series(name), stepcharts(step_type, level)";

function sanitizeQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 100).replace(/[,()*%\\]/g, "");
}

function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed =
    typeof value === "string" && value.trim() !== "" ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("songs");
  return { title: t("title") };
}

export default async function SongsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [t, common, params] = await Promise.all([
    getTranslations("songs"),
    getTranslations("common"),
    searchParams,
  ]);

  const query = sanitizeQuery(params.q);
  const requestedPage = parsePage(params.page);

  const supabase = await createClient();

  const buildQuery = (options: { count: "exact"; head?: true }) => {
    let builder = supabase.from("songs").select(SONG_SELECT, options);
    if (query) {
      builder = builder.or(
        `title.ilike.%${query}%,composer.ilike.%${query}%`,
      );
    }
    return builder
      .order("title", { ascending: true })
      .order("song_type", { ascending: true });
  };

  const { count, error: countError } = await buildQuery({
    count: "exact",
    head: true,
  });

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const { data, error: dataError } = await buildQuery({ count: "exact" }).range(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE - 1,
  );

  const songs = (data ?? []) as unknown as SongWithCharts[];
  const failed = Boolean(countError || dataError);

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:py-14">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-6">
        <SearchForm query={query} />
      </div>

      {failed ? (
        <p className="mt-8 text-destructive">{common("errors.generic")}</p>
      ) : (
        <>
          <p role="status" className="mt-6 text-sm text-muted-foreground">
            {t("resultsCount", { count: count ?? 0 })}
          </p>
          {songs.length === 0 ? (
            <p className="mt-8 text-muted-foreground">
              {t("noResults", { query })}
            </p>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {songs.map((song) => (
                <SongRow key={song.id} song={song} />
              ))}
            </ul>
          )}
          <div className="mt-8">
            <SongsPagination query={query} page={page} totalPages={totalPages} />
          </div>
        </>
      )}
    </div>
  );
}
