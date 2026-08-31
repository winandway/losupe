import { SQL_NOW } from "@/lib/sql-time";
import { generateJson } from "./gemini";
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
 * QUÉ SE DEBERÍA VER EN LA FOTO.
 *
 * Aquí me equivoqué, y salió a la vista: la primera versión sacaba las tres primeras palabras
 * «útiles» del titular en inglés. Para «the **wave** of bank account closures» eso dio *wave*, y el
 * banco de fotos devolvió, muy obedientemente, **una ola del mar** para una nota sobre cierres de
 * cuentas bancarias. Una foto real que no tiene nada que ver es peor que un icono: el icono al menos
 * no miente.
 *
 * El fallo de fondo: un titular no describe una foto. Lleva cifras («20.682»), metáforas («la ola
 * de», «golpea») y giros que no se pueden fotografiar. Lo que hay que buscar es **el objeto o la
 * escena concreta** de la que habla la nota.
 *
 * Por eso ahora se le pregunta al modelo, que es lo que ya hacía el redactor con sus notas
 * (`image_keywords`). Cuesta milésimas de centavo con `flash-lite` y acierta. La heurística queda
 * de respaldo para cuando no hay llave, y ya no se come las metáforas.
 */

/** Metáforas y verbos de titular que devuelven fotos absurdas si se buscan literalmente. */
const METAFORAS =
  /^(ola|wave|oleada|golpe|golpea|hits|hitting|sacude|shakes|tsunami|terremoto financiero|lluvia|avalancha|tormenta|storm|batalla|battle|guerra|war|pulso|carrera|race|boom|caida libre)$/i;

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
    .filter(
      (p) => p.length > 2 && !VACIAS.has(p) && !NO_FOTOGRAFIABLE.test(p) && !METAFORAS.test(p),
    );
  // Se toman las ÚLTIMAS, no las primeras. En un titular de diario la parte de delante lleva el
  // gancho (la cifra, la metáfora) y el sustantivo de verdad viene detrás: «la ola de cierres de
  // **cuentas bancarias**». Tomando las primeras salía «wave», y con eso una ola del mar.
  return [...new Set(palabras)].slice(-3);
}

export const SISTEMA_FOTO = `Eres el editor gráfico de un diario. Te dan el titular y la entradilla de una nota y dices QUÉ SE DEBERÍA VER en la foto que la acompaña.

Reglas:
- Responde con 2 o 3 palabras EN INGLÉS, separadas por espacios, que describan un OBJETO o una ESCENA que se pueda fotografiar.
- Nada de metáforas ni conceptos abstractos. Si el titular dice «la ola de cierres de cuentas», la foto no es una ola del mar: es una tarjeta bancaria, un cajero automático o la fachada de un banco.
- **Fotografía LA COSA de la que habla la nota, no a quién le pasa.** Para una nota sobre cuentas bancarias cerradas a inmigrantes, la foto es el banco o la tarjeta, no una manifestación.
- **Nada de carteles, pancartas ni texto escrito** en la imagen, salvo que la nota sea justamente sobre una protesta. Una pancarta le pone al diario una opinión que la nota no tiene.
- Nada de cifras, fechas ni nombres de leyes.
- Piensa qué foto pondría un diario serio en esa página: la escena del hecho, en calma.

Ejemplos:
«20.682 quejas por cierres de cuentas bancarias a inmigrantes» → bank card atm
«Diez años sin Juan Gabriel» → vintage microphone stage
«El precio del café bate su récord» → coffee beans harvest`;

export const ESQUEMA_FOTO = {
  type: "object",
  properties: { buscar: { type: "string" } },
  required: ["buscar"],
} as const;

/**
 * Le pregunta al modelo qué debería verse. Si no hay llave o falla, devuelve `null` y manda la
 * heurística: es un adorno de calidad, no un requisito para publicar.
 */
export async function preguntarQueFoto(opts: {
  apiKey?: string;
  titulo: string;
  entradilla?: string | null;
  fetchImpl?: typeof fetch;
}): Promise<string[] | null> {
  if (!opts.apiKey) return null;
  try {
    const r = await generateJson<{ buscar: string }>({
      apiKey: opts.apiKey,
      model: "gemini-2.5-flash-lite",
      system: SISTEMA_FOTO,
      prompt: `TITULAR: ${opts.titulo}\n${opts.entradilla ? `ENTRADILLA: ${opts.entradilla}` : ""}`,
      responseSchema: ESQUEMA_FOTO,
      temperature: 0,
      maxOutputTokens: 120,
      timeoutMs: 15_000,
      fetchImpl: opts.fetchImpl,
    });
    const palabras = (r.data.buscar ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((p) => p.length > 2 && !METAFORAS.test(p));
    return palabras.length > 0 ? palabras.slice(0, 3) : null;
  } catch {
    return null;
  }
}

type FilaSinImagen = {
  id: string;
  slug: string;
  title: string;
  title_en: string | null;
  excerpt: string | null;
};

/** Notas publicadas que no tienen imagen. */
export async function notasSinImagen(db: D1Database, limite = 5): Promise<FilaSinImagen[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id,
              es.slug AS slug,
              es.title AS title,
              es.excerpt AS excerpt,
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

/** Una nota concreta, tenga foto o no: para el botón «otra foto» del panel. */
export async function notaConcreta(db: D1Database, id: string): Promise<FilaSinImagen[]> {
  const fila = await db
    .prepare(
      `SELECT a.id,
              es.slug AS slug,
              es.title AS title,
              es.excerpt AS excerpt,
              (SELECT title FROM article_i18n WHERE article_id = a.id AND lang = 'en') AS title_en
         FROM articles a
         JOIN article_i18n es ON es.article_id = a.id AND es.lang = 'es'
        WHERE a.id = ?1`,
    )
    .bind(id)
    .first<FilaSinImagen>();
  return fila ? [fila] : [];
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
  opts: {
    limite?: number;
    /**
     * Rehacer la foto de UNA nota concreta, aunque ya tenga. Es el botón «otra foto» del panel:
     * el que decide si una foto pega con la nota es una persona, no un modelo.
     */
    articleId?: string;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<ResultadoRescate> {
  const out: ResultadoRescate = { encontradas: 0, ilustradas: 0, errores: [] };
  try {
    const pendientes = opts.articleId
      ? await notaConcreta(db, opts.articleId)
      : await notasSinImagen(db, opts.limite ?? 5);
    out.encontradas = pendientes.length;
    for (const nota of pendientes) {
      try {
        // Primero el editor gráfico: dice qué se debería VER. Si no hay llave o falla, la
        // heurística. Nunca se queda sin buscar.
        const keywords =
          (await preguntarQueFoto({
            apiKey: (env as { GEMINI_API_KEY?: string }).GEMINI_API_KEY,
            titulo: nota.title,
            entradilla: nota.excerpt,
            fetchImpl: opts.fetchImpl,
          })) ?? palabrasParaFoto(nota.title, nota.title_en);
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
