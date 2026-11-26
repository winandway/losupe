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
  // Las notas de periodismo no llevan ningún aviso nuestro: la propiedad vive en la política
  // editorial, no grapada a cada artículo (candado 65).
  if (!isHouseSection(art.section_id)) return;
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
 * LA PROPIEDAD SE DECLARA EN LA CABECERA DEL MEDIO, NO EN CADA NOTA (26 nov 2026, candado 65).
 *
 * Durante un día, toda nota de periodismo que nombrara un producto del grupo salía con un párrafo
 * arriba diciendo de quién era la empresa. Richard lo tumbó: _«no hay imparcialidad en eso, estás
 * diciendo: mira, somos los dueños… no veo a Bing poniendo una etiqueta porque Windows es de la
 * casa. Me parece ridículo»_. Y es verdad: un recuadro que anuncia la propiedad llama más la
 * atención sobre el vínculo que la propia mención, y eso es lo contrario de ser una empresa más.
 *
 * Dónde vive la propiedad ahora: en la página de política editorial, que la declara entera y con
 * todos los productos por su nombre, y en el pie que dice quién edita el medio. Es donde la pone
 * cualquier periódico: en la cabecera, no grapada a cada artículo.
 *
 * Esta función hace lo contrario de la de antes: si una nota de periodismo arrastra un párrafo de
 * esos (de los que se publicaron esos dos días), lo quita. Solo escribe si lo encuentra.
 */
export async function quitarLineaDePropiedad(db: D1Database, articleId: string): Promise<number> {
  const art = await db
    .prepare(`SELECT section_id FROM articles WHERE id = ?1`)
    .bind(articleId)
    .first<{ section_id: string }>();
  if (!art || isHouseSection(art.section_id)) return 0;
  const { results } = await db
    .prepare(`SELECT lang, content_html FROM article_i18n WHERE article_id = ?1`)
    .bind(articleId)
    .all<{ lang: string; content_html: string }>();
  let quitadas = 0;
  for (const fila of results ?? []) {
    const limpio = sinLineaDePropiedad(fila.content_html);
    if (limpio === fila.content_html) continue;
    await db
      .prepare(`UPDATE article_i18n SET content_html = ?3 WHERE article_id = ?1 AND lang = ?2`)
      .bind(articleId, fila.lang, limpio)
      .run();
    quitadas += 1;
  }
  return quitadas;
}

/** Quita el párrafo de aviso que abre el cuerpo, si lo hay. */
export function sinLineaDePropiedad(html: string): string {
  return html.replace(/^\s*<p class="aviso-casa">[\s\S]*?<\/p>\s*/i, "").trimStart();
}
