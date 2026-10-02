"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeSongSearchQuery } from "@/lib/songs/search";
import { createClient } from "@/lib/supabase/client";

import type { SongOption } from "./types";

export function SongChartPicker({
  initialSong,
  selectedChartId,
  onChartChange,
  error,
  ocrTitle,
  ocrStepType,
  ocrLevel,
}: {
  initialSong: SongOption | null;
  selectedChartId: number;
  onChartChange: (chartId: number, source?: "ocr") => void;
  error?: string;
  ocrTitle?: string;
  ocrStepType?: "SINGLE" | "DOUBLE" | "HALFDOUBLE";
  ocrLevel?: number;
}) {
  const t = useTranslations("scores");
  const [song, setSong] = useState<SongOption | null>(initialSong);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SongOption[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [ocrMatchedSong, setOcrMatchedSong] = useState(false);
  const [ocrMatchedChartId, setOcrMatchedChartId] = useState<number | null>(null);
  const matchRequest = useRef(0);
  const hasManualSelection = useRef(false);
  const onChartChangeRef = useRef(onChartChange);

  useEffect(() => {
    onChartChangeRef.current = onChartChange;
  }, [onChartChange]);

  useEffect(() => {
    if (!ocrTitle || initialSong || hasManualSelection.current) return;
    const requestedTitle = ocrTitle;
    const sanitized = sanitizeSongSearchQuery(requestedTitle).replace(/_/g, "");
    if (!sanitized) return;
    const request = ++matchRequest.current;
    const normalize = (value: string) => value.normalize("NFKD").replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase("en");

    async function matchTitle() {
      const { data, error: requestError } = await createClient()
        .from("songs")
        .select("id, title, composer, stepcharts(id, step_type, level)")
        .ilike("title", `${sanitized}%`)
        .order("title", { ascending: true })
        .limit(20);
      if (request !== matchRequest.current || requestError) return;
      const requestedNormalized = normalize(requestedTitle);
      const allSongs = (data ?? []) as unknown as SongOption[];
      const exact = allSongs.filter((candidate) => normalize(candidate.title) === requestedNormalized);
      const candidates = exact.length > 0
        ? exact
        : requestedNormalized.length >= 6
          ? allSongs.filter((candidate) => normalize(candidate.title).startsWith(requestedNormalized))
          : [];
      if (candidates.length !== 1) return;
      const match = candidates[0];
      setSong(match);
      setOcrMatchedSong(true);
      const chartMatches = match.stepcharts.filter((chart) =>
        chart.step_type === ocrStepType && chart.level === ocrLevel,
      );
      if (chartMatches.length === 1) {
        setOcrMatchedChartId(chartMatches[0].id);
        onChartChangeRef.current(chartMatches[0].id, "ocr");
      }
    }

    void matchTitle();
    return () => {
      matchRequest.current += 1;
    };
  }, [initialSong, ocrLevel, ocrStepType, ocrTitle]);

  async function searchSongs() {
    const sanitized = sanitizeSongSearchQuery(query);
    setHasSearched(true);
    setSearchError(false);
    setResults([]);
    if (!sanitized) return;

    setIsSearching(true);
    const supabase = createClient();
    const { data, error: requestError } = await supabase
      .from("songs")
      .select("id, title, composer, stepcharts(id, step_type, level)")
      .or(`title.ilike.%${sanitized}%,composer.ilike.%${sanitized}%`)
      .order("title", { ascending: true })
      .limit(10);
    setIsSearching(false);

    if (requestError) {
      setSearchError(true);
      return;
    }

    setResults((data ?? []) as unknown as SongOption[]);
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void searchSongs();
    }
  }

  function chooseSong(option: SongOption) {
    hasManualSelection.current = true;
    matchRequest.current += 1;
    setOcrMatchedSong(false);
    setOcrMatchedChartId(null);
    setSong(option);
    onChartChange(0);
    setResults([]);
    setHasSearched(false);
  }

  function chooseChart(chartId: number) {
    hasManualSelection.current = true;
    setOcrMatchedChartId(null);
    onChartChange(chartId);
  }

  const charts = [...(song?.stepcharts ?? [])].sort((a, b) => {
    const order = { SINGLE: 0, DOUBLE: 1, HALFDOUBLE: 2 };
    return order[a.step_type] - order[b.step_type] || a.level - b.level;
  });

  return (
    <section
      aria-labelledby="song-picker-heading"
      aria-describedby={error ? "chart-picker-error" : undefined}
      className="space-y-3"
    >
      <h2 id="song-picker-heading" className="font-display text-lg font-semibold">
        {t("picker.title")}
      </h2>
      <div role="search" aria-label={t("picker.title")} className="space-y-2">
        <Label htmlFor="song-picker-search">{t("picker.searchLabel")}</Label>
        <div className="flex gap-2">
          <Input
            id="song-picker-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={t("picker.searchPlaceholder")}
            autoComplete="off"
            aria-describedby={searchError ? "song-search-error" : undefined}
            aria-invalid={searchError || undefined}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => void searchSongs()}
            disabled={isSearching}
            className="shrink-0"
          >
            {isSearching ? t("picker.searching") : t("picker.search")}
          </Button>
        </div>
        {searchError ? (
          <p id="song-search-error" role="alert" className="text-sm text-destructive">
            {t("errors.generic")}
          </p>
        ) : null}
      </div>

      {hasSearched && !isSearching && !searchError ? (
        results.length > 0 ? (
          <ul className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-2">
            {results.map((result) => (
              <li key={result.id}>
                <button
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onClick={() => chooseSong(result)}
                >
                  <span className="block font-medium">{result.title}</span>
                  <span className="text-muted-foreground">{result.composer}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("picker.noResults")}</p>
        )
      ) : null}

      {song ? (
        <div className="space-y-3 rounded-lg border bg-card p-3">
          <div>
            <p className="font-medium">{song.title}</p>
            <p className="text-sm text-muted-foreground">{song.composer}</p>
            {ocrMatchedSong ? <p className="mt-1 text-xs text-muted-foreground">{t("fields.detectedSong")}</p> : null}
          </div>
          {charts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("picker.chooseChart")}</p>
              <div className="flex flex-wrap gap-2">
                {charts.map((chart) => {
                  const prefix = chart.step_type === "SINGLE"
                    ? "S"
                    : chart.step_type === "DOUBLE"
                      ? "D"
                      : "HD";
                  return (
                    <Button
                      key={chart.id}
                      type="button"
                      size="sm"
                      variant={selectedChartId === chart.id ? "default" : "outline"}
                      aria-pressed={selectedChartId === chart.id}
                      onClick={() => chooseChart(chart.id)}
                    >
                      {prefix}{chart.level}
                    </Button>
                  );
                })}
              </div>
              {ocrMatchedChartId ? <p className="text-xs text-muted-foreground">{t("fields.detectedChart")}</p> : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("picker.noCharts")}</p>
          )}
        </div>
      ) : null}

      {error ? (
        <p id="chart-picker-error" role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
