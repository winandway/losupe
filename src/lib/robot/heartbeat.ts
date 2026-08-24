/**
 * Piloto automático que NO depende del programador de la plataforma.
 *
 * El cron de YaDominios (`/__scheduled`) debería disparar solo, pero el 24 ago 2026 se comprobó que
 * no llegaba ninguna invocación: el robot solo corría a mano. Esto lo arregla desde dentro: en cada
 * visita normal al sitio se mira si toca corrida y, si toca, se lanza en segundo plano sin hacer
 * esperar al lector. Con que entre alguien (o pase Googlebot) el diario sigue publicando.
 *
 * Para que dos visitas simultáneas no lancen dos corridas, el turno se «gana» con un UPDATE
 * condicional en la base (SQLite lo resuelve de forma atómica): solo la petición que consigue
 * cambiar la marca ejecuta el robot.
 *
 * SEGUNDA LECCIÓN (mismo día): con «cada 60 minutos» no basta. Así, las tres notas del día salieron
 * a las 11:35 PM, 12:49 AM y 1:08 AM hora del Este — de madrugada, sin lectores. Ahora el turno solo
 * se puede reclamar DENTRO de una de las tres franjas de publicación (`franjas.ts`), una nota por
 * franja, y la marca guardada es el turno concreto («2026-08-24:mediodia»), no una hora suelta.
 */

import { SQL_NOW } from "../sql-time";
import { franjaActiva, marcaDeFranja, type Franja } from "./franjas";

export const TICK_KEY = "robot_last_tick";
export const TICK_TOKEN_KEY = "robot_tick_token";

export type TickDecision =
  | { run: false; reason: "paused" | "fuera_de_horario" | "turno_hecho" | "no_db" | "error" }
  | { run: true; franja: Franja["key"]; marca: string };

/**
 * Reclama el turno para correr. Devuelve `run: true` SOLO a quien gana la carrera, y solo si el
 * reloj está dentro de una franja de publicación. Fuera de horario no corre aunque falten notas del
 * día: acumular turnos atrasados es justo lo que llenaba la madrugada de noticias.
 *
 * No lanza excepciones: si algo falla, dice que no toca y sigue la vida.
 */
export async function claimTick(
  db: D1Database | undefined,
  now = new Date(),
): Promise<TickDecision> {
  if (!db) return { run: false, reason: "no_db" };
  try {
    const paused = await db
      .prepare(`SELECT value FROM settings WHERE key = 'robot_paused'`)
      .first<{ value: string }>();
    if (!paused || paused.value !== "0") return { run: false, reason: "paused" };

    const franja = franjaActiva(now);
    if (!franja) return { run: false, reason: "fuera_de_horario" };
    const marca = marcaDeFranja(now, franja);

    // Primera vez: si la marca no existe, se crea vacía para que el turno pueda reclamarse.
    await db
      .prepare(
        `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?1, '', ${SQL_NOW})`,
      )
      .bind(TICK_KEY)
      .run();

    // Gana el turno quien logre escribir la marca de ESTA franja. El `value <> ?2` deja pasar a una
    // sola petición: las demás encuentran la marca ya puesta y se van.
    const claimed = await db
      .prepare(
        `UPDATE settings SET value = ?2, updated_at = ${SQL_NOW} WHERE key = ?1 AND value <> ?2`,
      )
      .bind(TICK_KEY, marca)
      .run();
    if ((claimed.meta?.changes ?? 0) === 0) return { run: false, reason: "turno_hecho" };
    return { run: true, franja: franja.key, marca };
  } catch {
    return { run: false, reason: "error" };
  }
}

/**
 * Secreto interno para que el sitio pueda llamarse a sí mismo a `/__scheduled`. Se genera solo la
 * primera vez y vive en la base: así el piloto automático no depende de que nadie configure nada.
 */
export async function getTickToken(db: D1Database): Promise<string | null> {
  try {
    const row = await db
      .prepare(`SELECT value FROM settings WHERE key = ?1`)
      .bind(TICK_TOKEN_KEY)
      .first<{ value: string }>();
    if (row?.value) return row.value;
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().slice(0, 12);
    await db
      .prepare(
        `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, ${SQL_NOW})`,
      )
      .bind(TICK_TOKEN_KEY, token)
      .run();
    return token;
  } catch {
    return null;
  }
}

/**
 * Corridas que se quedaron a medias (el worker se cortó antes de terminar). Se marcan como error
 * para que el estado no mienta y el panel muestre lo que de verdad pasó.
 */
export async function closeStaleRuns(db: D1Database, maxMinutes = 15): Promise<number> {
  try {
    const limit = new Date(Date.now() - maxMinutes * 60_000).toISOString();
    const res = await db
      .prepare(
        `UPDATE runs SET status = 'error', finished_at = ${SQL_NOW},
           error = 'la corrida se cortó antes de terminar (se reintentará)'
         WHERE status = 'running' AND started_at < ?1`,
      )
      .bind(limit)
      .run();
    return res.meta?.changes ?? 0;
  } catch {
    return 0;
  }
}
