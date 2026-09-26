"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/* Must forward client-side, never via a server redirect: a 307 means /r/[slug] never renders, the
   Analytics beacon never fires, and the link silently records nothing. The pageview for the /r path
   is queued on mount, so replacing the URL straight after doesn't lose it. */
export function TrackingForward() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return <p className="m-auto text-sm opacity-60">Opening Storykins…</p>;
}
