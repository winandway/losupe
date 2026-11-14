import type { MetadataRoute } from "next";
import { LANGS } from "@/i18n/config";
import { getDb } from "@/lib/db";
import { listForSitemap } from "@/lib/queries";
import { isSectionId, SECTIONS } from "@/lib/sections";
import { medioUrl } from "@/lib/seo";
import { getBaseUrl } from "@/lib/site";
import { aboutPath, absoluteUrl, articlePath, homePath, sectionPath, staticPath } from "@/lib/urls";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await getBaseUrl();
  // Si la base falla, el sitemap NO devuelve 500 (Google lo marcaría como «no se ha podido
  // obtener» y dejaría de rastrear): sale con las páginas fijas y el fallo queda en el registro
  // del worker y en el canario de /__health.
  let rows: Awaited<ReturnType<typeof listForSitemap>> = [];
  try {
    rows = await listForSitemap(await getDb());
  } catch (error) {
    console.error("sitemap: la base no respondió", error);
  }

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
    entries.push({
      url: absoluteUrl(base, staticPath("publish", lang)),
      changeFrequency: "monthly",
      priority: 0.6,
      alternates: {
        languages: {
          es: absoluteUrl(base, staticPath("publish", "es")),
          en: absoluteUrl(base, staticPath("publish", "en")),
        },
      },
    });
    // Contacto va con prioridad de página institucional principal: es de las primeras que mira un
    // revisor de Google Noticias.
    for (const key of ["contact", "widget", "editorial", "privacy", "terms"] as const) {
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
    {
      es?: string;
      en?: string;
      updated: string;
      published: string;
      section: string;
      image?: string;
      video?: string;
      poster?: string;
      titulo: Partial<Record<string, string>>;
      resumen: Partial<Record<string, string>>;
    }
  >();
  for (const r of rows) {
    const entry = byArticle.get(r.id) ?? {
      updated: r.updated_at,
      published: r.published_at,
      section: r.section_id,
      image: r.image_url ?? undefined,
      // `video_url` vacío (no nulo) significa «se miró y no corresponde» (candado 56).
      video: r.video_url?.trim() ? r.video_url : undefined,
      poster: r.video_poster?.trim() ? r.video_poster : undefined,
      titulo: {} as Partial<Record<string, string>>,
      resumen: {} as Partial<Record<string, string>>,
    };
    if (r.lang === "es") entry.es = r.slug;
    if (r.lang === "en") entry.en = r.slug;
    entry.titulo[r.lang] = r.title;
    if (r.excerpt) entry.resumen[r.lang] = r.excerpt;
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
        // LA IMAGEN VA EN EL SITEMAP. Sin esto Google no tiene por dónde encontrarla, y por eso
        // buscar «losupe» en Google Imágenes no devolvía ni una foto nuestra (24 ago 2026).
        ...(entry.image ? { images: [absoluteUrl(base, entry.image)] } : {}),
        // Y EL VIDEO TAMBIÉN. Mismo motivo que la imagen, comprobado el 10 nov 2026: Search Console
        // decía «vídeos descubiertos: 0» en los dos mapas y «0 vídeos indexados», porque el video no
        // se declaraba en ninguna parte. Sin miniatura no se puede declarar: Google la exige.
        ...(entry.video && (entry.poster || entry.image)
          ? {
              videos: [
                {
                  title: (entry.titulo[lang] ?? entry.titulo.es ?? "losupe").slice(0, 100),
                  thumbnail_loc: medioUrl(base, (entry.poster ?? entry.image) as string),
                  description: (
                    entry.resumen[lang] ??
                    entry.titulo[lang] ??
                    entry.titulo.es ??
                    "losupe"
                  ).slice(0, 2048),
                  content_loc: medioUrl(base, entry.video),
                  // SIN player_loc. Google: «no debe ser la misma dirección que <loc>», y lo era en
                  // los 310 videos (14 nov 2026). Con content_loc basta (candado 61).
                  publication_date: entry.published,
                  family_friendly: "yes" as const,
                  requires_subscription: "no" as const,
                },
              ],
            }
          : {}),
      });
    }
  }
  return entries;
}
