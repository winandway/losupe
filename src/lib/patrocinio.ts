import type { Lang } from "@/i18n/config";
import type { SectionId } from "./sections";

/**
 * PATROCINIO DE SECCIÓN (idea nº 3 del plan de ingresos).
 *
 * Una marca patrocina una sección entera durante un tiempo: su nombre y su frase aparecen en la
 * portada de esa sección y al pie de sus notas. **No se escribe ninguna nota**: eso son los
 * encargos, que van aparte. Aquí solo se acompaña.
 *
 * DOS REGLAS QUE NO SE NEGOCIAN, y son las que hacen que esto se pueda vender sin quemar el medio:
 *
 *   1. **Se dice que es publicidad, siempre y a la vista.** Un patrocinio disimulado es exactamente
 *      lo que hace que Google Noticias eche a un medio, y lo que hace que un lector deje de creerte.
 *   2. **No toca el contenido.** El robot no sabe quién patrocina una sección y no escribe distinto
 *      por ello. Si un patrocinador quiere una nota, la compra como encargo y sale marcada.
 */

export type PatrocinioSeccion = {
  sponsorId: string;
  nombre: string;
  website: string;
  logoUrl: string | null;
  claim: string | null;
  hasta: string | null;
};

/** El patrocinador vigente de una sección, o `null`. Nunca lanza: un anuncio jamás tumba una página. */
export async function patrocinadorDeSeccion(
  db: D1Database,
  sectionId: SectionId,
  lang: Lang,
  ahora = new Date(),
): Promise<PatrocinioSeccion | null> {
  try {
    const row = await db
      .prepare(
        `SELECT id, name, website, logo_url, claim_es, claim_en, section_until
         FROM sponsors
         WHERE status = 'active' AND section_sponsored = ?1
           AND (section_until IS NULL OR section_until > ?2)
         ORDER BY section_until DESC LIMIT 1`,
      )
      .bind(sectionId, ahora.toISOString())
      .first<{
        id: string;
        name: string;
        website: string;
        logo_url: string | null;
        claim_es: string | null;
        claim_en: string | null;
        section_until: string | null;
      }>();
    if (!row) return null;
    return {
      sponsorId: row.id,
      nombre: row.name,
      website: row.website,
      logoUrl: row.logo_url,
      claim: (lang === "en" ? row.claim_en : row.claim_es) || row.claim_es || null,
      hasta: row.section_until,
    };
  } catch {
    return null;
  }
}

/** Todas las secciones patrocinadas ahora mismo, para el panel. */
export async function patrociniosVigentes(
  db: D1Database,
  ahora = new Date(),
): Promise<{ sectionId: string; nombre: string; hasta: string | null }[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT section_sponsored AS sectionId, name AS nombre, section_until AS hasta
         FROM sponsors
         WHERE status = 'active' AND section_sponsored IS NOT NULL
           AND (section_until IS NULL OR section_until > ?1)
         ORDER BY section_sponsored`,
      )
      .bind(ahora.toISOString())
      .all<{ sectionId: string; nombre: string; hasta: string | null }>();
    return results;
  } catch {
    return [];
  }
}
