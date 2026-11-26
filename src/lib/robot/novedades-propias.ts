import { BOT_USER_AGENT, fetchPage } from "./research";

/**
 * NUESTRA NOTA DEL DÍA, CUANDO HAY MATERIAL (Richard, 26 nov 2026).
 *
 * El segmento de delivery saca tres notas al día. Dos son las noticias más relevantes del sector; la
 * tercera puede ser nuestra, pero solo cuando hay algo nuevo de verdad. ¿Cómo se sabe sin que nadie
 * lo cargue a mano? Por el mapa del sitio de Divoox: una página de Docs que antes no existía es una
 * función nueva. El `lastmod` no sirve (se regenera en cada compilación); la dirección nueva sí.
 *
 * - La primera vez se SIEMBRA la lista entera y no se propone nada (si no, saldrían 614 notas).
 * - Después, cada dirección nueva entra como candidata de la sección de delivery, con su título y su
 *   resumen leídos de la propia página. Es periodismo del sector como cualquier otro: sin aviso.
 * - El freno vive en `pickCandidate` (`propiaPermitida`): como mucho UNA nuestra al día y nunca dos
 *   días seguidos.
 * - Presupuesto de escrituras: una fila por dirección nueva, y como mucho `MAX_NUEVAS_POR_CORRIDA`
 *   candidatas por corrida. Un día normal escribe cero filas.
 */
export const SITEMAP_PROPIO = "https://divoox.com/sitemap.xml";
export const FUENTE_PROPIA = "propio-divoox";
export const MAX_NUEVAS_POR_CORRIDA = 3;

/** Solo las guías en español de Docs: cada función tiene su par en inglés y contaría dos veces. */
export function esGuiaDeDocs(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "divoox.com" && /^\/es\/docs\/[^/]+\/[^/]+\/?$/.test(u.pathname);
  } catch {
    return false;
  }
}

export function direccionesDelMapa(xml: string): string[] {
  const out = new Set<string>();
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    const url = m[1]!.replace(/&amp;/g, "&");
    if (esGuiaDeDocs(url)) out.add(url.replace(/\/$/, ""));
  }
  return [...out];
}

export type NovedadesPropias = {
  sembradas: number;
  nuevas: number;
  propuestas: number;
  error?: string;
};

export async function leerNovedadesPropias(
  db: D1Database,
  opts: { fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<NovedadesPropias> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = (opts.now ?? new Date()).toISOString();
  const res = await fetchImpl(SITEMAP_PROPIO, {
    headers: { "User-Agent": BOT_USER_AGENT, Accept: "application/xml, text/xml, */*" },
    signal: AbortSignal.timeout(7_000),
  });
  if (!res.ok) return { sembradas: 0, nuevas: 0, propuestas: 0, error: `mapa ${res.status}` };
  const urls = direccionesDelMapa(await res.text());
  // Un mapa vacío o roto no es «todas las guías desaparecieron»: no se concluye nada.
  if (urls.length === 0) return { sembradas: 0, nuevas: 0, propuestas: 0, error: "mapa vacío" };

  const { results } = await db.prepare(`SELECT url FROM sitemap_propio`).all<{ url: string }>();
  const vistas = new Set((results ?? []).map((r) => r.url));
  const nuevas = urls.filter((u) => !vistas.has(u));
  if (nuevas.length === 0) return { sembradas: 0, nuevas: 0, propuestas: 0 };

  const guardar = (lista: string[]) =>
    db.batch(
      lista.map((u) =>
        db
          .prepare(`INSERT OR IGNORE INTO sitemap_propio (url, visto_en) VALUES (?1, ?2)`)
          .bind(u, now),
      ),
    );

  // Primera vez: se siembra todo y no se propone nada.
  if (vistas.size === 0) {
    await guardar(urls);
    return { sembradas: urls.length, nuevas: 0, propuestas: 0 };
  }

  // Un mapa que de golpe trae decenas de direcciones nuevas es una reorganización, no 40 funciones:
  // se apuntan y no se propone ninguna.
  const aProponer = nuevas.length > 20 ? [] : nuevas.slice(0, MAX_NUEVAS_POR_CORRIDA);
  let propuestas = 0;
  for (const url of aProponer) {
    const pagina = await fetchPage(url, { fetchImpl, maxChars: 4_000 }).catch(() => null);
    if (!pagina || !pagina.title) continue;
    const resumen = pagina.description || pagina.text.slice(0, 280);
    await db
      .prepare(
        `INSERT OR IGNORE INTO candidates (id, source_id, section_id, url, title, summary, lang, published_at, score) VALUES (?1, ?2, 'delivery', ?3, ?4, ?5, 'es', ?6, 100)`,
      )
      .bind(
        crypto.randomUUID(),
        FUENTE_PROPIA,
        url,
        pagina.title.replace(/\s*[|·—-]\s*Divoox.*$/i, ""),
        resumen,
        now,
      )
      .run();
    propuestas += 1;
  }
  // Se apuntan TODAS las nuevas, también las que no se propusieron: si no, volverían mañana.
  await guardar(nuevas);
  return { sembradas: 0, nuevas: nuevas.length, propuestas };
}

/**
 * ¿Puede salir hoy una nota nuestra? Como mucho una al día y nunca dos días seguidos: se mira si
 * alguna candidata propia quedó usada en una nota publicada desde el comienzo de AYER.
 */
export async function propiaPermitida(db: D1Database, desdeAyer: string): Promise<boolean> {
  const fila = await db
    .prepare(
      `SELECT 1 AS x FROM candidates c JOIN articles a ON a.id = c.article_id
       WHERE c.source_id = ?1 AND a.published_at IS NOT NULL AND a.published_at >= ?2 LIMIT 1`,
    )
    .bind(FUENTE_PROPIA, desdeAyer)
    .first<{ x: number }>();
  return !fila;
}
