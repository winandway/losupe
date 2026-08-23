import type { MetadataRoute } from "next";
import { LANGS } from "@/i18n/config";
import { getDb } from "@/lib/db";
import { listForSitemap } from "@/lib/queries";
import { isSectionId, SECTIONS } from "@/lib/sections";
import { getBaseUrl } from "@/lib/site";
import { aboutPath, absoluteUrl, articlePath, homePath, sectionPath, staticPath } from "@/lib/urls";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [base, db] = await Promise.all([getBaseUrl(), getDb()]);
  const rows = await listForSitemap(db);

  const entries: MetadataRoute.Sitemap = [];
  for (const lang of LANGS) {
    entries.push({
      url: absoluteUrl(base, homePath(lang)),
      changeFrequency: "hourly",
      priority: 1,
      alternates: {
        languages: { es: absoluteUrl(base, homePath("es")), en: absoluteUrl(base, homePath("en")) },
      },
    });
    entries.push({
      url: absoluteUrl(base, aboutPath(lang)),
      changeFrequency: "monthly",
      priority: 0.3,
      alternates: {
        languages: {
          es: absoluteUrl(base, aboutPath("es")),
          en: absoluteUrl(base, aboutPath("en")),
        },
      },
    });
    for (const key of ["editorial", "privacy", "terms"] as const) {
      entries.push({
        url: absoluteUrl(base, staticPath(key, lang)),
        changeFrequency: "yearly",
        priority: 0.2,
        alternates: {
          languages: {
            es: absoluteUrl(base, staticPath(key, "es")),
            en: absoluteUrl(base, staticPath(key, "en")),
          },
        },
      });
    }
    for (const s of SECTIONS) {
      entries.push({
        url: absoluteUrl(base, sectionPath(lang, s.id)),
        changeFrequency: "daily",
        priority: 0.8,
        alternates: {
          languages: {
            es: absoluteUrl(base, sectionPath("es", s.id)),
            en: absoluteUrl(base, sectionPath("en", s.id)),
          },
        },
      });
    }
  }

  // Agrupa traducciones por artículo para declarar hreflang.
  const byArticle = new Map<
    string,
    { es?: string; en?: string; updated: string; section: string }
  >();
  for (const r of rows) {
    const entry = byArticle.get(r.id) ?? { updated: r.updated_at, section: r.section_id };
    if (r.lang === "es") entry.es = r.slug;
    if (r.lang === "en") entry.en = r.slug;
    byArticle.set(r.id, entry);
  }
  for (const entry of byArticle.values()) {
    if (!isSectionId(entry.section)) continue;
    const languages: Record<string, string> = {};
    if (entry.es) languages.es = absoluteUrl(base, articlePath("es", entry.section, entry.es));
    if (entry.en) languages.en = absoluteUrl(base, articlePath("en", entry.section, entry.en));
    for (const lang of LANGS) {
      const slug = entry[lang];
      if (!slug) continue;
      entries.push({
        url: absoluteUrl(base, articlePath(lang, entry.section, slug)),
        lastModified: new Date(entry.updated),
        changeFrequency: "weekly",
        priority: 0.7,
        alternates: { languages },
      });
    }
  }
  return entries;
}
