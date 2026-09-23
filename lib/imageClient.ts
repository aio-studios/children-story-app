import { randomUUID } from "crypto";
import { google } from "@ai-sdk/google";
import { generateImage } from "ai";
import { del, put } from "@vercel/blob";

// Nano Banana — character-consistency-tuned, kid-safe filters + SynthID watermark.
// Swappable: any GoogleImageModelId (e.g. an Imagen 4 fallback) drops in here.
const IMAGE_MODEL = "gemini-2.5-flash-image";

const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// All covers live under this Blob path prefix.
const BLOB_PATH_PREFIX = "story-covers/";

// Generates a cover image and stores it in Vercel Blob, returning the public URL.
// Throws on any failure; the caller turns that into a graceful "no image" response.
export async function generateIllustration(prompt: string): Promise<string> {
  const { image } = await generateImage({
    model: google.image(IMAGE_MODEL),
    prompt,
    aspectRatio: "4:3",
  });

  const extension = EXTENSION_BY_MEDIA_TYPE[image.mediaType] ?? "png";
  const { url } = await put(`${BLOB_PATH_PREFIX}${randomUUID()}.${extension}`, Buffer.from(image.uint8Array), {
    access: "public",
    contentType: image.mediaType,
  });

  return url;
}

// Blob serves every store from a subdomain of this, and put() only ever hands back https.
const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

// One agreed spelling of a cover URL, for both the "is this still referenced?" check and the delete
// that follows it. The two steps identify a blob DIFFERENTLY: the check is byte-exact string equality
// against stories.image_url, while del() accepts several spellings of the same object (a pathname, a
// downloadUrl, a stray query string) and resolves them server-side. Without a single canonical form,
// `<cover-url>?x=1` matches no row, reads as unreferenced, and deletes a cover a saved story is still
// pointing at. Returns null for anything that isn't one of our own cover URLs.
export function canonicalCoverUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== "https:") return null;
  if (!host.endsWith(BLOB_HOST_SUFFIX)) return null;
  if (!parsed.pathname.startsWith(`/${BLOB_PATH_PREFIX}`)) return null;
  // Exactly what put() stored: origin + pathname, never the query or hash.
  return `https://${host}${parsed.pathname}`;
}

// Best-effort cleanup of a superseded cover so replaced/regenerated/abandoned images don't accumulate
// in Blob (#46). Guarded to our own story-covers path (a caller can't ask us to delete an arbitrary
// URL) and never throws - a failed delete must not break the response, and the orphan is only a small
// storage cost. del() is idempotent, so re-deleting an already-gone URL is a no-op.
export async function deleteIllustration(url: string): Promise<void> {
  if (!url.includes(`/${BLOB_PATH_PREFIX}`)) return;
  try {
    await del(url);
  } catch (error) {
    console.error("Failed to delete superseded illustration:", error);
  }
}
