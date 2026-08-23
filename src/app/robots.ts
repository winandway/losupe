import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getBaseUrl();
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/__scheduled", "/__health"] }],
    sitemap: [`${base}/sitemap.xml`, `${base}/news-sitemap.xml`],
    host: base,
  };
}
