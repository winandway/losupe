import { isHouseSection } from "@/lib/sections";
import { getProducto, PRODUCTOS, type Producto } from "./productos";

/**
 * EL AVISO DE CONTENIDO DE LA CASA (candado 57).
 *
 * Losupe es de Windoce LLC. Cuando Losupe escribe sobre un producto de Windoce, el lector tiene que
 * saberlo ANTES de leer: lo exige la FTC (publicidad nativa) y lo exige Google Noticias, que saca de
 * sus superficies a los medios que presentan contenido propio o patrocinado como independiente
 * («ownership or affiliate interest… should be clearly disclosed», política de anuncios y contenido
 * patrocinado de Google Noticias, leída el 7 nov 2026).
 *
 * El aviso NO se escribe a mano ni lo escribe el modelo: lo pone este archivo como primer párrafo del
 * cuerpo, en los dos idiomas. Así viaja con la nota a todas partes (la página, el MCP, los asistentes
 * de IA, quien copie el texto). Y `assertAvisoCasa` impide publicar una nota de la sección sin él.
 */

export const ETIQUETA_CASA = { es: "Contenido de la casa:", en: "Brand content:" } as const;

export function textoAviso(p: Producto, lang: "es" | "en"): string {
  if (p.relacion) return `${p.relacion[lang]}.`;
  return lang === "es"
    ? `Losupe y ${p.nombre} son de Windoce LLC.`
    : `Losupe and ${p.nombre} are part of Windoce LLC.`;
}

/** El párrafo exacto que abre toda nota de la casa. */
export function avisoHtml(p: Producto, lang: "es" | "en"): string {
  return `<p class="aviso-casa"><strong>${ETIQUETA_CASA[lang]}</strong> ${textoAviso(p, lang)}</p>`;
}

/** Pone el aviso arriba del cuerpo (y quita uno viejo si ya estaba, para no duplicarlo). */
export function conAviso(html: string, p: Producto, lang: "es" | "en"): string {
  const limpio = html.replace(/^\s*<p class="aviso-casa">[\s\S]*?<\/p>\s*/i, "");
  return `${avisoHtml(p, lang)}\n${limpio.trimStart()}`;
}

export function tieneAviso(html: string, p: Producto, lang: "es" | "en"): boolean {
  return html.trimStart().startsWith(avisoHtml(p, lang));
}

/**
 * CUANDO UN PRODUCTO DE LA CASA SE CUELA EN UNA NOTA QUE NO ES DE LA CASA (25 nov 2026, candado 61).
 *
 * Con el segmento de delivery pasa todos los días: una nota sobre cómo cobran las apps de reparto en
 * América Latina nombra a Rappi, a PedidosYa… y a Divoox, que es de Windoce, la dueña de Losupe.
 * Esa nota NO es contenido de la casa —es periodismo del sector, y Divoox es una empresa más— pero
 * el lector tiene derecho a saber de quién es el medio que se la cuenta, y Google lo exige igual:
 * su política saca de Noticias a quien presenta contenido propio como independiente.
 *
 * Así que el aviso no depende de que alguien se acuerde: se pone solo, en cuanto el texto nombra un
 * producto del grupo, en la sección que sea. Es la diferencia entre un medio con dueño declarado y
 * un folleto disfrazado de periódico — y es lo único que permite hablar de Divoox sin que el
 * segmento entero huela a publicidad.
 */
export const AVISO_RELACION = {
  es: (nombre: string) =>
    `<p class="aviso-casa"><strong>Transparencia:</strong> ${nombre} es de Windoce LLC, la empresa dueña de Losupe. Lo contamos como contamos a cualquier otra empresa del sector.</p>`,
  en: (nombre: string) =>
    `<p class="aviso-casa"><strong>Disclosure:</strong> ${nombre} is owned by Windoce LLC, the company that owns Losupe. We cover it the same way we cover any other company in the industry.</p>`,
} as const;

/** El producto de la casa que nombra este texto, si hay alguno. Busca el nombre entero, no trozos. */
export function productoMencionado(...textos: (string | null | undefined)[]): Producto | undefined {
  const texto = textos.filter(Boolean).join(" ").toLowerCase();
  return PRODUCTOS.find((p) => {
    const n = p.nombre.toLowerCase();
    const i = texto.indexOf(n);
    if (i < 0) return false;
    // Que sea la palabra, no parte de otra: «Divoox» sí, «divooxmania» no.
    const antes = texto[i - 1] ?? " ";
    const despues = texto[i + n.length] ?? " ";
    return !/[a-z0-9]/.test(antes) && !/[a-z0-9]/.test(despues);
  });
}

/** Pone la línea de transparencia arriba del cuerpo (y no la duplica si ya estaba). */
export function conTransparencia(html: string, p: Producto, lang: "es" | "en"): string {
  const limpio = html.replace(/^\s*<p class="aviso-casa">[\s\S]*?<\/p>\s*/i, "");
  return `${AVISO_RELACION[lang](p.nombre)}\n${limpio.trimStart()}`;
}

export function tieneTransparencia(html: string, p: Producto, lang: "es" | "en"): boolean {
  return html.trimStart().startsWith(AVISO_RELACION[lang](p.nombre));
}

export class CasaSinAvisoError extends Error {
  constructor(motivo: string) {
    super(`Nota de la casa sin aviso: ${motivo}`);
    this.name = "CasaSinAvisoError";
  }
}

/**
 * EL CANDADO. Antes de poner una nota en `published`: si es de la sección de la casa, tiene que
 * tener su producto anotado y el aviso exacto al principio del cuerpo en español Y en inglés. Si
 * falta cualquiera de las tres cosas, se lanza y la nota no sale.
 */
export async function assertAvisoCasa(db: D1Database, articleId: string): Promise<void> {
  const art = await db
    .prepare(
      `SELECT a.section_id, h.product_id FROM articles a LEFT JOIN house_notes h ON h.article_id = a.id WHERE a.id = ?1`,
    )
    .bind(articleId)
    .first<{ section_id: string; product_id: string | null }>();
  if (!art) return;
  if (!isHouseSection(art.section_id)) return assertTransparencia(db, articleId);
  const producto = art.product_id ? getProducto(art.product_id) : undefined;
  if (!producto) throw new CasaSinAvisoError("no tiene producto anotado");
  const { results } = await db
    .prepare(`SELECT lang, content_html FROM article_i18n WHERE article_id = ?1`)
    .bind(articleId)
    .all<{ lang: string; content_html: string }>();
  for (const lang of ["es", "en"] as const) {
    const fila = results.find((r) => r.lang === lang);
    if (!fila) throw new CasaSinAvisoError(`falta la versión en ${lang}`);
    if (!tieneAviso(fila.content_html, producto, lang))
      throw new CasaSinAvisoError(`el texto en ${lang} no empieza con el aviso`);
  }
}

/**
 * EL MISMO CANDADO, PARA LAS NOTAS DE FUERA. Si una nota de cualquier sección nombra un producto del
 * grupo y no lleva su línea de transparencia, no se publica.
 */
export async function assertTransparencia(db: D1Database, articleId: string): Promise<void> {
  const { results } = await db
    .prepare(`SELECT lang, title, excerpt, content_html FROM article_i18n WHERE article_id = ?1`)
    .bind(articleId)
    .all<{ lang: string; title: string; excerpt: string | null; content_html: string }>();
  for (const fila of results ?? []) {
    if (fila.lang !== "es" && fila.lang !== "en") continue;
    const p = productoMencionado(fila.title, fila.excerpt, fila.content_html);
    if (!p) continue;
    if (!tieneTransparencia(fila.content_html, p, fila.lang))
      throw new CasaSinAvisoError(
        `la nota nombra a ${p.nombre} (producto de la casa) y el texto en ${fila.lang} no lleva la línea de transparencia`,
      );
  }
}

/**
 * PONERLA, no solo exigirla. Un candado que únicamente rechaza dejaría sin publicar toda nota del
 * sector que nombre a Divoox — justo las que Richard quiere. Así que antes de publicar se añade
 * sola, y después `assertTransparencia` comprueba que está. Nunca se pierde una nota y nunca sale
 * una sin decir de quién es la empresa.
 *
 * **NO TOCA LAS NOTAS DE LA CASA.** Esas ya llevan su aviso, que es más fuerte («Contenido de la
 * casa»), y las dos líneas se escriben en el mismo sitio: sin esta comprobación, la de transparencia
 * le borraba la suya y tumbaba el candado 57 entero. Lo cazó la prueba de la casa el mismo día.
 */
export async function ponerTransparencia(db: D1Database, articleId: string): Promise<number> {
  let puestas = 0;
  const art = await db
    .prepare(`SELECT section_id FROM articles WHERE id = ?1`)
    .bind(articleId)
    .first<{ section_id: string }>();
  if (!art || isHouseSection(art.section_id)) return 0;
  const { results } = await db
    .prepare(`SELECT lang, title, excerpt, content_html FROM article_i18n WHERE article_id = ?1`)
    .bind(articleId)
    .all<{ lang: string; title: string; excerpt: string | null; content_html: string }>();
  for (const fila of results ?? []) {
    if (fila.lang !== "es" && fila.lang !== "en") continue;
    const p = productoMencionado(fila.title, fila.excerpt, fila.content_html);
    if (!p || tieneTransparencia(fila.content_html, p, fila.lang)) continue;
    await db
      .prepare(`UPDATE article_i18n SET content_html = ?3 WHERE article_id = ?1 AND lang = ?2`)
      .bind(articleId, fila.lang, conTransparencia(fila.content_html, p, fila.lang))
      .run();
    puestas += 1;
  }
  return puestas;
}
