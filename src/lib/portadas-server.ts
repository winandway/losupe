import { miniaturaSvg, portadaSvg } from "./portadas";
import { SECTION_IDS, type SectionId } from "./sections";

/**
 * Busca el titular de una nota y devuelve su portada dibujada.
 *
 * Va aparte de `portadas.ts` a propósito: ese archivo es dibujo puro y se puede probar sin base de
 * datos ni worker. Aquí vive lo único que necesita la base.
 */
export async function portadaDeNota(
  db: D1Database | undefined,
  articleId: string,
  /** `true` para la versión de tarjeta: solo el símbolo, sin titular dentro. */
  mini = false,
): Promise<string | null> {
  if (!db || !articleId) return null;
  try {
    const fila = await db
      .prepare(
        `SELECT i.title, i.lang, a.section_id
           FROM articles a JOIN article_i18n i ON i.article_id = a.id
          WHERE a.id = ?1
          ORDER BY CASE i.lang WHEN 'es' THEN 0 ELSE 1 END
          LIMIT 1`,
      )
      .bind(articleId)
      .first<{ title: string; lang: string; section_id: string }>();
    if (!fila?.title) return null;
    const sectionId = (SECTION_IDS as readonly string[]).includes(fila.section_id)
      ? (fila.section_id as SectionId)
      : "economia";
    const opciones = {
      titulo: fila.title,
      sectionId,
      lang: (fila.lang === "en" ? "en" : "es") as "es" | "en",
    };
    return mini ? miniaturaSvg(opciones) : portadaSvg(opciones);
  } catch {
    return null;
  }
}
