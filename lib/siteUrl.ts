/* Canonical origin for metadata, robots and the sitemap.

   `VERCEL_PROJECT_PRODUCTION_URL` is injected by Vercel and always points at the *production*
   domain, even when the code is running on a preview deployment - which is what canonical URLs and
   robots/sitemap entries should reference. It carries no protocol, hence the prefix.

   Update the fallback if the production domain ever changes (or set NEXT_PUBLIC_SITE_URL). */
const FALLBACK_ORIGIN = "https://children-story-app-lac.vercel.app";

/* Vercel's own URL env vars carry no scheme, so it's an easy mistake to set NEXT_PUBLIC_SITE_URL the
   same way. `new URL()` in layout.tsx would then throw and fail the entire build with an opaque
   "Invalid URL" - so normalise here instead of trusting the value. */
function withScheme(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit?.trim()) return withScheme(explicit);

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel?.trim()) return withScheme(vercel);

  return FALLBACK_ORIGIN;
}
