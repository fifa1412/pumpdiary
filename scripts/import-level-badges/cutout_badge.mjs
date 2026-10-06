#!/usr/bin/env node
// Usage:
//   node scripts/import-level-badges/cutout_badge.mjs <screenshot.png> <out.webp> [--upload <bucket path>]
//
// Cuts a green Double level badge (for example the "??" badge used for D29)
// out of an in-game screenshot and lays it out like the sprite sheet badges:
// a 172x172 transparent canvas with the badge in a 163x133 box at (4, 18).
//
// The oval is found from its green pixels: an ellipse is fitted to the outer
// rim (dropping points where the rim is in shadow), then the "DOUBLE"
// lettering that pokes past the rim is added back with its dark outline.
// With --upload the result also goes to the level-badges bucket.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const argv = process.argv.slice(2);
const uploadAt = argv.indexOf("--upload");
const uploadPath = uploadAt >= 0 ? argv.splice(uploadAt, 2)[1] : null;
const [src, out] = argv;
if (!src || !out) {
  console.error("usage: cutout_badge.mjs <screenshot.png> <out.webp> [--upload <bucket path>]");
  process.exit(1);
}
const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const isGreen = (p) => { const i = p * 3; return data[i + 1] > data[i] + 25 && data[i + 1] > data[i + 2]; };
// orange/red backdrop of the screenshot (the badge itself has no orange)
const isBackground = (p) => { const i = p * 3, r = data[i], g = data[i + 1], b = data[i + 2]; return r > g + 20 && r > b + 10; };
// boundary candidates: leftmost/rightmost green per row, top/bottom per column
const pts = [];
for (let y = 0; y < H; y++) { let a = -1, b = -1; for (let x = 0; x < W; x++) if (isGreen(y * W + x)) { if (a < 0) a = x; b = x; } if (a >= 0) pts.push([a, y], [b, y]); }
for (let x = 0; x < W; x++) { let a = -1, b = -1; for (let y = 0; y < H; y++) if (isGreen(y * W + x)) { if (a < 0) a = y; b = y; } if (a >= 0) pts.push([x, a], [x, b]); }
// convex hull (monotone chain)
pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const lower = [], upper = [];
for (const p of pts) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), p) <= 0) lower.pop(); lower.push(p); }
for (const p of [...pts].reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), p) <= 0) upper.pop(); upper.push(p); }
const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)];
const inHull = (x, y) => { for (let i = 0; i < hull.length; i++) if (cross(hull[i], hull[(i + 1) % hull.length], [x, y]) < 0) return false; return true; };
const mask = Buffer.alloc(W * H);
let n = 0, sx = 0, sy = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inHull(x, y)) { mask[y * W + x] = 255; n++; sx += x; sy += y; }
const cx = sx / n, cy = sy / n; let sxx = 0, syy = 0, sxy = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { sxx += (x - cx) ** 2; syy += (y - cy) ** 2; sxy += (x - cx) * (y - cy); }
sxx /= n; syy /= n; sxy /= n;
// ellipse with the same second moments: semi-axes 2*sqrt(eigenvalues)
const tr = sxx + syy, det = sxx * syy - sxy * sxy, d = Math.sqrt(tr * tr / 4 - det);
const l1 = tr / 2 + d, l2 = tr / 2 - d, theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
// Refine by fitting the ellipse to the rim points (row/column extremes of green);
// where the rim is in shadow those extremes sit inside the oval, so drop the worst.
const resid = (q, [x, y]) => { const [ex, ey, a, b, t] = q, ct = Math.cos(t), st = Math.sin(t);
  const u = (x - ex) * ct + (y - ey) * st, v = -(x - ex) * st + (y - ey) * ct; return Math.hypot(u / a, v / b) - 1; };
function nelderMead(f, x0, steps, iters = 3000) {
  let simplex = [x0, ...x0.map((_, i) => x0.map((v, j) => (i === j ? v + steps[i] : v)))].map((p) => [p, f(p)]);
  for (let k = 0; k < iters; k++) {
    simplex.sort((a, b) => a[1] - b[1]);
    const n = x0.length, centroid = x0.map((_, j) => simplex.slice(0, n).reduce((s, [p]) => s + p[j], 0) / n);
    const worst = simplex[n][0], move = (c) => centroid.map((v, j) => v + c * (worst[j] - v));
    const r = move(-1), fr = f(r);
    if (fr < simplex[0][1]) { const e = move(-2), fe = f(e); simplex[n] = fe < fr ? [e, fe] : [r, fr]; }
    else if (fr < simplex[n - 1][1]) simplex[n] = [r, fr];
    else { const cpt = move(0.5), fc = f(cpt);
      if (fc < simplex[n][1]) simplex[n] = [cpt, fc];
      else simplex = simplex.map(([p], i) => (i === 0 ? simplex[0] : (() => { const q = p.map((v, j) => simplex[0][0][j] + 0.5 * (v - simplex[0][0][j])); return [q, f(q)]; })())); }
  }
  simplex.sort((a, b) => a[1] - b[1]); return simplex[0][0];
}
let q = [cx, cy, 2 * Math.sqrt(l1), 2 * Math.sqrt(l2), theta], used = pts;
for (let round = 0; round < 4; round++) {
  q = nelderMead((p) => used.reduce((s, pt) => s + resid(p, pt) ** 2, 0), q, [5, 5, 10, 10, 0.1]);
  const sorted = used.map((pt) => [Math.abs(resid(q, pt)), pt]).sort((a, b) => a[0] - b[0]);
  used = sorted.slice(0, Math.floor(sorted.length * 0.8)).map(([, pt]) => pt);
}
const [ecx, ecy] = q, A = q[2], B = q[3], c = Math.cos(q[4]), s = Math.sin(q[4]);
mask.fill(0);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const u = (x - ecx) * c + (y - ecy) * s, v = -(x - ecx) * s + (y - ecy) * c; if ((u / A) ** 2 + (v / B) ** 2 <= 1) mask[y * W + x] = 255; }
// The "DOUBLE" lettering pokes past the rim at the top: add white text pixels
// just outside the oval (upper half only) plus a 3px dark outline around them.
const ell = (x, y) => { const u = (x - ecx) * c + (y - ecy) * s, v = -(x - ecx) * s + (y - ecy) * c; return Math.hypot(u / A, v / B); };
const white = new Uint8Array(W * H);
for (let y = 0; y < ecy; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 3, e = ell(x, y);
  if (e > 1 && e < 1.4 && data[i] > 170 && data[i + 1] > 170 && data[i + 2] > 170) { white[y * W + x] = 1; mask[y * W + x] = 255; } }
for (let y = 0; y < ecy; y++) for (let x = 0; x < W; x++) { if (mask[y * W + x]) continue; const i = (y * W + x) * 3;
  if (data[i] + data[i + 1] + data[i + 2] > 240) continue;
  outer: for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const yy = y + dy, xx = x + dx;
    if (yy >= 0 && yy < H && xx >= 0 && xx < W && white[yy * W + xx]) { mask[y * W + x] = 255; break outer; } } }
const alpha = await sharp(mask, { raw: { width: W, height: H, channels: 1 } }).blur(1.2).extractChannel(0).raw().toBuffer();
const rgba = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) { rgba[i * 4] = data[i * 3]; rgba[i * 4 + 1] = data[i * 3 + 1]; rgba[i * 4 + 2] = data[i * 3 + 2]; rgba[i * 4 + 3] = alpha[i]; }
const cut = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).trim({ threshold: 0 }).png().toBuffer();
const badge = await sharp(cut).resize(163, 133, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await sharp({ create: { width: 172, height: 172, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: badge, left: 4, top: 18 }]).webp({ quality: 90, alphaQuality: 100 }).toFile(out);

if (uploadPath) {
  const env = Object.fromEntries(
    readFileSync(join(REPO_ROOT, ".env.local"), "utf8").split("\n")
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map(([, k, v]) => [k, v.trim().replace(/^["']|["']$/g, "")]),
  );
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  const response = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/level-badges/${uploadPath}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "image/webp", "Cache-Control": "max-age=31536000", "x-upsert": "true" },
    body: readFileSync(out),
  });
  if (!response.ok) throw new Error(`upload failed: HTTP ${response.status} ${await response.text()}`);
  console.log(`uploaded level-badges/${uploadPath}`);
}
