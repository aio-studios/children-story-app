// Optimizes the full-res source art (docs/designs/source-art/*.png) into small app-ready JPEGs under
// public/ (#59). Characters -> public/characters/<id>.jpg, genres -> public/genres/<id>.jpg. JPEG (not
// WebP) because sips can't emit WebP and the backgrounds are opaque (the round orb clips the circle),
// so transparency is moot. ~240px is ample for the 60-80px orbs at 2x. Idempotent - safe to re-run.
// Run: node scripts/optimize-art.mjs
import { readdir, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const SRC = new URL("../docs/designs/source-art/", import.meta.url).pathname;
const CHAR_OUT = new URL("../public/characters/", import.meta.url).pathname;
const GENRE_OUT = new URL("../public/genres/", import.meta.url).pathname;
const SIZE = 240;
const QUALITY = 80;

// Source basename "genre-scifi" maps to the genre id "sci-fi"; everything else drops its prefix as-is.
const SLUG = { "genre-scifi": "sci-fi" };
const slugFor = (base) => SLUG[base] ?? base.replace(/^(char|genre)-/, "");

await mkdir(CHAR_OUT, { recursive: true });
await mkdir(GENRE_OUT, { recursive: true });

const files = (await readdir(SRC)).filter((f) => f.endsWith(".png"));
let done = 0;
for (const file of files) {
  const base = file.replace(/\.png$/, "");
  const outDir = base.startsWith("genre-") ? GENRE_OUT : CHAR_OUT;
  const out = `${outDir}${slugFor(base)}.jpg`;
  const r = spawnSync("sips", ["-Z", String(SIZE), "-s", "format", "jpeg", "-s", "formatOptions", String(QUALITY), `${SRC}${file}`, "--out", out], { encoding: "utf8" });
  if (r.status !== 0) { console.log(`FAIL ${file}: ${(r.stderr || "").trim()}`); continue; }
  done++;
}
console.log(`Optimized ${done}/${files.length} images -> public/characters + public/genres`);
