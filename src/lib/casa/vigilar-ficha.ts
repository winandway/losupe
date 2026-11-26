import { SQL_NOW } from "@/lib/sql-time";
import { PRODUCTOS, type Producto } from "./productos";

/**
 * ¿SIGUE SIENDO VERDAD LO QUE DICE NUESTRA FICHA? (25 nov 2026)
 *
 * Las fichas de los productos de la casa se escriben leyendo su página un día concreto, y luego la
 * página cambia. El caso que lo provocó: la ficha de Divoox dice que Venezuela está «próximamente»,
 * Richard avisó de que van a quitarlo porque ya abrieron, y sin esto seguiríamos escribiendo
 * «todavía no opera» cuando ya opera. Decir de menos es el mismo error que decir de más.
 *
 * Una vez al día, el robot pide la página que la ficha declara vigilar y busca la frase que la ficha
 * da por cierta. Si ya no está, la ficha queda marcada como vencida: sale en `/__health` y el
 * redactor deja de recibir sus datos hasta que una persona la relea.
 *
 * No falla nunca hacia el lado malo: si la página no responde, no se marca nada (una caída de red no
 * es un cambio de contenido).
 */
export const CLAVE_VENCIDA = (id: string) => `ficha_vencida_${id}`;

export type FichaVencida = { producto: string; motivo: string; desde: string };

/** Comprueba una ficha. Devuelve el motivo si su frase ya no está en la página. */
export async function comprobarFicha(
  p: Producto,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  if (!p.vigilar) return null;
  try {
    const res = await fetchImpl(p.vigilar.url, {
      headers: { "User-Agent": "losupe-bot/1.0 (+https://losupe.com)" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Sin etiquetas y sin acentos ni mayúsculas: la frase puede estar partida por el maquetado.
    const texto = html
      .replace(/<[^>]+>/g, " ")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ")
      .toLowerCase();
    const frase = p.vigilar.frase.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    return texto.includes(frase) ? null : p.vigilar.siDesaparece;
  } catch {
    // Sin red, sin conclusiones.
    return null;
  }
}

/** Pasa por todas las fichas vigiladas y deja el resultado en `settings`. */
export async function vigilarFichas(
  db: D1Database,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<FichaVencida[]> {
  const vencidas: FichaVencida[] = [];
  for (const p of PRODUCTOS.filter((x) => x.vigilar)) {
    const motivo = await comprobarFicha(p, opts.fetchImpl ?? fetch);
    const clave = CLAVE_VENCIDA(p.id);
    if (motivo) {
      vencidas.push({ producto: p.nombre, motivo, desde: new Date().toISOString() });
      await db
        .prepare(
          `INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ${SQL_NOW})
           ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ${SQL_NOW}`,
        )
        .bind(clave, motivo)
        .run()
        .catch(() => undefined);
    } else {
      await db
        .prepare(`DELETE FROM settings WHERE key = ?1`)
        .bind(clave)
        .run()
        .catch(() => undefined);
    }
  }
  return vencidas;
}

/** Las fichas marcadas como vencidas, para el canario y para el redactor. */
export async function fichasVencidas(db: D1Database): Promise<Record<string, string>> {
  try {
    const { results } = await db
      .prepare(`SELECT key, value FROM settings WHERE key LIKE 'ficha_vencida_%'`)
      .all<{ key: string; value: string }>();
    return Object.fromEntries(
      (results ?? []).map((r) => [r.key.replace("ficha_vencida_", ""), r.value]),
    );
  } catch {
    return {};
  }
}
