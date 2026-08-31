import { SQL_NOW } from "@/lib/sql-time";
import { illustrate, type ImageEnv } from "./images";

/**
 * EL RESCATE: ninguna nota se queda sin foto.
 *
 * Nace de una crítica de Richard del 30 ago 2026, y tenía toda la razón. La nota de los cierres de
 * cuentas salía en la portada con un icono dibujado, **al lado de tres notas con fotos reales**. Sus
 * palabras: *«pareciera que es una imagen de esas que salen cuando falta una imagen»*. Y eso es
 * exactamente lo que parecía: no porque el dibujo estuviera mal hecho, sino porque **junto a fotos
 * de verdad, un icono se lee como un hueco**.
 *
 * La causa era más tonta de lo que parecía: `PEXELS_API_KEY` lleva días puesta y el robot ilustra
 * todas sus notas. Pero esa nota **se sembró a mano desde el repositorio** y las semillas nunca
 * pasaban por el ilustrador. Nadie las miraba.
 *
 * Así que el arreglo no es «ponerle una foto a esa nota»: es que **cualquier nota publicada sin
 * imagen se ilustre sola**, venga del robot, de una semilla o del panel. Un fallo se arregla para
 * todas, no para la que se vio.
 */

export type ResultadoRescate = {
  /** Notas sin foto que se encontraron. */
  encontradas: number;
  /** Cuántas quedaron ilustradas. */
  ilustradas: number;
  errores: string[];
};

/**
 * Palabras para buscar la foto, sacadas del titular.
 *
 * Se busca con el titular EN INGLÉS cuando existe: los bancos de fotos tienen mucho más material
 * etiquetado en inglés, y una búsqueda en español devuelve resultados pobres o nada.
 *
 * Y se quitan las palabras que no se pueden fotografiar. «20.682 quejas en seis meses» no es una
 * imagen; «bank account closed» sí. Buscar el titular entero devuelve fotos genéricas de oficina
 * que no dicen nada — que es justo lo que hay que evitar.
 */
const VACIAS = new Set([
  "the",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "from",
  "by",
  "at",
  "as",
  "and",
  "or",
  "but",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "what",
  "which",
  "how",
  "when",
  "where",
  "not",
  "no",
  "yes",
  "all",
  "any",
  "can",
  "could",
  "will",
  "would",
  "has",
  "have",
  "had",
  "about",
  "into",
  "over",
  "after",
  "before",
  "more",
  "most",
  "new",
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "de",
  "del",
  "al",
  "en",
  "que",
  "como",
  "por",
  "para",
  "con",
  "sin",
  "sobre",
  "su",
  "sus",
  "se",
  "es",
  "son",
  "y",
  "o",
  "lo",
  "le",
  "les",
  "ya",
  "mas",
  "muy",
]);

/** Palabras que no se pueden fotografiar: cifras, medidas de tiempo, muletillas de titular. */
const NO_FOTOGRAFIABLE =
  /^\d[\d.,%]*$|^(mes|meses|month|months|semana|semanas|week|weeks|año|años|year|years|día|días|day|days|hora|horas|hour|hours|guía|guide|claves|keys|razones|reasons|cosas|things|curiosidades|facts)$/i;

export function palabrasParaFoto(titulo: string, tituloEn?: string | null): string[] {
  const base = (tituloEn?.trim() || titulo).toLowerCase();
  const palabras = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 2 && !VACIAS.has(p) && !NO_FOTOGRAFIABLE.test(p));
  // Las primeras del titular son las que llevan el tema; las últimas suelen ser la coletilla.
  return [...new Set(palabras)].slice(0, 3);
}

type FilaSinImagen = {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
};

/** Notas publicadas que no tienen imagen. */
export async function notasSinImagen(db: D1Database, limite = 5): Promise<FilaSinImagen[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id,
              es.slug AS slug,
              es.title AS title,
              (SELECT title FROM article_i18n WHERE article_id = a.id AND lang = 'en') AS title_en
         FROM articles a
         JOIN article_i18n es ON es.article_id = a.id AND es.lang = 'es'
        WHERE a.status = 'published'
          AND (a.image_url IS NULL OR a.image_url = '')
        ORDER BY a.published_at DESC
        LIMIT ?1`,
    )
    .bind(limite)
    .all<FilaSinImagen>();
  return results ?? [];
}

/**
 * Le pone foto a las notas que no la tienen.
 *
 * **Nunca lanza.** Esto corre por detrás de la publicación: si falla, la nota ya está en el sitio y
 * conserva su portada dibujada, que para eso está. Pero el fallo queda escrito y sale en el panel —
 * un rescate que se cae en silencio es como no tenerlo.
 */
export async function rescatarImagenes(
  db: D1Database,
  env: ImageEnv,
  opts: { limite?: number; fetchImpl?: typeof fetch } = {},
): Promise<ResultadoRescate> {
  const out: ResultadoRescate = { encontradas: 0, ilustradas: 0, errores: [] };
  try {
    const pendientes = await notasSinImagen(db, opts.limite ?? 5);
    out.encontradas = pendientes.length;
    for (const nota of pendientes) {
      try {
        const keywords = palabrasParaFoto(nota.title, nota.title_en);
        const { image, errors } = await illustrate({
          env,
          db,
          // El prompt solo lo usa la generación con IA; para el banco de fotos manda `keywords`.
          prompt: nota.title_en || nota.title,
          keywords,
          slug: nota.slug,
          fetchImpl: opts.fetchImpl,
        });
        if (!image) {
          out.errores.push(
            `${nota.slug}: sin foto${errors.length ? ` (${errors.join("; ")})` : ""}`,
          );
          continue;
        }
        await db
          .prepare(
            `UPDATE articles
                SET image_url = ?2, image_credit = ?3, updated_at = ${SQL_NOW}
              WHERE id = ?1`,
          )
          .bind(nota.id, image.url, image.credit)
          .run();
        out.ilustradas += 1;
      } catch (error) {
        out.errores.push(`${nota.slug}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    out.errores.push(error instanceof Error ? error.message : String(error));
  }
  return out;
}
