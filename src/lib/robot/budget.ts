import { SQL_NOW } from "../sql-time";
/**
 * Tope diario de gasto en IA e imágenes. El límite vive en `settings.daily_budget_usd`; cada
 * llamada pagada se anota en `spend_log`. Si el día ya gastó el tope, el robot NO corre.
 */

export type SpendEntry = {
  provider: "gemini" | "fal" | "pexels" | "brave" | "workers-ai";
  model?: string;
  units: number;
  costUsd: number;
  runId?: string;
};

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function getSetting(db: D1Database, key: string): Promise<string | null> {
  const row = await db
    .prepare(`SELECT value FROM settings WHERE key = ?1`)
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

export async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, ${SQL_NOW})`)
    .bind(key, value)
    .run();
}

export async function getDailyBudgetUsd(db: D1Database): Promise<number> {
  const raw = await getSetting(db, "daily_budget_usd");
  const n = Number(raw ?? "1");
  return Number.isFinite(n) && n >= 0 ? n : 1;
}

export async function getSpendToday(db: D1Database, now = new Date()): Promise<number> {
  const row = await db
    .prepare(`SELECT COALESCE(SUM(cost_usd), 0) AS total FROM spend_log WHERE day = ?1`)
    .bind(todayKey(now))
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

export async function recordSpend(db: D1Database, entry: SpendEntry, now = new Date()) {
  await db
    .prepare(
      `INSERT INTO spend_log (day, provider, model, units, cost_usd, run_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(
      todayKey(now),
      entry.provider,
      entry.model ?? null,
      entry.units,
      entry.costUsd,
      entry.runId ?? null,
    )
    .run();
}

export class BudgetExceededError extends Error {
  constructor(
    public spent: number,
    public limit: number,
  ) {
    super(`Tope diario alcanzado: gastado $${spent.toFixed(3)} de $${limit.toFixed(2)}`);
    this.name = "BudgetExceededError";
  }
}

/** Lanza si el gasto del día ya llegó al tope (o si `extraUsd` lo superaría). */
export async function assertBudget(db: D1Database, extraUsd = 0, now = new Date()) {
  const [limit, spent] = await Promise.all([getDailyBudgetUsd(db), getSpendToday(db, now)]);
  if (spent + extraUsd > limit) throw new BudgetExceededError(spent, limit);
  return { limit, spent };
}
