#!/usr/bin/env node
// Usage:
//   node scripts/import-level-badges/upload_version_badges.mjs --folder <bucket folder> --dir <icons> [--out <dir>] [--upload]
//
// Turns one game version's level icons into badges next to the default
// (Phoenix) ones. The icons are named single-NN.png / double-NN.png; each is
// fitted onto a transparent 172x172 canvas like the sprite sheet badges and
// written as WebP to --out (default: a folder in the system temp directory)
// for review. With --upload they also go to the level-badges bucket as
// <folder>/single/NN.webp and <folder>/double/NN.webp.
//
// The site only asks for the levels listed in VERSION_BADGES in
// src/lib/songs/level-badges.ts; the script prints the list to put there.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and, for --upload, SUPABASE_SERVICE_ROLE_KEY
// from .env.local. Uses sharp, which ships with Next.js.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUCKET = "level-badges";
const CELL = 172;
const ICON_NAME = /^(single|double)-(\d{1,2})\.png$/i;

function fail(message) {
  console.error(`upload_version_badges: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { upload: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--folder" || argv[i] === "--dir" || argv[i] === "--out") args[argv[i].slice(2)] = argv[++i];
    else if (argv[i] === "--upload") args.upload = true;
    else fail(`unknown argument ${argv[i]}`);
  }
  if (!args.folder || !/^[a-z0-9-]+$/.test(args.folder)) fail("--folder must be a plain bucket folder name such as phoenix2");
  if (!args.dir) fail("--dir is required");
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

  const levels = { single: [], double: [] };
  for (const name of readdirSync(args.dir).sort()) {
    const match = name.match(ICON_NAME);
    if (!match) continue;
    const stepType = match[1].toLowerCase();
    const level = Number(match[2]);
    if (level < 1 || level > 29) fail(`${name}: level out of range`);
    const body = await sharp(join(args.dir, name))
      .ensureAlpha()
      .trim()
      .resize(CELL, CELL, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90, alphaQuality: 100 })
      .toBuffer();
    const path = `${args.folder}/${stepType}/${String(level).padStart(2, "0")}.webp`;
    mkdirSync(join(out, args.folder, stepType), { recursive: true });
    writeFileSync(join(out, path), body);
    if (args.upload) await upload(env, path, body);
    levels[stepType].push(level);
    console.log(`${path}${args.upload ? " uploaded" : ""}`);
  }
  if (!levels.single.length && !levels.double.length) fail(`no single-NN.png or double-NN.png icons in ${args.dir}`);
  console.log(`written to ${out}`);
  console.log(`levels: SINGLE [${levels.single.sort((a, b) => a - b).join(", ")}], DOUBLE [${levels.double.sort((a, b) => a - b).join(", ")}]`);
}

await main();
