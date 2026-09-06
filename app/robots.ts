import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The API routes cost money per call and have nothing to index.
      disallow: "/api/",
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
