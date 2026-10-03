import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl()}/`, changeFrequency: "hourly", priority: 1 },
    { url: `${siteUrl()}/guide`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl()}/about`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl()}/api/feed.xml`, changeFrequency: "hourly", priority: 0.5 },
  ];
}
