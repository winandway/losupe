/**
 * Garantiza que la base tenga el esquema aunque la plataforma no haya ejecutado schema.sql,
 * y siembra contenido editorial empaquetado en el worker (una sola vez por semilla).
 * Todo es idempotente y se comprueba una vez por instancia del worker (con reverificación).
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

export type SeedStatus = {
  id: string;
  seeded: boolean;
  applied: boolean;
  statements: number;
  error?: string;
};

export type ContentSeed = {
  /** Identificador legible (p. ej. "legacy-mundoscrypto" o "2026-08-23-mercatren"). */
  id: string;
  /** Clave en `settings` que marca la semilla como aplicada. */
  flag: string;
  statements: readonly string[];
};

export type SchemaStatus = {
  binding: boolean;
  hadTables: boolean;
  applied: boolean;
  /** true cuando las tablas existían pero el esquema cambió y se volvió a aplicar. */
  upgraded?: boolean;
  error?: string;
  seeds?: SeedStatus[];
};

export const SCHEMA_HASH_KEY = "schema_hash";

/** Huella corta de un texto (FNV-1a 32 bits). Cambia cuando cambia el contenido. */
export function hashSchema(sql: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < sql.length; i++) {
    h ^= sql.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

async function getSetting(db: D1Database, key: string): Promise<string | null> {
  try {
    const row = await db
      .prepare(`SELECT value FROM settings WHERE key = ?1`)
      .bind(key)
      .first<{ value: string }>();
    return row?.value ?? null;
  } catch {
    return null;
  }
}

async function setSetting(db: D1Database, key: string, value: string): Promise<void> {
  await db
    .prepare(
      `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))`,
    )
    .bind(key, value)
    .run();
}

export async function getStoredSchemaHash(db: D1Database): Promise<string | null> {
  return getSetting(db, SCHEMA_HASH_KEY);
}

export async function storeSchemaHash(db: D1Database, hash: string): Promise<void> {
  await setSetting(db, SCHEMA_HASH_KEY, hash);
}

export async function isSeedApplied(db: D1Database, flag: string): Promise<boolean> {
  return (await getSetting(db, flag)) === "1";
}

/** Aplica una semilla en lotes y deja la marca para no repetirla en esa base. */
export async function applySeed(
  db: D1Database,
  seed: ContentSeed,
  chunkSize = 20,
): Promise<number> {
  for (let i = 0; i < seed.statements.length; i += chunkSize) {
    const chunk = seed.statements.slice(i, i + chunkSize);
    await db.batch(chunk.map((s) => db.prepare(s)));
  }
  await setSetting(db, seed.flag, "1");
  return seed.statements.length;
}

export async function ensureSeed(db: D1Database, seed: ContentSeed): Promise<SeedStatus> {
  const base = { id: seed.id, statements: seed.statements.length };
  if (seed.statements.length === 0) return { ...base, seeded: true, applied: false };
  try {
    if (await isSeedApplied(db, seed.flag)) return { ...base, seeded: true, applied: false };
    await applySeed(db, seed);
    return { ...base, seeded: true, applied: true };
  } catch (error) {
    return {
      ...base,
      seeded: false,
      applied: false,
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

/**
 * Añadir una columna a una tabla que ya existe no se puede hacer con `IF NOT EXISTS` en SQLite: si
 * la columna ya está, `ALTER TABLE ... ADD COLUMN` falla y tumbaría todo el lote. Por eso los ALTER
 * se ejecutan uno a uno y se tolera SOLO el error de «columna duplicada»; cualquier otro fallo se
 * propaga (nada de errores en silencio).
 */
async function applyAlters(db: D1Database, alters: readonly string[]): Promise<void> {
  for (const sql of alters) {
    try {
      await db.prepare(sql).run();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/duplicate column name/i.test(message)) continue;
      throw error;
    }
  }
}

export async function applySchema(db: D1Database, schemaSql: string): Promise<number> {
  const all = splitSql(schemaSql);
  const alters = all.filter((s) => /^ALTER\s+TABLE/i.test(s));
  const rest = all.filter((s) => !/^ALTER\s+TABLE/i.test(s));
  // Primero las columnas nuevas: lo que venga después puede necesitarlas.
  await applyAlters(db, alters);
  await db.batch(rest.map((s) => db.prepare(s)));
  return all.length;
}

export async function ensureSchema(
  db: D1Database | undefined,
  schemaSql: string,
): Promise<SchemaStatus> {
  if (!db) return { binding: false, hadTables: false, applied: false, error: "env.DB no existe" };
  try {
    const hash = hashSchema(schemaSql);
    if (await hasCoreTables(db)) {
      // Tablas presentes: si el esquema cambió desde la última vez, se vuelve a aplicar (es idempotente).
      const stored = await getStoredSchemaHash(db);
      // eslint-disable-next-line security/detect-possible-timing-attacks -- la huella del esquema no es un secreto
      if (stored === hash) return { binding: true, hadTables: true, applied: false };
      await applySchema(db, schemaSql);
      await storeSchemaHash(db, hash);
      return { binding: true, hadTables: true, applied: true, upgraded: true };
    }
    await applySchema(db, schemaSql);
    await storeSchemaHash(db, hash);
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
 * Las semillas se confirman una vez por instancia (la marca en `settings` evita repetirlas).
 */
export function createSchemaGuard(
  schemaSql: string,
  opts: { ttlMs?: number; now?: () => number; seeds?: readonly ContentSeed[] } = {},
) {
  const ttlMs = opts.ttlMs ?? 5 * 60 * 1000;
  const now = opts.now ?? (() => Date.now());
  const seeds = opts.seeds ?? [];
  let pending: Promise<SchemaStatus> | null = null;
  let last: SchemaStatus | null = null;
  let lastAt = 0;
  const confirmed = new Set<string>();
  return {
    ensure(db: D1Database | undefined, { force = false } = {}): Promise<SchemaStatus> {
      const healthy = last?.binding && (last.hadTables || last.applied);
      if (!force && healthy && now() - lastAt < ttlMs) return Promise.resolve(last as SchemaStatus);
      if (!pending) {
        pending = ensureSchema(db, schemaSql)
          .then(async (status) => {
            if (db && status.binding && !status.error && seeds.length > 0) {
              const results: SeedStatus[] = [];
              for (const seed of seeds) {
                if (confirmed.has(seed.id)) {
                  results.push({
                    id: seed.id,
                    seeded: true,
                    applied: false,
                    statements: seed.statements.length,
                  });
                  continue;
                }
                const result = await ensureSeed(db, seed);
                if (result.seeded) confirmed.add(seed.id);
                results.push(result);
              }
              status.seeds = results;
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
