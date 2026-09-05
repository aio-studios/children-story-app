import { notFound } from "next/navigation";
import AuthTestHarness from "./AuthTestHarness";

// TEMPORARY (#92, Step 3) - deleted at Step 7.
//
// Gating is server-side and layered, because this page can send real email:
//  1. Never on production. VERCEL_ENV (not NODE_ENV) is the discriminator - Vercel builds preview
//     deploys with NODE_ENV=production, so NODE_ENV can't tell preview from production.
//  2. On any deploy, a matching ?t= token is also required. Preview URLs are effectively public and
//     the env vars point at the PRODUCTION Supabase project and Brevo sender, so an ungated harness
//     is an open magic-link sender: anyone who finds the URL can burn the 300/day quota and take
//     production sign-in down with it.
//  3. Locally (no VERCEL_ENV) it stays open - no token to fumble while developing.
export const dynamic = "force-dynamic";

export default async function AuthTestPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  if (process.env.VERCEL_ENV === "production") notFound();

  if (process.env.VERCEL_ENV) {
    const expected = process.env.AUTH_HARNESS_TOKEN;
    const provided = (await searchParams).t;
    // Fails closed: an unset token means unreachable, not wide open.
    if (!expected || provided !== expected) notFound();
  }

  return <AuthTestHarness />;
}
