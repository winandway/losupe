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
/** Cada cuánto, como mucho, se lanza una corrida por tráfico. */
export const DEFAULT_INTERVAL_MINUTES = 120;

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
  intervalMinutes = DEFAULT_INTERVAL_MINUTES,
): Promise<TickDecision> {
  if (!db) return { run: false, reason: "no_db" };
  try {
    const paused = await db
      .prepare(`SELECT value FROM settings WHERE key = 'robot_paused'`)
      .first<{ value: string }>();
    if (!paused || paused.value !== "0") return { run: false, reason: "paused" };

    const iso = now.toISOString();
    const limit = new Date(now.getTime() - intervalMinutes * 60_000).toISOString();

    // Primera vez: si la marca no existe, la creamos ya vencida para que la corrida entre.
    await db
      .prepare(
        `INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))`,
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
        `UPDATE settings SET value = ?2, updated_at = datetime('now') WHERE key = ?1 AND value < ?3`,
      )
      .bind(TICK_KEY, iso, limit)
      .run();
    if ((claimed.meta?.changes ?? 0) === 0) return { run: false, reason: "too_soon" };
    return { run: true, since: before?.value || null };
  } catch {
    return { run: false, reason: "error" };
  }
}
