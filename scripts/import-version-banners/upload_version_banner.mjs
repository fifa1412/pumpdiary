#!/usr/bin/env node
// Usage:
//   node scripts/import-version-banners/upload_version_banner.mjs --folder <name> --file <image> [--out <dir>] [--upload]
//
// Turns one game version's title banner (the game logo) into a WebP: trimmed
// to its visible pixels, at most 1200 px wide, transparency kept. It is
// written to --out (default: a folder in the system temp directory) for
// review and, with --upload, goes to the version-banners bucket as
// <folder>.webp. The site only asks for the versions listed in
// VERSION_BANNERS in src/lib/scores/version-banners.ts.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and, for --upload, SUPABASE_SERVICE_ROLE_KEY
// from .env.local. Uses sharp, which ships with Next.js.
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUCKET = "version-banners";
const MAX_WIDTH = 1200;

function fail(message) {
  console.error(`upload_version_banner: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { upload: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--folder" || argv[i] === "--file" || argv[i] === "--out") args[argv[i].slice(2)] = argv[++i];
    else if (argv[i] === "--upload") args.upload = true;
    else fail(`unknown argument ${argv[i]}`);
  }
  if (!args.folder || !/^[a-z0-9-]+$/.test(args.folder)) fail("--folder must be a plain name such as phoenix");
  if (!args.file) fail("--file is required");
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
  const body = await sharp(args.file)
    .ensureAlpha()
    .trim()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100 })
    .toBuffer();
  const { width, height } = await sharp(body).metadata();
  const path = `${args.folder}.webp`;
  const out = join(args.out ?? mkdtempSync(join(tmpdir(), "version-banner-")), path);
  writeFileSync(out, body);
  if (args.upload) await upload(env, path, body);
  console.log(`${path} ${width}x${height} (${Math.round(body.length / 1024)} KB)${args.upload ? " uploaded" : ""}; written to ${out}`);
}

await main();
