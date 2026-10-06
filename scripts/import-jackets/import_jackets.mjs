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
// Image choice: a hand pick from MANUAL_PICKS; else a "-wide[XX]" title card
// when there is one; else PNG/JPG files in the folder, never "-wide" ones;
// when several are left, X over X_B, then the .ssc #BANNER file, then a "_B"
// file, then a 4:3 one.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (to
// read the catalog) and, for --upload, SUPABASE_SERVICE_ROLE_KEY, all from
// .env.local. Uses sharp, which ships with Next.js.
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, extname, join, relative } from "node:path";
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
// Images picked by hand, for songs the folder names do not match or where the
// rules pick the wrong file: "catalog title|song type" -> path under --dir.
const MANUAL_PICKS = {
  "A nightmare|NORMAL": "04.1ST~PERFECT/(1) 306 - Nightmare/306.png",
  "B.P Classic Remix|REMIX": "08.FIESTA/1031 - [Remix] Banya-P Classic Remix/1031.png",
  "B.P Classic Remix 2|REMIX": "08.FIESTA/1034 - [Remix] Banya-P Classic Remix 2/1034.png",
  "Bemera|SHORTCUT": "08.FIESTA/1062 - [Short Cut] Beemera/1062.png",
  "ASDF|NORMAL": "09.FIESTA EX/1154 - ASDF/1154.png",
  "Bad Apple!! feat. Nomico|NORMAL": "11.PRIME/1481 - Bad Apple!! (feat. Nomico)/1481.png",
  "Baroque Virus - FULL SONG -|FULLSONG": "13.XX/16F9 - [Full Song] Baroque Virus/16F9-wide.png",
  "Close Your Eye|NORMAL": "04.1ST~PERFECT/(1) 307 - Close Your Eyes/307.png",
  "Final Audition Ep.1|NORMAL": "05.EXTRA~PREX 3/(1) 922 - Final Audition Episode 1/922.PNG",
  "Final Audition 3|NORMAL": "06.EXCEED~ZERO/(3) A01 - Final Audition 3 U.F/A01.PNG",
  "Do U Know That-Old School|NORMAL": "07.NX~NXA/(2) D15 - Do You Know That -Old School-/D15.PNG",
  "Love is a Danger Zone pt.2|NORMAL": "06.EXCEED~ZERO/(1) C04 - Love is a Danger Zone 2/C04.PNG",
  "Love is a Danger Zone 2 Try To B.P.M|REMIX": "06.EXCEED~ZERO/(1) C41 - [Remix] Love Is A Danger Zone - Try To B.P.M/C41.PNG",
  "Love is a Danger Zone pt.2 another|NORMAL": "06.EXCEED~ZERO/(1) DC04 - Love is a Danger Zone 2 (Another)/DC04.png",
  "Love is a Danger Zone pt.2|SHORTCUT": "08.FIESTA/1052 - [Short Cut] Love is a Danger Zone 2/1052.png",
  "Final Audition Ep.2-1|NORMAL": "07.NX~NXA/(2) D28 - Final Audition Episode 2-1/D28.PNG",
  "Final Audition Ep.2-2|NORMAL": "07.NX~NXA/(2) D30 - Final Audition Episode 2-2/D30.PNG",
  "Final Audition Ep.2-X|NORMAL": "07.NX~NXA/F29 - Final Audition Episode 2-X/F29.PNG",
  "Final Audition EP.2-X|SHORTCUT": "08.FIESTA/1050 - [Short Cut] Final Audition Episode 2-X/1050.png",
  "Ignis Fatuus(DM Ashura Mix)|NORMAL": "10.FIESTA 2/(1) 1306 - Ignis Fatuus/1306.png",
  "Ignis Fatuus(DM Ashura Mix)|SHORTCUT": "10.FIESTA 2/(1) 13E2 - [Short Cut] Ignis Fatuus/13E2.png",
  "FFF|NORMAL": "10.FIESTA 2/(1) 1309 - Flew Far Faster/1309.png",
  "FFF|SHORTCUT": "10.FIESTA 2/(1) 13E3 - [Short Cut] Flew Far Faster/13E3.png",
  "Bullfighter's Song|NORMAL": "07.NX~NXA/(2) D17 - Bullfighting's Song/D17.PNG",
  "CHICKEN WING|SHORTCUT": "08.FIESTA/1054 - [Short Cut] Chiken Wing/1054.png",
  "You Got Me Crazy|NORMAL": "11.PRIME/1411 - U Got Me Crazy/1411.png",
  "Radetzky Can Can|NORMAL": "05.EXTRA~PREX 3/(1) 913 - Radezky Can Can/913.png",
  "Sudden Romance [PIU Edit]|NORMAL": "11.PRIME/1478 - Sudden Romance/1478.PNG",
  "Just Hold on (To All Fighters)|NORMAL": "11.PRIME/1494 - Just Hold On/1494.PNG",
  "Cross Ray|NORMAL": "13.XX/16B3 - CROSS RAY (feat. Lia)/16B3.png",
};

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
  // XX-era folders carry a "-wide[XX]" title card, which beats every other image.
  const xxWide = files.filter((file) => /-wide\[XX\]\.(png|jpe?g)$/i.test(file)).sort()[0];
  if (xxWide) return { file: xxWide, how: "-wide[XX]" };
  const images = files
    .filter((file) => /\.(png|jpe?g)$/i.test(file) && !/-wide\./i.test(file))
    .sort();
  if (images.length <= 1) return images[0] ? { file: images[0], how: "only image" } : null;

  // "X.png" next to "X_B.png": always X.
  for (const file of images) {
    const base = file.match(/^(.*)_B\.(png|jpe?g)$/i)?.[1];
    const plain = base && images.find((other) => new RegExp(`^${escapeRegExp(base)}\\.(png|jpe?g)$`, "i").test(other));
    if (plain) return { file: plain, how: "plain over _B" };
  }

  const ssc = files.find((file) => /\.ssc$/i.test(file));
  if (ssc) {
    const banner = readFileSync(join(folder.path, ssc), "latin1").match(/^#BANNER:([^;\r\n]*);/m)?.[1]?.trim();
    const hit = banner && images.find((file) => file.toLowerCase() === banner.toLowerCase());
    if (hit) return { file: hit, how: "#BANNER" };
  }
  const banner = images.find((file) => /_B\.(png|jpe?g)$/i.test(file));
  if (banner) return { file: banner, how: "_B file" };
  for (const file of images) {
    if (await isFourByThree(join(folder.path, file))) return { file, how: "4:3" };
  }
  return { file: images[0], how: "first of several" };
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function isFourByThree(file) {
  const { width, height } = await sharp(file).metadata();
  return Boolean(width && height && Math.abs(width / height - 4 / 3) < 0.02);
}

function encode(input) {
  return sharp(input).resize({ width: WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
}

// Some PNGs in the dumps are slightly damaged: libpng gives up on them while
// macOS ImageIO still reads them, so fall back to sips there.
async function toWebp(file) {
  try {
    return await encode(file);
  } catch (error) {
    if (process.platform !== "darwin") throw error;
    const dir = mkdtempSync(join(tmpdir(), "jacket-"));
    try {
      const png = join(dir, "image.png");
      execFileSync("sips", ["-s", "format", "png", file, "--out", png], { stdio: "ignore" });
      console.log(`decoded with sips: ${file}`);
      return await encode(png);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
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
    const manual = MANUAL_PICKS[`${song.title}|${song.song_type}`];
    if (manual) {
      const [series, name] = manual.split("/");
      if (!existsSync(join(args.dir, manual))) fail(`manual pick not found: ${manual}`);
      chosen.push({ song, folder: { series, name, path: join(args.dir, series, name) }, file: basename(manual), how: "manual", others: 0 });
      continue;
    }
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
  const failed = [];
  const saveManifest = () => {
    const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + "\n");
    writeFileSync(SEED_PATH, buildSeed(sorted));
  };
  if (args.upload) {
    const targets = chosen.filter((c) => !only.size || only.has(c.song.title.toLowerCase()));
    for (const target of targets) {
      const source = relative(args.dir, join(target.folder.path, target.file));
      const entryKey = `${target.song.title.toLowerCase()}|${target.song.song_type}`;
      if (manifest[entryKey]?.source === source) continue;
      let body;
      try {
        body = await toWebp(join(target.folder.path, target.file));
      } catch (error) {
        failed.push({ target, reason: error.message });
        console.log(`skipped ${source}: ${error.message}`);
        continue;
      }
      const hash = createHash("sha256").update(body).digest("hex").slice(0, 10);
      const path = `${target.song.id}-${hash}.webp`;
      await upload(env, path, body);
      manifest[entryKey] = { title: target.song.title, song_type: target.song.song_type, path, source };
      saveManifest();
      console.log(`uploaded ${path} (${Math.round(body.length / 1024)} KB) <- ${target.song.title}`);
    }
    saveManifest();
  }

  const withImage = new Set(chosen.map((c) => c.song.id));
  const changes = chosen
    .map((c) => ({ c, before: manifest[`${c.song.title.toLowerCase()}|${c.song.song_type}`]?.source }))
    .filter(({ c, before }) => before !== relative(args.dir, join(c.folder.path, c.file)));
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
    `## Image changes ${args.upload ? "not uploaded (outside --only)" : "pending (run with --upload)"} (${changes.length})`,
    "",
    ...changes.map(({ c, before }) => `- ${mdCell(c.song.title)} (${c.song.song_type}): ${before ? mdCell(before) : "new"} -> ${mdCell(`${c.folder.series}/${c.folder.name}/${c.file}`)}`),
    "",
    "## Image choices with more than one candidate",
    "",
    "| Song | Type | Folder | File | Chosen by |",
    "|---|---|---|---|---|",
    ...chosen
      .filter((c) => c.how !== "only image" || c.others > 0)
      .map((c) => `| ${mdCell(c.song.title)} | ${c.song.song_type} | ${mdCell(`${c.folder.series}/${c.folder.name}`)} | ${mdCell(c.file)} | ${c.how}${c.others ? `, newest of ${c.others + 1} folders` : ""} |`),
    "",
    ...(failed.length
      ? [`## Images that could not be read (${failed.length})`, "", ...failed.map((f) => `- ${mdCell(f.target.song.title)}: ${mdCell(`${f.target.folder.series}/${f.target.folder.name}/${f.target.file}`)} (${mdCell(f.reason)})`), ""]
      : []),
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
