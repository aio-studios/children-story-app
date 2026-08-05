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
