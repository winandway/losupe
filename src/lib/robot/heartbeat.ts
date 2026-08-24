import { SQL_NOW } from "../sql-time";
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
 */

export const TICK_KEY = "robot_last_tick";
export const TICK_TOKEN_KEY = "robot_tick_token";
/** Cada cuánto, como mucho, se lanza una corrida por tráfico. Se puede cambiar en `settings`. */
export const DEFAULT_INTERVAL_MINUTES = 60;
/** Si la corrida anterior falló o se cortó, se reintenta mucho antes. */
export const RETRY_MINUTES = 15;

export type TickDecision =
  | { run: false; reason: "paused" | "too_soon" | "no_db" | "error" }
  | { run: true; since: string | null };

/**
 * Reclama el turno para correr. Devuelve `run: true` SOLO a quien gana la carrera.
 * No lanza excepciones: si algo falla, dice que no toca y sigue la vida.
 */
export async function claimTick(
  db: D1Database | undefined,
  now = new Date(),
  intervalMinutes?: number,
): Promise<TickDecision> {
  if (!db) return { run: false, reason: "no_db" };
  try {
    const paused = await db
      .prepare(`SELECT value FROM settings WHERE key = 'robot_paused'`)
      .first<{ value: string }>();
    if (!paused || paused.value !== "0") return { run: false, reason: "paused" };

    // Ritmo: el de `settings.robot_tick_minutes` (o el de por defecto). Si la última corrida quedó
    // en error, se reintenta mucho antes en vez de esperar el turno completo.
    let minutes = intervalMinutes;
    if (minutes === undefined) {
      const conf = await db
        .prepare(`SELECT value FROM settings WHERE key = 'robot_tick_minutes'`)
        .first<{ value: string }>();
      minutes = Number(conf?.value ?? "") || DEFAULT_INTERVAL_MINUTES;
      const last = await db
        .prepare(`SELECT status FROM runs ORDER BY started_at DESC LIMIT 1`)
        .first<{ status: string }>();
      if (last?.status === "error") minutes = Math.min(minutes, RETRY_MINUTES);
    }

    const iso = now.toISOString();
    const limit = new Date(now.getTime() - minutes * 60_000).toISOString();

    // Primera vez: si la marca no existe, la creamos ya vencida para que la corrida entre.
    await db
      .prepare(
        `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?1, ?2, ${SQL_NOW})`,
      )
      .bind(TICK_KEY, "")
      .run();

    const before = await db
      .prepare(`SELECT value FROM settings WHERE key = ?1`)
      .bind(TICK_KEY)
      .first<{ value: string }>();

    // Gana el turno quien logre mover la marca: el `WHERE value < ?` deja pasar a una sola petición.
    const claimed = await db
      .prepare(
        `UPDATE settings SET value = ?2, updated_at = ${SQL_NOW} WHERE key = ?1 AND value < ?3`,
      )
      .bind(TICK_KEY, iso, limit)
      .run();
    if ((claimed.meta?.changes ?? 0) === 0) return { run: false, reason: "too_soon" };
    return { run: true, since: before?.value || null };
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
