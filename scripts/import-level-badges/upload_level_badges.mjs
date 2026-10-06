#!/usr/bin/env node
// Usage:
//   node scripts/import-level-badges/upload_level_badges.mjs --single <sheet.png> --double <sheet.png> [--out <dir>] [--upload]
//
// Cuts the Single and Double level badge sprite sheets into one image per
// level and writes them as WebP to --out (default: a folder in the system temp
// directory) for review. With --upload they also go to the level-badges
// bucket as single/NN.webp and double/NN.webp.
//
// Both sheets are grids of 172x172 cells with transparent backgrounds:
//   Double: 6 columns, levels 01-28 in reading order from the first cell.
//   Single: 8 columns; the first 26 cells repeat the set out of order, so the
//           in-order run of levels 01-26 starting at cell 26 is used.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and, for --upload, SUPABASE_SERVICE_ROLE_KEY
// from .env.local. Uses sharp, which ships with Next.js.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUCKET = "level-badges";
const CELL = 172;

const SHEETS = {
  single: { columns: 8, firstCell: 26, levels: 26 },
  double: { columns: 6, firstCell: 0, levels: 28 },
};

function fail(message) {
  console.error(`upload_level_badges: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { upload: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--single" || argv[i] === "--double" || argv[i] === "--out") args[argv[i].slice(2)] = argv[++i];
    else if (argv[i] === "--upload") args.upload = true;
    else fail(`unknown argument ${argv[i]}`);
  }
  if (!args.single || !args.double) fail("--single and --double sheets are required");
  return args;
}

function loadEnv() {
  const env = {};
  for (const line of readFileSync(join(REPO_ROOT, ".env.local"), "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return env;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  if (args.upload && !env.SUPABASE_SERVICE_ROLE_KEY) fail("SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  const out = args.out ?? mkdtempSync(join(tmpdir(), "level-badges-"));

  for (const [stepType, sheet] of Object.entries(SHEETS)) {
    const file = args[stepType];
    const { width, height } = await sharp(file).metadata();
    const rows = Math.ceil((sheet.firstCell + sheet.levels) / sheet.columns);
    if (width !== sheet.columns * CELL || height < rows * CELL) fail(`${file}: unexpected size ${width}x${height}`);
    mkdirSync(join(out, stepType), { recursive: true });
    for (let level = 1; level <= sheet.levels; level += 1) {
      const cell = sheet.firstCell + level - 1;
      const body = await sharp(file)
        .extract({ left: (cell % sheet.columns) * CELL, top: Math.floor(cell / sheet.columns) * CELL, width: CELL, height: CELL })
        .webp({ quality: 90, alphaQuality: 100 })
        .toBuffer();
      const path = `${stepType}/${String(level).padStart(2, "0")}.webp`;
      writeFileSync(join(out, path), body);
      if (args.upload) await upload(env, path, body);
    }
    console.log(`${stepType}: ${sheet.levels} badges${args.upload ? " uploaded" : ""}`);
  }
  console.log(`written to ${out}`);
}

await main();
