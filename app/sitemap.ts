import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteUrl();
  return [
    { url: origin, changeFrequency: "monthly", priority: 1 },
    { url: `${origin}/create`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
