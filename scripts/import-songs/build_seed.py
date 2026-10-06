#!/usr/bin/env python3
# Usage: python3 scripts/import-songs/build_seed.py [--refresh]
#
# Builds the song catalog seed:
#   - supabase/seed/0002_songs.sql
#   - scripts/import-songs/report.md
#
# Two layers of data:
#   1. The catalog as first imported: the piutool Phoenix song list with the
#      community Phoenix 2 rerates applied (pinned commits, downloaded). This
#      is what an existing database already holds, and it supplies the series
#      and BPM of the songs it knows.
#   2. Phoenix 2 as it is today: the PIU Scores chart list, kept as a snapshot
#      in scripts/import-songs/data/. It decides which songs are playable and
#      at which Single/Double levels, and adds the songs layer 1 lacks.
#      --refresh downloads a new snapshot first.
#
# Charts move from layer 1 to layer 2 in place where PIU Scores links the
# Phoenix chart to its Phoenix 2 rerate, so scores already logged stay on the
# same chart. Nothing is ever deleted.
#
# Python 3 standard library only. Deterministic for a given snapshot. Stops
# with a non-zero exit code when the data does not fit the rules.
import csv
import io
import json
import re
import sys
import unicodedata
import urllib.request
from collections import Counter
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parents[1]
SQL_PATH = REPO_ROOT / "supabase" / "seed" / "0002_songs.sql"
REPORT_PATH = SCRIPT_DIR / "report.md"
SERIES_SEED_PATH = REPO_ROOT / "supabase" / "seed" / "0001_game_series.sql"
DATA_DIR = SCRIPT_DIR / "data"
PHOENIX_PATH = DATA_DIR / "phoenix.csv"
PHOENIX2_PATH = DATA_DIR / "phoenix2.csv"

PIUSCORES_EXPORT_URL = (
    "https://piuscores.arroweclip.se/Charts/Export.csv?Mix={mix}"
    "&Columns=ChartId,Song,Artist,Type,Level,SongType,BPM,DebutMix,AddedInVersion"
)

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
    "Phoenix and Phoenix 2 chart lists: PIU Scores (https://piuscores.arroweclip.se), "
    "snapshots in scripts/import-songs/data/ (export date in the report)",
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


# --- PIU Scores snapshots ------------------------------------------------

EXPORTED_ON_PATH = DATA_DIR / "exported_on.txt"

PIUSCORES_SONG_TYPES = {
    "Arcade": "NORMAL",
    "Remix": "REMIX",
    "FullSong": "FULLSONG",
    "ShortCut": "SHORTCUT",
}

PIUSCORES_STEP_TYPES = {"S": "SINGLE", "D": "DOUBLE"}

# PIU Scores mix names that differ from game_series.name.
PIUSCORES_MIX_NAMES = {
    "NX / New Xenesis": "NX (New Xenesis)",
    "NX2 / Next Xenesis": "NX2 (Next Xenesis)",
    "The O.B.G / Season Evolution": "The O.B.G: Season Evolution",
}

# Songs the piutool list spells differently from the game (mostly typos there).
# Paired by hand with the PIU Scores Phoenix list, which has every Phoenix song:
# (PIU Scores title, song type) -> catalog title. The catalog song is renamed
# to the PIU Scores title.
TITLE_ALIASES = {
    ("A nightmare", "NORMAL"): "Nightmare",
    ("Achluoias", "NORMAL"): "Achuoias",
    ("All I Want For X-mas", "NORMAL"): "All I Want For X-max",
    ("Asterios -ReEntry-", "NORMAL"): "Asterious -ReEntry-",
    ("Banya-P Classic Remix", "REMIX"): "BanYa-P Classic Mix",
    ("BOOOM!!", "NORMAL"): "BOOOOM!!",
    ("Canon D - FULL SONG -", "FULLSONG"): "Canon D FULL Song MIX",
    ("Cross Over feat. LyuU", "NORMAL"): "Cross Over",
    ("Cross Ray", "NORMAL"): "CROSS RAY (feat. \u6708\u4e0bLia)",
    ("Dance with me", "NORMAL"): "Dance wth me",
    ("DESTRUCIMATE", "NORMAL"): "DESTRUCTIMATE",
    ("La Cinquantaine", "NORMAL"): "La Cinquantatine",
    ("Love is a Danger Zone 2 Try To B.P.M", "REMIX"): "Love is a danger zone (try to B.P.M)",
    ("Money Fingers", "REMIX"): "Monker Fingers",
    ("Monkey Fingers", "NORMAL"): "Monkey Finger",
    ("PaPa helloizing", "REMIX"): "PaPa hellozing",
    ("Radetzky Can Can", "NORMAL"): "Can Can",
    ("Silver Beat feat. ChisaUezono", "NORMAL"): "SilverBeat",
    ("Smells Like A Chocolate", "NORMAL"): "Smell Like A Chocolate",
    ("Tream Vook of the war", "REMIX"): "Tream Vook of the war REMIX",
    ("Twist of Fate (feat. Ruriling)", "NORMAL"): "Twist of Fate (fet. Ruriling)",
    ("Waltz of Doge", "NORMAL"): "Walts of Doge",
    ("X-Tream", "NORMAL"): "X Treme",
}

# A "- SHORT CUT -" / "- FULL SONG -" suffix in a title, with any dash style.
TYPE_SUFFIX = re.compile(r"\s*-\s*(short\s*cut|full\s*song)\s*-\s*$", re.IGNORECASE)


def refresh_snapshots():
    from datetime import date

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    for mix, path in (("Phoenix", PHOENIX_PATH), ("Phoenix2", PHOENIX2_PATH)):
        text = fetch(PIUSCORES_EXPORT_URL.format(mix=mix)).lstrip("\ufeff")
        path.write_text(text.replace("\r\n", "\n"), encoding="utf-8")
    EXPORTED_ON_PATH.write_text(date.today().isoformat() + "\n", encoding="utf-8")


def read_export(path):
    if not path.exists():
        fail(f"{path.relative_to(REPO_ROOT)} is missing; run with --refresh")
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    required = {"ChartId", "Song", "Artist", "Type", "Level", "SongType", "BPM", "DebutMix"}
    if not rows or not required <= set(rows[0]):
        fail(f"{path.name}: expected columns {sorted(required)}")
    songs = {}
    for line_no, row in enumerate(rows, start=2):
        title = " ".join(row["Song"].split())
        if not title:
            fail(f"{path.name} line {line_no}: empty song title")
        if row["Type"] == "CoOp":
            continue
        step_type = PIUSCORES_STEP_TYPES.get(row["Type"])
        song_type = PIUSCORES_SONG_TYPES.get(row["SongType"])
        if step_type is None or song_type is None:
            fail(f"{path.name} line {line_no}: unknown type {row['Type']!r}/{row['SongType']!r}")
        # The title suffix is more reliable than the song type column.
        suffix = TYPE_SUFFIX.search(unicodedata.normalize("NFKC", title).replace("\u2013", "-"))
        if suffix:
            song_type = "SHORTCUT" if "short" in suffix.group(1).lower() else "FULLSONG"
        try:
            level = int(row["Level"])
        except ValueError:
            fail(f"{path.name} line {line_no}: invalid level {row['Level']!r}")
        if not 1 <= level <= 29:
            fail(f"{path.name} line {line_no}: level out of range: {level}")
        song = songs.setdefault(
            (title, song_type),
            {"title": title, "song_type": song_type, "artist": "", "bpm": "", "charts": []},
        )
        song["artist"] = song["artist"] or " ".join(row["Artist"].split())
        song["bpm"] = song["bpm"] or row["BPM"].strip()
        song["charts"].append(
            {
                "id": row["ChartId"],
                "step_type": step_type,
                "level": level,
                "debut": row["DebutMix"].strip(),
                "added_in": (row.get("AddedInVersion") or "").strip(),
            }
        )
    return list(songs.values())


# A trailing "Full Song" / "Short Cut" written without the dashes.
BARE_TYPE_SUFFIX = re.compile(r"\s+(short\s*cut|full\s*song)\s*$", re.IGNORECASE)


def match_key(title):
    text = unicodedata.normalize("NFKC", title)
    text = text.replace("\u2019", "'").replace("\u2013", "-").replace("\u2014", "-")
    text = BARE_TYPE_SUFFIX.sub("", TYPE_SUFFIX.sub("", text.strip()))
    # Drop accents: "Più" and "Piu" are the same title.
    text = "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))
    return re.sub(r"[\W_]+", "", text.lower())


def match_songs(catalog, export_songs, label):
    """Ties each exported song to at most one catalog song.

    Returns ({export index: catalog index}, [(export title, catalog title, how)]).
    """
    exact = {(s["title"].lower(), s["song_type"]): i for i, s in enumerate(catalog)}
    by_key = {}
    for i, s in enumerate(catalog):
        by_key.setdefault((match_key(s["title"]), s["song_type"]), []).append(i)

    matches = {}
    notes = []
    for e, song in enumerate(export_songs):
        alias = TITLE_ALIASES.get((song["title"], song["song_type"]))
        if alias:
            target = exact.get((alias.lower(), song["song_type"]))
            if target is None:
                fail(f"alias target not in catalog: {alias!r}")
            matches[e] = target
            notes.append((song["title"], catalog[target]["title"], "alias"))
            continue
        target = exact.get((song["title"].lower(), song["song_type"]))
        if target is not None:
            matches[e] = target
            continue
        candidates = by_key.get((match_key(song["title"]), song["song_type"]), [])
        if len(candidates) > 1:
            fail(f"{label}: {song['title']!r} normalizes to several catalog songs")
        if candidates:
            matches[e] = candidates[0]
            notes.append((song["title"], catalog[candidates[0]]["title"], "normalized"))

    used = Counter(matches.values())
    doubled = [catalog[i]["title"] for i, n in used.items() if n > 1]
    if doubled:
        fail(f"{label}: catalog songs matched more than once: {doubled}")
    return matches, notes


def parse_bpm(raw):
    parts = [p.strip() for p in raw.split("~")] if raw else []
    try:
        values = [float(p) for p in parts]
    except ValueError:
        return None
    if not values or len(values) > 2 or min(values) <= 0:
        return None
    values = [int(v) if v.is_integer() else v for v in values]
    return min(values), max(values)


def series_from_debut(song, series_order):
    debuts = []
    for chart in song["charts"]:
        name = PIUSCORES_MIX_NAMES.get(chart["debut"], chart["debut"])
        if name in series_order:
            debuts.append(name)
    return min(debuts, key=series_order.get) if debuts else None


def load_series_order():
    text = SERIES_SEED_PATH.read_text(encoding="utf-8")
    pairs = re.findall(r"^\s*\('([^']*)',\s*(\d+)\)", text, flags=re.MULTILINE)
    if not pairs:
        fail(f"could not parse series names from {SERIES_SEED_PATH}")
    return {name: int(order) for name, order in pairs}


# --- Reconciliation ------------------------------------------------------


def reconcile(catalog, phoenix, phoenix2, series_order):
    """Turns the first-import catalog into the Phoenix 2 catalog.

    Mutates nothing; returns songs with their final chart rows plus the
    in-place level moves an existing database needs.
    """
    p2_matches, p2_notes = match_songs(catalog, phoenix2, "Phoenix 2")
    p1_matches, _ = match_songs(catalog, phoenix, "Phoenix")
    p1_by_catalog = {c: phoenix[e] for e, c in p1_matches.items()}
    p2_by_catalog = {c: phoenix2[e] for e, c in p2_matches.items()}

    p2_level_by_id = {}
    for song in phoenix2:
        for chart in song["charts"]:
            p2_level_by_id[chart["id"]] = (chart["step_type"], chart["level"])

    songs = []
    renames = []
    moves = []
    retired = []
    added = []
    p2_duplicates = []

    def p2_levels(song):
        levels = {}
        for chart in song["charts"]:
            key = (chart["step_type"], chart["level"])
            if key in levels:
                p2_duplicates.append((song["title"], *key))
                continue
            levels[key] = chart
        return levels

    for index, base in enumerate(catalog):
        song = {k: base[k] for k in ("title", "composer", "song_type", "series", "bpm_min", "bpm_max")}
        old = {(c["step_type"], c["level"]) for c in base["charts"]}
        p2 = p2_by_catalog.get(index)
        if p2 is None:
            song["is_available"] = False
            song["charts"] = [{"step_type": t, "level": l, "is_available": False} for t, l in sorted(old)]
            songs.append(song)
            continue

        song["is_available"] = True
        if (p2["title"], p2["song_type"]) in TITLE_ALIASES:
            renames.append({"old": base["title"], "new": p2["title"], "song_type": base["song_type"]})
            song["title"] = p2["title"]
        new = p2_levels(p2)
        old_only = sorted(old - set(new))
        new_only = set(new) - old
        charts = {key: True for key in old & set(new)}

        # Follow each chart that left through its PIU Scores chart id.
        p1_ids = {}
        p1 = p1_by_catalog.get(index)
        for chart in (p1["charts"] if p1 else []):
            p1_ids.setdefault((chart["step_type"], chart["level"]), []).append(chart["id"])
        def move(key, target, how):
            new_only.discard(target)
            charts[target] = True
            moves.append({"title": song["title"], "song_type": song["song_type"], "step_type": key[0],
                          "old": key[1], "new": target[1], "how": how})

        leftover = []
        for key in old_only:
            ids = p1_ids.get(key, [])
            target = p2_level_by_id.get(ids[0]) if len(ids) == 1 else None
            if target in new_only:
                move(key, target, "chart id")
            else:
                leftover.append(key)
        # Where the first import had a level the final Phoenix list does not,
        # pair the last unmatched chart of a step type with the last new one,
        # but only for a small level change.
        for key in leftover:
            same_type_old = [k for k in leftover if k[0] == key[0]]
            same_type_new = [k for k in new_only if k[0] == key[0]]
            if len(same_type_old) == 1 and len(same_type_new) == 1 and abs(same_type_new[0][1] - key[1]) <= 3:
                move(key, same_type_new[0], "last of its type")
            else:
                charts[key] = False
                retired.append({"title": song["title"], "step_type": key[0], "level": key[1]})
        for key in sorted(new_only):
            charts[key] = True
            added.append({"title": song["title"], "step_type": key[0], "level": key[1],
                          "added_in": new[key]["added_in"]})
        song["charts"] = [{"step_type": t, "level": l, "is_available": a} for (t, l), a in sorted(charts.items())]
        songs.append(song)

    new_songs = []
    unresolved = []
    for e, p2 in enumerate(phoenix2):
        if e in p2_matches:
            continue
        series = series_from_debut(p2, series_order)
        bpm = parse_bpm(p2["bpm"])
        if bpm is None:
            p1 = next((s for s in phoenix if match_key(s["title"]) == match_key(p2["title"])
                       and s["song_type"] == p2["song_type"]), None)
            bpm = parse_bpm(p1["bpm"]) if p1 else None
        if series is None or bpm is None or not p2["artist"]:
            unresolved.append({"title": p2["title"], "series": series, "bpm": p2["bpm"], "artist": p2["artist"]})
            continue
        levels = p2_levels(p2)
        song = {
            "title": p2["title"],
            "composer": p2["artist"],
            "song_type": p2["song_type"],
            "series": series,
            "bpm_min": bpm[0],
            "bpm_max": bpm[1],
            "is_available": True,
            "charts": [{"step_type": t, "level": l, "is_available": True} for t, l in sorted(levels)],
            "added_in": max((c["added_in"] for c in p2["charts"]), default=""),
        }
        songs.append(song)
        new_songs.append(song)

    if unresolved:
        fail("new Phoenix 2 songs without a series, BPM or artist: "
             + "; ".join(f"{u['title']!r} (series={u['series']}, bpm={u['bpm']!r})" for u in unresolved))

    key_counts = Counter((s["title"].lower(), s["song_type"]) for s in songs)
    collisions = [k for k, n in key_counts.items() if n > 1]
    if collisions:
        fail(f"new songs collide with catalog songs: {collisions}")

    return {
        "songs": songs,
        "renames": renames,
        "moves": moves,
        "retired": retired,
        "added": added,
        "new_songs": new_songs,
        "notes": p2_notes,
        "p2_duplicates": p2_duplicates,
    }


# --- Output --------------------------------------------------------------


def sql_str(value):
    return "'" + str(value).replace("'", "''") + "'"


def fmt_num(value):
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value)


def sql_bool(value):
    return "true" if value else "false"


def build_sql(result, exported_on):
    songs = result["songs"]
    lines = [
        "-- 0002_songs.sql — song catalog: songs and stepcharts, up to date with Phoenix 2.",
        "--",
        "-- GENERATED by scripts/import-songs/build_seed.py — do not edit by hand.",
        "-- Re-run the script to regenerate this file.",
        "--",
        "-- Sources:",
    ]
    lines += [f"-- {line}" for line in SOURCE_LINES]
    lines += [
        f"-- PIU Scores snapshot exported on {exported_on}.",
        "--",
        "-- Needs migration 0007 (stepcharts.is_available). Idempotent and safe on a",
        "-- database seeded by an older version of this file: songs are upserted by",
        "-- (lower(title), song_type), rerated charts are moved to their new level in",
        "-- place so existing scores follow them, and nothing is deleted.",
        "",
        "begin;",
        "",
    ]
    if result["renames"]:
        lines += [
            "-- Titles the first import misspelled, renamed to the in-game spelling.",
            "update public.songs s",
            "set title = v.new_title",
            "from (values",
        ]
        lines.append(",\n".join(
            "  ({}, {}, {})".format(sql_str(r["old"]), sql_str(r["new"]), sql_str(r["song_type"]))
            for r in result["renames"]
        ))
        lines += [
            ") as v(old_title, new_title, song_type)",
            "where lower(s.title) = lower(v.old_title)",
            "  and s.song_type = v.song_type::public.song_type",
            "  and not exists (",
            "    select 1 from public.songs x",
            "    where lower(x.title) = lower(v.new_title) and x.song_type = s.song_type",
            "  );",
            "",
        ]
    lines += [
        "insert into public.songs (series_id, song_type, title, composer, bpm_min, bpm_max, is_available)",
        "select gs.id, v.song_type::public.song_type, v.title, v.composer, v.bpm_min, v.bpm_max, v.is_available",
        "from (values",
    ]
    lines.append(",\n".join(
        "  ({}, {}, {}, {}, {}, {}, {})".format(
            sql_str(s["title"]), sql_str(s["song_type"]), sql_str(s["composer"]),
            fmt_num(s["bpm_min"]), fmt_num(s["bpm_max"]), sql_bool(s["is_available"]), sql_str(s["series"]),
        )
        for s in songs
    ))
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
    ]
    if result["moves"]:
        lines += [
            "-- Phoenix 2 rerates: move the existing chart row to its new level.",
            "update public.stepcharts sc",
            "set level = v.new_level",
            "from (values",
        ]
        lines.append(",\n".join(
            "  ({}, {}, {}, {}, {})".format(
                sql_str(m["title"]), sql_str(m["song_type"]), sql_str(m["step_type"]), m["old"], m["new"],
            )
            for m in result["moves"]
        ))
        lines += [
            ") as v(title, song_type, step_type, old_level, new_level)",
            "join public.songs s on lower(s.title) = lower(v.title) and s.song_type = v.song_type::public.song_type",
            "where sc.song_id = s.id",
            "  and sc.step_type = v.step_type::public.step_type",
            "  and sc.level = v.old_level",
            "  and not exists (",
            "    select 1 from public.stepcharts x",
            "    where x.song_id = s.id and x.step_type = sc.step_type and x.level = v.new_level",
            "  );",
            "",
        ]
    lines += [
        "insert into public.stepcharts (song_id, step_type, level, is_available)",
        "select s.id, v.step_type::public.step_type, v.level, v.is_available",
        "from (values",
    ]
    lines.append(",\n".join(
        "  ({}, {}, {}, {}, {})".format(
            sql_str(s["title"]), sql_str(s["song_type"]), sql_str(c["step_type"]), c["level"],
            sql_bool(c["is_available"]),
        )
        for s in songs
        for c in s["charts"]
    ))
    lines += [
        ") as v(title, song_type, step_type, level, is_available)",
        "join public.songs s on lower(s.title) = lower(v.title) and s.song_type = v.song_type::public.song_type",
        "on conflict (song_id, step_type, level)",
        "do update set is_available = excluded.is_available",
        "where stepcharts.is_available is distinct from excluded.is_available;",
        "",
        "commit;",
    ]
    return "\n".join(lines) + "\n"


def md_cell(value):
    return str(value).replace("|", "\\|")


def md_table(header, rows):
    if not rows:
        return ["None.", ""]
    out = ["| " + " | ".join(header) + " |", "|" + "---|" * len(header)]
    out += ["| " + " | ".join(md_cell(v) for v in row) + " |" for row in rows]
    return out + [""]


def build_report(catalog, result, removed_titles, coop_skipped, rerate_skipped, duplicates_dropped,
                 exported_on):
    songs = result["songs"]
    lines = [
        "# Song import report",
        "",
        "Generated by `scripts/import-songs/build_seed.py`.",
        "",
        "## Sources",
        "",
    ]
    lines += [f"- {line}" for line in SOURCE_LINES]
    lines += [f"- PIU Scores snapshot exported on {exported_on}", ""]

    def chart_counts(song_list, only_available=False):
        return Counter(
            c["step_type"] for s in song_list for c in s["charts"] if c.get("is_available", True) or not only_available
        )

    before = chart_counts(catalog)
    after = chart_counts(songs)
    live = chart_counts([s for s in songs if s["is_available"]], only_available=True)
    available = sum(1 for s in songs if s["is_available"])
    lines += [
        "## Counts",
        "",
        "| | First import | Now |",
        "|---|---|---|",
        f"| Songs | {len(catalog)} | {len(songs)} |",
        f"| Songs playable in Phoenix 2 | {sum(1 for s in catalog if s['is_available'])} | {available} |",
        f"| Stepchart rows | {sum(before.values())} | {sum(after.values())} |",
        f"| Playable charts (Single / Double) | - | {live['SINGLE']} / {live['DOUBLE']} |",
        "",
        f"- Songs by type now: " + ", ".join(
            f"{t} {sum(1 for s in songs if s['song_type'] == t)}" for t in ("NORMAL", "REMIX", "FULLSONG", "SHORTCUT")
        ),
        f"- CO-OP charts skipped (piutool list): {coop_skipped}",
        f"- First-import rerates skipped: {len(rerate_skipped)}; duplicates dropped: {len(duplicates_dropped)}",
        "",
        f"## New songs ({len(result['new_songs'])})",
        "",
    ]
    lines += md_table(
        ["Title", "Type", "Series", "Added in", "Single", "Double"],
        [
            (
                s["title"], s["song_type"], s["series"], s["added_in"] or "-",
                " ".join(str(c["level"]) for c in s["charts"] if c["step_type"] == "SINGLE") or "-",
                " ".join(str(c["level"]) for c in s["charts"] if c["step_type"] == "DOUBLE") or "-",
            )
            for s in sorted(result["new_songs"], key=lambda s: (s["added_in"], s["series"], s["title"].lower()))
        ],
    )
    lines += [f"## Charts moved to their Phoenix 2 level in place ({len(result['moves'])})", ""]
    lines += [
        "Paired by PIU Scores chart id (Phoenix chart -> its Phoenix 2 version), or, when the first",
        "import had a level the final Phoenix list lacks, as the only unmatched chart of its step",
        "type on the song with a level change of at most 3.",
        "",
    ]
    lines += md_table(
        ["Title", "Step type", "Old", "New", "Paired by"],
        [(m["title"], m["step_type"], m["old"], m["new"], m["how"]) for m in result["moves"]],
    )
    lines += [f"## New charts on existing songs ({len(result['added'])})", ""]
    lines += md_table(
        ["Title", "Step type", "Level", "Added in"],
        [(a["title"], a["step_type"], a["level"], a["added_in"] or "-") for a in result["added"]],
    )
    lines += [
        f"## Charts no longer in Phoenix 2 ({len(result['retired'])})",
        "",
        "Kept with `is_available = false` (scores may point at them). These belong to songs that are",
        "still playable; charts of removed songs are not listed.",
        "",
    ]
    lines += md_table(
        ["Title", "Step type", "Level"],
        [(r["title"], r["step_type"], r["level"]) for r in result["retired"]],
    )
    lines += [f"## Songs renamed to the in-game spelling ({len(result['renames'])})", ""]
    lines += md_table(
        ["Old title", "New title", "Type"],
        [(r["old"], r["new"], r["song_type"]) for r in result["renames"]],
    )
    normalized = [n for n in result["notes"] if n[2] == "normalized"]
    lines += [
        f"## Titles matched after normalization ({len(normalized)})",
        "",
        "Case, spacing, punctuation, accents and a \"Short Cut\" / \"Full Song\" suffix are ignored;",
        "the song type must match. The catalog title is kept.",
        "",
    ]
    lines += md_table(["PIU Scores title", "Catalog title"], [n[:2] for n in normalized])

    unavailable = {s["title"] for s in songs if not s["is_available"]}
    not_in_removed = sorted(unavailable - removed_titles, key=str.lower)
    removed_but_playable = sorted(removed_titles - unavailable, key=str.lower)
    lines += [
        "## Availability cross-check",
        "",
        "Songs missing from the PIU Scores Phoenix 2 list, compared with the community removal list.",
        "",
        f"- Missing from Phoenix 2 and on the removal list: {len(unavailable & removed_titles)}",
        f"- Missing from Phoenix 2 but not on the removal list: {len(not_in_removed)}",
        f"- On the removal list but still in Phoenix 2: {len(removed_but_playable)}",
        "",
    ]
    if not_in_removed:
        lines += ["Missing but not on the removal list:", ""] + [f"- {md_cell(t)}" for t in not_in_removed] + [""]
    if removed_but_playable:
        lines += ["On the removal list but still listed:", ""] + [f"- {md_cell(t)}" for t in removed_but_playable] + [""]
    if result["p2_duplicates"]:
        lines += ["## Duplicate Phoenix 2 charts (same song, step type and level; first kept)", ""]
        lines += md_table(["Title", "Step type", "Level"], result["p2_duplicates"])
    return "\n".join(lines)


def main():
    if "--refresh" in sys.argv[1:]:
        refresh_snapshots()
    exported_on = EXPORTED_ON_PATH.read_text(encoding="utf-8").strip() if EXPORTED_ON_PATH.exists() else "unknown"

    removed_ids = parse_removed(fetch(REMOVED_URL))
    catalog, coop_skipped = parse_base(fetch(BASE_URL), removed_ids)
    rerates = parse_rerates(fetch(RERATES_URL))

    series_order = load_series_order()
    missing_series = {s["series"] for s in catalog} - set(series_order)
    if missing_series:
        fail(f"series not in 0001_game_series.sql: {sorted(missing_series)}")

    key_counts = Counter((s["title"].lower(), s["song_type"]) for s in catalog)
    collisions = {f"{k[0]!r}/{k[1]}": n for k, n in key_counts.items() if n > 1}
    if collisions:
        fail(f"duplicate (lower(title), song_type) in base data: {collisions}")

    # Rebuild the catalog exactly as the first import wrote it.
    _, rerate_skipped = apply_rerates(catalog, rerates)
    duplicates_dropped = dedupe_charts(catalog)
    removed_titles = {s["title"] for s in catalog if not s["is_available"]}

    result = reconcile(catalog, read_export(PHOENIX_PATH), read_export(PHOENIX2_PATH), series_order)

    SQL_PATH.parent.mkdir(parents=True, exist_ok=True)
    SQL_PATH.write_text(build_sql(result, exported_on), encoding="utf-8")
    REPORT_PATH.write_text(
        build_report(catalog, result, removed_titles, coop_skipped, rerate_skipped, duplicates_dropped,
                     exported_on) + "\n",
        encoding="utf-8",
    )

    total_charts = sum(len(s["charts"]) for s in result["songs"])
    print(f"Wrote {SQL_PATH.relative_to(REPO_ROOT)}: {len(result['songs'])} songs, {total_charts} stepcharts")
    print(f"Wrote {REPORT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
