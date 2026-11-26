import { SQL_NOW } from "@/lib/sql-time";
import { PRODUCTOS, type Producto } from "./productos";

/**
 * ¿SIGUE SIENDO VERDAD LO QUE DICE NUESTRA FICHA? (25 nov 2026)
 *
 * Las fichas de los productos de la casa se escriben leyendo su página un día concreto, y luego la
 * realidad se mueve. Una ficha vieja hace que escribamos de nuestros propios productos cosas que ya
 * no son ciertas, y decir de MENOS es el mismo error que decir de más.
 *
 * Pasó de las dos formas en el mismo día:
 *
 *  1. La página cambia y nadie se entera. Divoox va a quitar el «próximamente» de Venezuela en
 *     cuanto abra; sin esto seguiríamos escribiendo «todavía no opera» cuando ya opera.
 *  2. La realidad cambia ANTES que la página. Richard avisó de que en Venezuela ya se está
 *     repartiendo comida cuando la página todavía decía «Coming soon». Vigilar una frase no detecta
 *     eso: lo único que lo detecta es que una ficha no se relea nunca.
 *
 * Por eso hay dos caducidades, y cualquiera de las dos marca la ficha:
 *
 *  - LA FRASE: la ficha declara una frase que tiene que seguir en su página. Si desaparece, vencida.
 *  - EL TIEMPO: pasados `DIAS_DE_VIDA_DE_UNA_FICHA` días desde `verificado`, vencida igual. Vale
 *    para TODOS los productos, también los que no vigilan ninguna frase.
 *
 * Una ficha vencida sale en `/__health`, el redactor deja de nombrar ese producto en el segmento del
 * sector, y la rotación de «Desde Windoce» se salta ese producto hasta que una persona la relea.
 *
 * No falla nunca hacia el lado malo: si la página no responde, no se concluye nada (una caída de red
 * no es un cambio de contenido).
 *
 * Y solo escribe en la base cuando el estado CAMBIA: con diez productos y once corridas al día, un
 * borrado a ciegas por producto y por corrida serían más de cien escrituras diarias para no decir
 * nada (regla de presupuesto de la nube).
 */
export const CLAVE_VENCIDA = (id: string) => `ficha_vencida_${id}`;

/** Días que vale una ficha desde que se leyó su página. Un mes: lo que tarda un producto en cambiar. */
export const DIAS_DE_VIDA_DE_UNA_FICHA = 30;

export type FichaVencida = { producto: string; motivo: string; desde: string };

/** ¿Se leyó hace demasiado? Devuelve el motivo si la ficha ya cumplió su tiempo. */
export function fichaCaduca(p: Producto, now: Date = new Date()): string | null {
  const leida = Date.parse(`${p.verificado}T00:00:00Z`);
  if (!Number.isFinite(leida))
    return `La ficha de ${p.nombre} no dice cuándo se leyó su página («${p.verificado}»). Hay que releerla y poner la fecha.`;
  const dias = Math.floor((now.getTime() - leida) / 86_400_000);
  if (dias < DIAS_DE_VIDA_DE_UNA_FICHA) return null;
  return `La ficha de ${p.nombre} se leyó el ${p.verificado}, hace ${dias} días. Hay que volver a leer ${p.url} y reescribir los datos, el «cuidado» y la fecha de «verificado».`;
}

/** Días de aviso antes de que una ficha caduque, para releerla sin prisa. */
export const DIAS_DE_AVISO = 7;

/**
 * Las fichas que están a punto de caducar, con los días que les quedan. El canario las enseña una
 * semana antes para que releerlas sea una tarea de la fila, no una urgencia el día que se apaga.
 */
export function fichasPorCaducar(now: Date = new Date()): Record<string, number> {
  const aviso: Record<string, number> = {};
  for (const p of PRODUCTOS) {
    if (fichaCaduca(p, now)) continue;
    const leida = Date.parse(`${p.verificado}T00:00:00Z`);
    const quedan = DIAS_DE_VIDA_DE_UNA_FICHA - Math.floor((now.getTime() - leida) / 86_400_000);
    if (quedan <= DIAS_DE_AVISO) aviso[p.id] = quedan;
  }
  return aviso;
}

/** Comprueba la frase vigilada. Devuelve el motivo si ya no está en la página. */
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

/** Pasa por todas las fichas y deja en `settings` solo lo que cambió. */
export async function vigilarFichas(
  db: D1Database,
  opts: { fetchImpl?: typeof fetch; now?: Date; productos?: readonly Producto[] } = {},
): Promise<FichaVencida[]> {
  const now = opts.now ?? new Date();
  const previas = await fichasVencidas(db);
  const vencidas: FichaVencida[] = [];
  for (const p of opts.productos ?? PRODUCTOS) {
    const motivo = (await comprobarFicha(p, opts.fetchImpl ?? fetch)) ?? fichaCaduca(p, now);
    const antes = previas[p.id];
    const clave = CLAVE_VENCIDA(p.id);
    if (motivo) {
      vencidas.push({ producto: p.nombre, motivo, desde: now.toISOString() });
      if (motivo !== antes)
        await db
          .prepare(
            `INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ${SQL_NOW})
             ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = ${SQL_NOW}`,
          )
          .bind(clave, motivo)
          .run()
          .catch(() => undefined);
    } else if (antes !== undefined) {
      await db
        .prepare(`DELETE FROM settings WHERE key = ?1`)
        .bind(clave)
        .run()
        .catch(() => undefined);
    }
  }
  return vencidas;
}

/** Las fichas marcadas como vencidas, para el canario, el redactor y la rotación de la casa. */
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
