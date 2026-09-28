#!/usr/bin/env python3
# Usage: python3 scripts/import-songs/build_seed.py
# Downloads the three pinned source files, maps them to the PumpDiary schema,
# applies the Phoenix 2 rerates and de-duplication, and writes:
#   - supabase/seed/0002_songs.sql
#   - scripts/import-songs/report.md
# Python 3 standard library only. Deterministic: running it twice produces
# byte-identical output. Stops with a non-zero exit code when the data does
# not fit the mapping rules.
import csv
import io
import json
import re
import sys
import urllib.request
from collections import Counter
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
SQL_PATH = REPO_ROOT / "supabase" / "seed" / "0002_songs.sql"
REPORT_PATH = SCRIPT_DIR / "report.md"
SERIES_SEED_PATH = REPO_ROOT / "supabase" / "seed" / "0001_game_series.sql"

BASE_URL = (
    "https://raw.githubusercontent.com/pugkung/piutool/"
    "f87a2b7b334411d0d6c63c264bb97e3e293ecb3d/src/assets/data/songlist_phoenix.json"
)
REMOVED_URL = (
    "https://raw.githubusercontent.com/joshua-fonseca/pump-it-up-difficulty-matcher/"
    "a990542efa2eca7ea5f71bb1338757bbaf42c487/data/json/removed_songs.json"
)
RERATES_URL = (
    "https://raw.githubusercontent.com/joshua-fonseca/pump-it-up-difficulty-matcher/"
    "a990542efa2eca7ea5f71bb1338757bbaf42c487/data/csv/piu_rerates.csv"
)

SOURCE_LINES = [
    "Base song list: pugkung/piutool @ f87a2b7b334411d0d6c63c264bb97e3e293ecb3d, "
    "src/assets/data/songlist_phoenix.json (MIT, Copyright (c) 2018 pugkung)",
    "Phoenix 2 removals: joshua-fonseca/pump-it-up-difficulty-matcher @ a990542efa2eca7ea5f71bb1338757bbaf42c487, "
    "data/json/removed_songs.json (MIT, Copyright (c) 2026 kkura)",
    "Phoenix 2 rerates: joshua-fonseca/pump-it-up-difficulty-matcher @ a990542efa2eca7ea5f71bb1338757bbaf42c487, "
    "data/csv/piu_rerates.csv (MIT, Copyright (c) 2026 kkura)",
]

SONG_TYPE_MAP = {
    "arcade": "NORMAL",
    "remix": "REMIX",
    "fullsong": "FULLSONG",
    "shortcut": "SHORTCUT",
}

VERSION_MAP = {
    "1st": "The 1st Dance Floor",
    "2nd": "2nd Ultimate Remix",
    "3rd": "3rd O.B.G",
    "3rdSE": "The O.B.G: Season Evolution",
    "PerfectCollection": "The Perfect Collection",
    "Extra": "Extra",
    "Rebirth": "The Rebirth",
    "Premiere3": "The Premiere 3",
    "Prex3": "The Prex 3",
    "Exceed": "Exceed",
    "Exceed2": "Exceed 2",
    "Zero": "Zero",
    "NX": "NX (New Xenesis)",
    "NX2": "NX2 (Next Xenesis)",
    "NXA": "NX Absolute",
    "Fiesta": "Fiesta",
    "FiestaEX": "Fiesta EX",
    "Fiesta2": "Fiesta 2",
    "Prime": "Prime",
    "Prime2": "Prime 2",
    "XX": "XX",
    "phoenix": "Phoenix",
    "phoenix2": "Phoenix 2",
}

CHART_TYPE_MAP = {
    "single": "SINGLE",
    "double": "DOUBLE",
    "halfdouble": "HALFDOUBLE",
}


def fail(message):
    print(f"build_seed.py: {message}", file=sys.stderr)
    sys.exit(1)


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": "pumpdiary-seed-builder"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read().decode("utf-8")


def parse_removed(text):
    data = json.loads(text)
    if not isinstance(data, list):
        fail("removed_songs.json: expected a list of {songID, note} objects")
    ids = set()
    for item in data:
        if not isinstance(item, dict) or "songID" not in item:
            fail(f"removed_songs.json: entry without songID: {item!r}")
        ids.add(str(item["songID"]))
    return ids


def parse_base(text, removed_ids):
    data = json.loads(text)
    entries = data.get("songlist")
    if not isinstance(entries, list):
        fail("songlist_phoenix.json: missing 'songlist' array")
    songs = []
    coop_skipped = 0
    for index, entry in enumerate(entries):
        label = f"songlist entry {index} (songID={entry.get('songID')!r})"
        title = str(entry.get("songName") or "").strip()
        composer = str(entry.get("artist") or "").strip()
        if not title:
            fail(f"{label}: empty songName")
        if not composer:
            fail(f"{label}: empty artist")
        song_type = SONG_TYPE_MAP.get(entry.get("songType"))
        if song_type is None:
            fail(f"{label} ({title!r}): unknown songType {entry.get('songType')!r}")
        series = VERSION_MAP.get(entry.get("version"))
        if series is None:
            fail(f"{label} ({title!r}): unknown version {entry.get('version')!r}")

        bpm = entry.get("bpm")
        if isinstance(bpm, list):
            if len(bpm) != 2 or not all(
                isinstance(x, (int, float)) and not isinstance(x, bool) for x in bpm
            ):
                fail(f"{label} ({title!r}): unexpected bpm list {bpm!r}")
            bpm_min, bpm_max = (bpm[0], bpm[1]) if bpm[0] <= bpm[1] else (bpm[1], bpm[0])
        elif isinstance(bpm, (int, float)) and not isinstance(bpm, bool):
            bpm_min = bpm_max = bpm
        else:
            fail(f"{label} ({title!r}): unexpected bpm {bpm!r}")
        if bpm_min <= 0 or bpm_max < bpm_min:
            fail(f"{label} ({title!r}): invalid bpm range {bpm_min}-{bpm_max}")

        charts = []
        for chart_index, chart in enumerate(entry.get("chartList") or []):
            chart_type = chart.get("chartType")
            if chart_type == "coop":
                coop_skipped += 1
                continue
            step_type = CHART_TYPE_MAP.get(chart_type)
            if step_type is None:
                fail(f"{label} ({title!r}) chart {chart_index}: unknown chartType {chart_type!r}")
            level = chart.get("level")
            if not isinstance(level, int) or isinstance(level, bool) or not 1 <= level <= 29:
                fail(f"{label} ({title!r}) chart {chart_index}: invalid level {level!r}")
            charts.append({"step_type": step_type, "level": level})

        songs.append(
            {
                "title": title,
                "composer": composer,
                "song_type": song_type,
                "series": series,
                "bpm_min": bpm_min,
                "bpm_max": bpm_max,
                "is_available": str(entry.get("songID")) not in removed_ids,
                "charts": charts,
            }
        )
    return songs, coop_skipped


def parse_rerates(text):
    rows = list(csv.reader(io.StringIO(text)))
    if not rows or rows[0][0].strip() != "Final Name":
        fail(f"piu_rerates.csv: unexpected header {rows[0] if rows else 'missing'!r}")
    rerates = []
    for line_no, row in enumerate(rows[1:], start=2):
        if not row or all(not cell.strip() for cell in row):
            continue
        if len(row) != 4:
            fail(f"piu_rerates.csv line {line_no}: expected 4 columns, got {len(row)}")
        name = row[0].strip()
        type_raw = row[3].strip()
        if not name:
            fail(f"piu_rerates.csv line {line_no}: empty song name")
        if type_raw and type_raw not in SONG_TYPE_MAP:
            fail(f"piu_rerates.csv line {line_no}: unknown song type {type_raw!r}")
        try:
            old = int(row[1].strip())
            new = int(row[2].strip())
        except ValueError:
            fail(f"piu_rerates.csv line {line_no}: non-integer ratings {row[1]!r}/{row[2]!r}")
        if not 1 <= old <= 29 or not 1 <= new <= 29:
            fail(f"piu_rerates.csv line {line_no}: rating out of range 1-29 ({old} -> {new})")
        rerates.append({"name": name, "old": old, "new": new, "type": type_raw})
    return rerates


def load_series_names():
    text = SERIES_SEED_PATH.read_text(encoding="utf-8")
    names = set(re.findall(r"^\s*\('([^']*)',\s*\d+\)", text, flags=re.MULTILINE))
    if not names:
        fail(f"could not parse series names from {SERIES_SEED_PATH}")
    return names


def apply_rerates(songs, rerates):
    applied = []
    skipped = []
    for rerate in rerates:
        matches = [s for s in songs if s["title"].lower() == rerate["name"].lower()]
        if rerate["type"]:
            matches = [s for s in matches if s["song_type"] == SONG_TYPE_MAP[rerate["type"]]]
        if len(matches) != 1:
            skipped.append({**rerate, "reason": f"song match count={len(matches)}"})
            continue
        song = matches[0]
        chart_matches = [c for c in song["charts"] if c["level"] == rerate["old"]]
        if len(chart_matches) != 1:
            skipped.append({**rerate, "reason": f"chart match count={len(chart_matches)}"})
            continue
        chart_matches[0]["level"] = rerate["new"]
        applied.append(rerate)
    return applied, skipped


def dedupe_charts(songs):
    dropped = []
    for song in songs:
        seen = set()
        kept = []
        for chart in song["charts"]:
            key = (chart["step_type"], chart["level"])
            if key in seen:
                dropped.append({**song, **chart})
                continue
            seen.add(key)
            kept.append(chart)
        song["charts"] = kept
    return dropped


def sql_str(value):
    return "'" + str(value).replace("'", "''") + "'"


def fmt_num(value):
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value)


def build_sql(songs):
    lines = [
        "-- 0002_songs.sql — song catalog: songs and stepcharts for all arcade versions.",
        "--",
        "-- GENERATED by scripts/import-songs/build_seed.py — do not edit by hand.",
        "-- Re-run the script to regenerate this file.",
        "--",
        "-- Sources (pinned commits):",
    ]
    lines += [f"-- {line}" for line in SOURCE_LINES]
    lines += [
        "--",
        "-- Idempotent: re-running updates songs by (lower(title), song_type)",
        "-- and skips stepcharts that already exist.",
        "",
        "insert into public.songs (series_id, song_type, title, composer, bpm_min, bpm_max, is_available)",
        "select gs.id, v.song_type::public.song_type, v.title, v.composer, v.bpm_min, v.bpm_max, v.is_available",
        "from (values",
    ]
    song_rows = [
        "  ({}, {}, {}, {}, {}, {}, {})".format(
            sql_str(s["title"]),
            sql_str(s["song_type"]),
            sql_str(s["composer"]),
            fmt_num(s["bpm_min"]),
            fmt_num(s["bpm_max"]),
            "true" if s["is_available"] else "false",
            sql_str(s["series"]),
        )
        for s in songs
    ]
    lines.append(",\n".join(song_rows))
    lines += [
        ") as v(title, song_type, composer, bpm_min, bpm_max, is_available, series)",
        "join public.game_series gs on gs.name = v.series",
        "on conflict ((lower(title)), song_type)",
        "do update set",
        "  series_id = excluded.series_id,",
        "  composer = excluded.composer,",
        "  bpm_min = excluded.bpm_min,",
        "  bpm_max = excluded.bpm_max,",
        "  is_available = excluded.is_available;",
        "",
        "insert into public.stepcharts (song_id, step_type, level)",
        "select s.id, v.step_type::public.step_type, v.level",
        "from (values",
    ]
    chart_rows = [
        "  ({}, {}, {}, {})".format(
            sql_str(s["title"]),
            sql_str(s["song_type"]),
            sql_str(c["step_type"]),
            c["level"],
        )
        for s in songs
        for c in s["charts"]
    ]
    lines.append(",\n".join(chart_rows))
    lines += [
        ") as v(title, song_type, step_type, level)",
        "join public.songs s on lower(s.title) = lower(v.title) and s.song_type = v.song_type::public.song_type",
        "on conflict (song_id, step_type, level)",
        "do nothing;",
    ]
    return "\n".join(lines) + "\n"


def md_cell(value):
    return str(value).replace("|", "\\|")


def build_report(songs, coop_skipped, rerate_applied, rerate_skipped, duplicates_dropped):
    type_counts = Counter(s["song_type"] for s in songs)
    available = sum(1 for s in songs if s["is_available"])
    removed = len(songs) - available
    step_counts = Counter(c["step_type"] for s in songs for c in s["charts"])
    total_charts = sum(step_counts.values())

    lines = [
        "# Song import report",
        "",
        "Generated by `scripts/import-songs/build_seed.py` from the pinned sources below.",
        "",
        "## Sources (pinned commits)",
        "",
    ]
    lines += [f"- {line}" for line in SOURCE_LINES]
    lines += [
        "",
        "## Songs",
        "",
        f"- Total: {len(songs)}",
        "- By type: "
        + ", ".join(f"{name} {type_counts[name]}" for name in ("NORMAL", "REMIX", "FULLSONG", "SHORTCUT")),
        f"- Available: {available}",
        f"- Removed (is_available = false): {removed}",
        "",
        "## Stepcharts",
        "",
        f"- Total (after rerates and de-duplication): {total_charts}",
        "- By step type: "
        + ", ".join(f"{name} {step_counts[name]}" for name in ("SINGLE", "DOUBLE", "HALFDOUBLE")),
        f"- CO-OP charts skipped: {coop_skipped}",
        "",
        "## Phoenix 2 rerates",
        "",
        f"- Applied: {len(rerate_applied)}",
        f"- Skipped: {len(rerate_skipped)}",
        "",
    ]
    if rerate_skipped:
        lines += [
            "| Name | Type | Old | New | Reason |",
            "|---|---|---|---|---|",
        ]
        for r in rerate_skipped:
            lines.append(
                f"| {md_cell(r['name'])} | {r['type'] or '-'} | {r['old']} | {r['new']} | {r['reason']} |"
            )
        lines.append("")
    lines += ["## Duplicates dropped", "", f"- Total: {len(duplicates_dropped)}", ""]
    if duplicates_dropped:
        lines += [
            "| Title | Song type | Step type | Level |",
            "|---|---|---|---|",
        ]
        for d in duplicates_dropped:
            lines.append(
                f"| {md_cell(d['title'])} | {d['song_type']} | {d['step_type']} | {d['level']} |"
            )
        lines.append("")
    return "\n".join(lines)


def main():
    removed_ids = parse_removed(fetch(REMOVED_URL))
    songs, coop_skipped = parse_base(fetch(BASE_URL), removed_ids)
    rerates = parse_rerates(fetch(RERATES_URL))

    missing_series = {s["series"] for s in songs} - load_series_names()
    if missing_series:
        fail(f"series not in 0001_game_series.sql: {sorted(missing_series)}")

    key_counts = Counter((s["title"].lower(), s["song_type"]) for s in songs)
    collisions = {f"{k[0]!r}/{k[1]}": n for k, n in key_counts.items() if n > 1}
    if collisions:
        fail(f"duplicate (lower(title), song_type) in base data: {collisions}")

    rerate_applied, rerate_skipped = apply_rerates(songs, rerates)
    duplicates_dropped = dedupe_charts(songs)

    SQL_PATH.parent.mkdir(parents=True, exist_ok=True)
    SQL_PATH.write_text(build_sql(songs), encoding="utf-8")
    REPORT_PATH.write_text(
        build_report(songs, coop_skipped, rerate_applied, rerate_skipped, duplicates_dropped),
        encoding="utf-8",
    )

    total_charts = sum(len(s["charts"]) for s in songs)
    print(f"Wrote {SQL_PATH.relative_to(REPO_ROOT)}: {len(songs)} songs, {total_charts} stepcharts")
    print(f"Wrote {REPORT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
