import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Per-CVE NVD proxy and the health check aren't content, and each
      // crawl hit would spend upstream quota
      disallow: ["/api/cve/", "/api/health"],
    },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
