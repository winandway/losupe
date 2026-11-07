import { isHouseSection } from "@/lib/sections";
import { getProducto, type Producto } from "./productos";

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
  if (!art || !isHouseSection(art.section_id)) return;
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
