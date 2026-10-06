#!/usr/bin/env node
// Usage:
//   node scripts/import-jackets/import_jackets.mjs [--dir <folder>] [--only <title>]... [--upload]
//
// Matches the song folders of a Pump It Up resource dump to the catalog,
// picks each song's jacket (title card) image, and writes
// scripts/import-jackets/report.md. Without --upload nothing leaves this
// machine.
//
// With --upload, the chosen images are converted to WebP, uploaded to the
// song-jackets bucket, recorded in scripts/import-jackets/manifest.json, and
// supabase/seed/0003_song_jackets.sql is regenerated from the manifest so the
// database can be pointed at them. --only limits the upload to the named
// catalog titles (exact, case-insensitive); repeat it for several songs.
//
// Folder layout: <series>/<"(n) "?><code> - <"[Full Song] " etc.?><title>/
// Image choice: PNG/JPG files in the folder, never "-wide" ones; when several
// are left, the .ssc #BANNER file, then a "_B" file, then a 4:3 one.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (to
// read the catalog) and, for --upload, SUPABASE_SERVICE_ROLE_KEY, all from
// .env.local. Uses sharp, which ships with Next.js.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(SCRIPT_DIR, "..", "..");
const MANIFEST_PATH = join(SCRIPT_DIR, "manifest.json");
const REPORT_PATH = join(SCRIPT_DIR, "report.md");
const SEED_PATH = join(REPO_ROOT, "supabase", "seed", "0003_song_jackets.sql");
const BUCKET = "song-jackets";
const WIDTH = 640;

const TAG_TYPES = {
  "full song": "FULLSONG",
  "short cut": "SHORTCUT",
  remix: "REMIX",
};
const SKIPPED_TAGS = new Set(["skill up"]);

function fail(message) {
  console.error(`import_jackets: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { dir: join(homedir(), "Desktop", "piu_resource"), only: [], upload: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--dir") args.dir = argv[++i];
    else if (argv[i] === "--only") args.only.push(argv[++i]);
    else if (argv[i] === "--upload") args.upload = true;
    else fail(`unknown argument ${argv[i]}`);
  }
  return args;
}

function loadEnv() {
  const env = {};
  const text = readFileSync(join(REPO_ROOT, ".env.local"), "utf8");
  for (const line of text.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

// Same rules as match_key in scripts/import-songs/build_seed.py.
function matchKey(title) {
  let text = title.normalize("NFKC").replace(/’/g, "'").replace(/[–—]/g, "-").trim();
  text = text.replace(/\s*-\s*(short\s*cut|full\s*song)\s*-\s*$/i, "");
  text = text.replace(/\s+(short\s*cut|full\s*song)\s*$/i, "");
  text = text.normalize("NFKD").replace(/\p{M}/gu, "");
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

async function fetchSongs(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) fail("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY missing");
  const response = await fetch(`${url}/rest/v1/songs?select=id,title,song_type,jacket_path&order=id`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Range: "0-4999" },
  });
  if (!response.ok) fail(`reading songs failed: HTTP ${response.status}`);
  return response.json();
}

function parseFolder(name) {
  const match = name.match(/^(?:\(\d+\)\s*)?([0-9A-Za-z.]+)\s+-\s+(?:\[([^\]]+)\]\s*)?(.+)$/);
  if (!match) return null;
  const tag = (match[2] ?? "").toLowerCase();
  if (SKIPPED_TAGS.has(tag)) return { skipped: `[${match[2]}]` };
  if (tag && !TAG_TYPES[tag]) return { skipped: `unknown tag [${match[2]}]` };
  return { code: match[1], title: match[3].trim(), songType: TAG_TYPES[tag] ?? "NORMAL" };
}

function scanFolders(root) {
  if (!existsSync(root)) fail(`folder not found: ${root}`);
  const folders = [];
  for (const series of readdirSync(root).sort()) {
    const seriesPath = join(root, series);
    if (!statSync(seriesPath).isDirectory()) continue;
    for (const name of readdirSync(seriesPath).sort()) {
      const path = join(seriesPath, name);
      if (statSync(path).isDirectory()) folders.push({ series, name, path, ...parseFolder(name) });
    }
  }
  return folders;
}

async function chooseImage(folder) {
  const files = readdirSync(folder.path).filter((file) => statSync(join(folder.path, file)).isFile());
  const images = files.filter((file) => /\.(png|jpe?g)$/i.test(file) && !/-wide\./i.test(file)).sort();
  if (images.length <= 1) return images[0] ? { file: images[0], how: "only image" } : null;

  const ssc = files.find((file) => /\.ssc$/i.test(file));
  if (ssc) {
    const banner = readFileSync(join(folder.path, ssc), "latin1").match(/^#BANNER:([^;\r\n]*);/m)?.[1]?.trim();
    const hit = banner && images.find((file) => file.toLowerCase() === banner.toLowerCase());
    if (hit) return { file: hit, how: "#BANNER" };
  }
  const banner = images.find((file) => /_B\.(png|jpe?g)$/i.test(file));
  if (banner) return { file: banner, how: "_B file" };
  for (const file of images) {
    const { width, height } = await sharp(join(folder.path, file)).metadata();
    if (width && height && Math.abs(width / height - 4 / 3) < 0.02) return { file, how: "4:3" };
  }
  return { file: images[0], how: "first of several" };
}

async function upload(env, path, body) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "image/webp",
      "Cache-Control": "max-age=31536000",
      "x-upsert": "true",
    },
    body,
  });
  if (!response.ok) fail(`upload of ${path} failed: HTTP ${response.status} ${await response.text()}`);
}

function sqlStr(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function buildSeed(manifest) {
  const rows = Object.values(manifest).sort((a, b) => a.title.localeCompare(b.title) || a.song_type.localeCompare(b.song_type));
  const lines = [
    "-- 0003_song_jackets.sql — points songs at their jacket image in the song-jackets bucket.",
    "--",
    "-- GENERATED by scripts/import-jackets/import_jackets.mjs from manifest.json — do not edit by hand.",
    "-- Needs migration 0008 and the images uploaded by that script. Idempotent.",
    "",
  ];
  if (rows.length === 0) return lines.join("\n") + "\n";
  lines.push(
    "update public.songs s",
    "set jacket_path = v.jacket_path",
    "from (values",
    rows.map((r) => `  (${sqlStr(r.title)}, ${sqlStr(r.song_type)}, ${sqlStr(r.path)})`).join(",\n"),
    ") as v(title, song_type, jacket_path)",
    "where lower(s.title) = lower(v.title)",
    "  and s.song_type = v.song_type::public.song_type",
    "  and s.jacket_path is distinct from v.jacket_path;",
  );
  return lines.join("\n") + "\n";
}

function mdCell(value) {
  return String(value).replace(/\|/g, "\\|");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  if (args.upload && !env.SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY missing from .env.local");

  const songs = await fetchSongs(env);
  const byKey = new Map();
  for (const song of songs) {
    const key = `${matchKey(song.title)}|${song.song_type}`;
    byKey.set(key, [...(byKey.get(key) ?? []), song]);
  }

  const folders = scanFolders(args.dir);
  const skipped = [];
  const unmatched = [];
  const matchesBySong = new Map();
  for (const folder of folders) {
    if (folder.skipped || !folder.title) {
      skipped.push({ folder, reason: folder.skipped ?? "unrecognized folder name" });
      continue;
    }
    const candidates = byKey.get(`${matchKey(folder.title)}|${folder.songType}`) ?? [];
    if (candidates.length !== 1) {
      unmatched.push({ folder, reason: candidates.length ? "several catalog songs" : "no catalog song" });
      continue;
    }
    const song = candidates[0];
    matchesBySong.set(song.id, [...(matchesBySong.get(song.id) ?? []), folder]);
  }

  // A song can appear in several series folders; the newest series has the
  // newest artwork, and folders are scanned oldest series first.
  const chosen = [];
  const noImage = [];
  for (const song of songs) {
    const found = matchesBySong.get(song.id);
    if (!found) continue;
    let pick = null;
    for (const folder of [...found].reverse()) {
      const image = await chooseImage(folder);
      if (image) {
        pick = { song, folder, ...image, others: found.length - 1 };
        break;
      }
    }
    if (pick) chosen.push(pick);
    else noImage.push({ song, folder: found.at(-1) });
  }

  const only = new Set(args.only.map((title) => title.toLowerCase()));
  if (only.size) {
    const known = new Set(chosen.map((c) => c.song.title.toLowerCase()));
    const missing = [...only].filter((title) => !known.has(title));
    if (missing.length) fail(`--only titles without a matched image: ${missing.join(", ")}`);
  }

  const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) : {};
  if (args.upload) {
    const targets = chosen.filter((c) => !only.size || only.has(c.song.title.toLowerCase()));
    for (const target of targets) {
      const body = await sharp(join(target.folder.path, target.file))
        .resize({ width: WIDTH, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      const hash = createHash("sha256").update(body).digest("hex").slice(0, 10);
      const path = `${target.song.id}-${hash}.webp`;
      await upload(env, path, body);
      manifest[`${target.song.title.toLowerCase()}|${target.song.song_type}`] = {
        title: target.song.title,
        song_type: target.song.song_type,
        path,
        source: relative(args.dir, join(target.folder.path, target.file)),
      };
      console.log(`uploaded ${path} (${Math.round(body.length / 1024)} KB) <- ${target.song.title}`);
    }
    const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + "\n");
    writeFileSync(SEED_PATH, buildSeed(sorted));
  }

  const withImage = new Set(chosen.map((c) => c.song.id));
  const missingSongs = songs.filter((song) => !withImage.has(song.id));
  const report = [
    "# Jacket import report",
    "",
    "Generated by `scripts/import-jackets/import_jackets.mjs`.",
    "",
    `- Song folders scanned: ${folders.length}`,
    `- Catalog songs with an image found: ${chosen.length} of ${songs.length}`,
    `- Uploaded so far (manifest): ${Object.keys(manifest).length}`,
    `- Folders skipped: ${skipped.length}; folders matching no catalog song: ${unmatched.length}`,
    "",
    "## Image choices with more than one candidate",
    "",
    "| Song | Type | Folder | File | Chosen by |",
    "|---|---|---|---|---|",
    ...chosen
      .filter((c) => c.how !== "only image" || c.others > 0)
      .map((c) => `| ${mdCell(c.song.title)} | ${c.song.song_type} | ${mdCell(`${c.folder.series}/${c.folder.name}`)} | ${mdCell(c.file)} | ${c.how}${c.others ? `, newest of ${c.others + 1} folders` : ""} |`),
    "",
    `## Folders matching no catalog song (${unmatched.length})`,
    "",
    ...unmatched.map((u) => `- ${mdCell(`${u.folder.series}/${u.folder.name}`)} (${u.folder.songType}; ${u.reason})`),
    "",
    `## Folders skipped (${skipped.length})`,
    "",
    ...skipped.map((s) => `- ${mdCell(`${s.folder.series}/${s.folder.name}`)} (${s.reason})`),
    "",
    `## Catalog songs without an image (${missingSongs.length})`,
    "",
    ...missingSongs.map((song) => `- ${mdCell(song.title)} (${song.song_type})${noImage.some((n) => n.song.id === song.id) ? " — folder has no usable image" : ""}`),
    "",
  ];
  writeFileSync(REPORT_PATH, report.join("\n"));
  console.log(`${chosen.length}/${songs.length} catalog songs have an image; report: ${relative(REPO_ROOT, REPORT_PATH)}`);
}

await main();
