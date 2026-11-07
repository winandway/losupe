import { getDb } from "@/lib/db";
import { listRecentForNews } from "@/lib/queries";
import { buildNewsSitemap } from "@/lib/rss";
import { isHouseSection, isSectionId } from "@/lib/sections";
import { baseUrlFromRequest } from "@/lib/site";
import { absoluteUrl, articlePath } from "@/lib/urls";

export const dynamic = "force-dynamic";

// Google News solo toma notas de las últimas 48 horas.
const WINDOW_MS = 48 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const base = baseUrlFromRequest(request);
  const db = await getDb();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const rows = await listRecentForNews(db, since);
  const xml = buildNewsSitemap(
    "losupe",
    rows
      // Contenido de la casa (Desde Windoce) FUERA del mapa de Google Noticias: no es noticia
      // independiente. Sí va en el mapa normal del sitio (candado 57).
      .filter(
        (r) =>
          isSectionId(r.section_id) &&
          !isHouseSection(r.section_id) &&
          (r.lang === "es" || r.lang === "en"),
      )
      .map((r) => ({
        loc: absoluteUrl(
          base,
          articlePath(r.lang === "en" ? "en" : "es", r.section_id as "economia", r.slug),
        ),
        title: r.title,
        publicationDate: r.published_at,
        language: r.lang,
      })),
  );
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
