/**
 * NINGUNA NOTA LLEVA AVISO DE PROPIEDAD (candados 65 y 66, 26 nov 2026).
 *
 * Hubo dos inventos que anunciaban de quién era el medio: la sección «Desde Windoce» con su aviso
 * «Contenido de la casa» (candado 57, retirado) y una línea de transparencia en las notas de
 * periodismo que nombraban un producto del grupo (retirada). Richard los tumbó los dos:
 * _«nadie nos está preguntando nada. ¿Por qué tenemos que poner algo que nadie nos está
 * preguntando?»_. Un medio no se delata: cumple las reglas de Google en cada palabra y punto.
 *
 * Lo único que queda aquí es la limpieza: si una nota arrastra un párrafo de esos, se le quita al
 * publicarla, sin tocar el resto del texto. Solo escribe si lo encuentra.
 */
export async function quitarLineaDePropiedad(db: D1Database, articleId: string): Promise<number> {
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
