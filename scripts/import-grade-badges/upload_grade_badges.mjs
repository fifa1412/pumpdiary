#!/usr/bin/env node
// Usage:
//   node scripts/import-grade-badges/upload_grade_badges.mjs --folder <bucket folder> --dir <images> [--out <dir>] [--upload]
//
// Turns one game version's grade images (SSS+.png, SSS.png ... A.png) into
// WebP badges. Each is trimmed to its visible pixels and scaled to a fixed
// height, keeping its width, then written to --out (default: a folder in the
// system temp directory) for review. With --upload they also go to the
// grade-badges bucket as <folder>/<grade>.webp, "+" spelled "-plus"
// (sss-plus.webp), so the paths need no URL escaping.
//
// The site only asks for the grades listed in VERSION_GRADES in
// src/lib/scores/grade-badges.ts; the script prints the list to put there.
//
// Needs NEXT_PUBLIC_SUPABASE_URL and, for --upload, SUPABASE_SERVICE_ROLE_KEY
// from .env.local. Uses sharp, which ships with Next.js.
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const BUCKET = "grade-badges";
const HEIGHT = 160;
const GRADES = ["SSS+", "SSS", "SS+", "SS", "S+", "S", "AAA+", "AAA", "AA+", "AA", "A+", "A", "B", "C", "D", "F"];
const IMAGE_NAME = /^([A-Z]{1,3}\+?)\.png$/i;

function fail(message) {
  console.error(`upload_grade_badges: ${message}`);
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
  const out = args.out ?? mkdtempSync(join(tmpdir(), "grade-badges-"));
  mkdirSync(join(out, args.folder), { recursive: true });

  const grades = [];
  for (const name of readdirSync(args.dir).sort()) {
    const grade = name.match(IMAGE_NAME)?.[1].toUpperCase();
    if (!grade) continue;
    if (!GRADES.includes(grade)) fail(`${name}: not a grade`);
    const body = await sharp(join(args.dir, name))
      .ensureAlpha()
      .trim()
      .resize({ height: HEIGHT })
      .webp({ quality: 90, alphaQuality: 100 })
      .toBuffer();
    const path = `${args.folder}/${grade.toLowerCase().replace("+", "-plus")}.webp`;
    writeFileSync(join(out, path), body);
    if (args.upload) await upload(env, path, body);
    grades.push(grade);
    console.log(`${path} (${Math.round(body.length / 1024)} KB)${args.upload ? " uploaded" : ""}`);
  }
  if (!grades.length) fail(`no grade images such as SSS+.png in ${args.dir}`);
  console.log(`written to ${out}`);
  console.log(`grades: [${GRADES.filter((grade) => grades.includes(grade)).map((grade) => `"${grade}"`).join(", ")}]`);
}

await main();
