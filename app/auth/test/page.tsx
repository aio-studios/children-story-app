import { notFound } from "next/navigation";
import AuthTestHarness from "./AuthTestHarness";

// Reachable in local dev and on Vercel preview deploys, never on production. The phone test for #92
// runs against a preview URL, so gating on NODE_ENV would be useless here - Vercel builds previews
// with NODE_ENV=production. VERCEL_ENV is the one that distinguishes preview from production.
//
// Server-side notFound() rather than a client-side check: the latter would still ship the harness in
// the production bundle and merely hide it.
// Without this the page is statically prerendered and the gate is baked in at build time rather than
// evaluated per request - a stale build could keep serving the harness after the env changed.
export const dynamic = "force-dynamic";

export default function AuthTestPage() {
  if (process.env.VERCEL_ENV === "production") {
    notFound();
  }
  return <AuthTestHarness />;
}
