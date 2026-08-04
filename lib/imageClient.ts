import { randomUUID } from "crypto";
import { google } from "@ai-sdk/google";
import { generateImage } from "ai";
import { put } from "@vercel/blob";

// Nano Banana — character-consistency-tuned, kid-safe filters + SynthID watermark.
// Swappable: any GoogleImageModelId (e.g. an Imagen 4 fallback) drops in here.
const IMAGE_MODEL = "gemini-2.5-flash-image";

const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// Generates a cover image and stores it in Vercel Blob, returning the public URL.
// Throws on any failure; the caller turns that into a graceful "no image" response.
export async function generateIllustration(prompt: string): Promise<string> {
  const { image } = await generateImage({
    model: google.image(IMAGE_MODEL),
    prompt,
    aspectRatio: "4:3",
  });

  const extension = EXTENSION_BY_MEDIA_TYPE[image.mediaType] ?? "png";
  const { url } = await put(`story-covers/${randomUUID()}.${extension}`, Buffer.from(image.uint8Array), {
    access: "public",
    contentType: image.mediaType,
  });

  return url;
}
