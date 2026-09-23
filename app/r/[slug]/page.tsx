import type { Metadata } from "next";
import { TrackingForward } from "@/components/TrackingForward";

/* Per-application tracking links (#96): /r/acme goes on the Acme application, so a hit on that path
   in Vercel Analytics means that application was opened. Any slug is accepted - minting a link needs
   no code change, and employer names stay out of this public repo. */

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function TrackingLinkPage() {
  return <TrackingForward />;
}
