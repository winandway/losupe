/**
 * Garantiza que la base tenga el esquema aunque la plataforma no haya ejecutado schema.sql.
 * Idempotente (el esquema usa IF NOT EXISTS / INSERT OR IGNORE) y se comprueba una vez por
 * instancia del worker.
 */

/** Parte un archivo SQL en sentencias (una termina en ";" + salto de línea). Ignora comentarios. */
export function splitSql(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((chunk) =>
      chunk
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim(),
    )
    .filter((stmt) => stmt.length > 0);
}

export type SeedStatus = { seeded: boolean; applied: boolean; statements: number; error?: string };

export type SchemaStatus = {
  binding: boolean;
  hadTables: boolean;
  applied: boolean;
  error?: string;
  seed?: SeedStatus;
};

export const LEGACY_SEED_FLAG = "legacy_seeded";

export async function isLegacySeeded(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare(`SELECT value FROM settings WHERE key = ?1`)
    .bind(LEGACY_SEED_FLAG)
    .first<{ value: string }>();
  return row?.value === "1";
}

/** Aplica la semilla en lotes y deja la marca para no repetirla nunca más en esa base. */
export async function applyLegacySeed(
  db: D1Database,
  statements: readonly string[],
  chunkSize = 20,
): Promise<number> {
  for (let i = 0; i < statements.length; i += chunkSize) {
    const chunk = statements.slice(i, i + chunkSize);
    await db.batch(chunk.map((s) => db.prepare(s)));
  }
  await db
    .prepare(
      `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, '1', datetime('now'))`,
    )
    .bind(LEGACY_SEED_FLAG)
    .run();
  return statements.length;
}

export async function ensureLegacySeed(
  db: D1Database,
  statements: readonly string[],
): Promise<SeedStatus> {
  if (statements.length === 0) return { seeded: true, applied: false, statements: 0 };
  try {
    if (await isLegacySeeded(db))
      return { seeded: true, applied: false, statements: statements.length };
    const n = await applyLegacySeed(db, statements);
    return { seeded: true, applied: true, statements: n };
  } catch (error) {
    return {
      seeded: false,
      applied: false,
      statements: statements.length,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function hasCoreTables(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('articles', 'article_i18n', 'authors', 'sections', 'settings')`,
    )
    .first<{ n: number }>();
  return (row?.n ?? 0) >= 5;
}

export async function applySchema(db: D1Database, schemaSql: string): Promise<number> {
  const statements = splitSql(schemaSql);
  await db.batch(statements.map((s) => db.prepare(s)));
  return statements.length;
}

export async function ensureSchema(
  db: D1Database | undefined,
  schemaSql: string,
): Promise<SchemaStatus> {
  if (!db) return { binding: false, hadTables: false, applied: false, error: "env.DB no existe" };
  try {
    if (await hasCoreTables(db)) return { binding: true, hadTables: true, applied: false };
    await applySchema(db, schemaSql);
    return { binding: true, hadTables: false, applied: true };
  } catch (error) {
    return {
      binding: true,
      hadTables: false,
      applied: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Memoriza la comprobación por instancia del worker: un éxito vale `ttlMs` (5 min por defecto),
 * después se vuelve a verificar con una consulta barata. `force` obliga a comprobar ya.
 */
export function createSchemaGuard(
  schemaSql: string,
  opts: { ttlMs?: number; now?: () => number; seed?: readonly string[] } = {},
) {
  const ttlMs = opts.ttlMs ?? 5 * 60 * 1000;
  const now = opts.now ?? (() => Date.now());
  const seed = opts.seed ?? [];
  let pending: Promise<SchemaStatus> | null = null;
  let last: SchemaStatus | null = null;
  let lastAt = 0;
  let seedConfirmed = false;
  return {
    ensure(db: D1Database | undefined, { force = false } = {}): Promise<SchemaStatus> {
      const healthy = last?.binding && (last.hadTables || last.applied);
      if (!force && healthy && now() - lastAt < ttlMs) return Promise.resolve(last as SchemaStatus);
      if (!pending) {
        pending = ensureSchema(db, schemaSql)
          .then(async (status) => {
            // Semilla heredada: una sola vez por base (marca en settings), nunca si el esquema falló.
            if (db && status.binding && !status.error && seed.length > 0 && !seedConfirmed) {
              status.seed = await ensureLegacySeed(db, seed);
              seedConfirmed = status.seed.seeded;
            } else if (seedConfirmed) {
              status.seed = { seeded: true, applied: false, statements: seed.length };
            }
            return status;
          })
          .then((status) => {
            last = status;
            lastAt = now();
            pending = null;
            return status;
          });
      }
      return pending;
    },
    status(): SchemaStatus | null {
      return last;
    },
  };
}
