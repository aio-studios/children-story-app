// Optimizes the full-res source art (docs/designs/source-art/*.png) into small app-ready JPEGs under
// public/ (#59). Characters -> public/characters/<id>.jpg, genres -> public/genres/<id>.jpg. JPEG (not
// WebP) because sips can't emit WebP and the backgrounds are opaque (the round orb clips the circle),
// so transparency is moot. Sized at the full 1024px source: Setup-B's immersive deck (#79) renders
// these full-bleed (~550px tall on a DPR-3 phone), so the old 240px — fine for the retired 60-80px
// orbs — upscaled ~2x and looked soft. Idempotent - safe to re-run.
// Run: node scripts/optimize-art.mjs
import { readdir, mkdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const SRC = new URL("../docs/designs/source-art/", import.meta.url).pathname;
const CHAR_OUT = new URL("../public/characters/", import.meta.url).pathname;
const GENRE_OUT = new URL("../public/genres/", import.meta.url).pathname;
const PUBLIC_OUT = new URL("../public/", import.meta.url).pathname; // one-off icons (e.g. the #65 CTA)
const SIZE = 1024;
const QUALITY = 80;

// Assets that live at public/ root (referenced as e.g. /your-own.jpg), not under characters/ or genres/.
const ROOT_ASSETS = new Set(["create-your-own", "your-own", "create-hero", "mascot-book", "mascot-night"]);
// The mascots are only ever shown tiny (Home greeting), so keep them small instead of the full 1024px
// the deck art needs — no point shipping a 240KB image for a ~44px owl.
const SMALL_ASSETS = new Set(["mascot-book", "mascot-night"]);
const SMALL_SIZE = 256;

// Source basename "genre-scifi" maps to the genre id "sci-fi"; everything else drops its prefix as-is.
const SLUG = { "genre-scifi": "sci-fi" };
const slugFor = (base) => SLUG[base] ?? base.replace(/^(char|genre)-/, "");

await mkdir(CHAR_OUT, { recursive: true });
await mkdir(GENRE_OUT, { recursive: true });

const files = (await readdir(SRC)).filter((f) => f.endsWith(".png"));
let done = 0;
for (const file of files) {
  const base = file.replace(/\.png$/, "");
  const outDir = base.startsWith("genre-") ? GENRE_OUT : ROOT_ASSETS.has(base) ? PUBLIC_OUT : CHAR_OUT;
  const out = `${outDir}${slugFor(base)}.jpg`;
  const size = SMALL_ASSETS.has(base) ? SMALL_SIZE : SIZE;
  const r = spawnSync("sips", ["-Z", String(size), "-s", "format", "jpeg", "-s", "formatOptions", String(QUALITY), `${SRC}${file}`, "--out", out], { encoding: "utf8" });
  if (r.status !== 0) { console.log(`FAIL ${file}: ${(r.stderr || "").trim()}`); continue; }
  done++;
}
console.log(`Optimized ${done}/${files.length} images -> public/characters + public/genres`);
