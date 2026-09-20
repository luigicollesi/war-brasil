import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/src/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  return [
    {
      url: new URL("/", siteUrl).toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: new URL("/terms", siteUrl).toString(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: new URL("/privacy", siteUrl).toString(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
