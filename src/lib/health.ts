import type { SchemaStatus } from "./schema-guard";

export type HealthReport = {
  ok: boolean;
  time: string;
  db: {
    binding: boolean;
    schema: SchemaStatus | null;
    tables: number | null;
    articles: number | null;
    authors: number | null;
    runs: number | null;
    error?: string;
  };
};

/** Estado de la base para diagnóstico. Nunca devuelve datos de contenido ni secretos. */
export async function buildHealthReport(
  db: D1Database | undefined,
  schema: SchemaStatus | null,
): Promise<HealthReport> {
  const time = new Date().toISOString();
  if (!db) {
    return {
      ok: false,
      time,
      db: {
        binding: false,
        schema,
        tables: null,
        articles: null,
        authors: null,
        runs: null,
        error: "env.DB no existe",
      },
    };
  }
  try {
    const [tables, articles, authors, runs] = await Promise.all([
      db
        .prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'`)
        .first<{ n: number }>(),
      db
        .prepare(`SELECT COUNT(*) AS n FROM articles WHERE status = 'published'`)
        .first<{ n: number }>(),
      db.prepare(`SELECT COUNT(*) AS n FROM authors`).first<{ n: number }>(),
      db.prepare(`SELECT COUNT(*) AS n FROM runs`).first<{ n: number }>(),
    ]);
    return {
      ok: true,
      time,
      db: {
        binding: true,
        schema,
        tables: tables?.n ?? 0,
        articles: articles?.n ?? 0,
        authors: authors?.n ?? 0,
        runs: runs?.n ?? 0,
      },
    };
  } catch (error) {
    return {
      ok: false,
      time,
      db: {
        binding: true,
        schema,
        tables: null,
        articles: null,
        authors: null,
        runs: null,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
}
