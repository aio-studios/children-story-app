"use client";

import { useEffect } from "react";
import { Analytics, type BeforeSend } from "@vercel/analytics/next";

/* Vercel Web Analytics with Sarthak's own devices filtered out (#96). Opening any page once with
   `?notrack=1` marks that browser; `?notrack=0` unmarks it. Without this, his daily testing buries
   the handful of real recruiter visits the /r/[slug] links exist to surface.

   A client wrapper because `beforeSend` is a function, and app/layout.tsx is a Server Component. */

const OPT_OUT_KEY = "va-disable";

// Module-level so the reference is stable; <Analytics> re-registers beforeSend whenever it changes.
const beforeSend: BeforeSend = (event) => {
  try {
    return localStorage.getItem(OPT_OUT_KEY) ? null : event;
  } catch {
    // Storage can throw (Safari private mode, blocked site data) - count the visit rather than drop it.
    return event;
  }
};

export function SiteAnalytics() {
  // Runs before the pageview is sent: the tracking script loads async, after this effect flush.
  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get("notrack");
    try {
      if (flag === "1") localStorage.setItem(OPT_OUT_KEY, "1");
      if (flag === "0") localStorage.removeItem(OPT_OUT_KEY);
    } catch {}
  }, []);

  return <Analytics beforeSend={beforeSend} />;
}
