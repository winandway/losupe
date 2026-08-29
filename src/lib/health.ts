import type { SchemaStatus } from "./schema-guard";

export type HealthReport = {
  ok: boolean;
  time: string;
  /**
   * QUIÉN DISPARA LAS CORRIDAS, de las últimas 48 horas.
   *
   * Hay tres reloj posibles y no dan igual: el **cron de la plataforma** (el que debería mandar,
   * puntual y sin depender de nadie), el **reloj de GitHub** (que llega tarde o no llega: de 24
   * disparos diarios llegaban uno o dos) y el **latido de una visita** (que solo existe si alguien
   * entra al sitio a esa hora — con poco tráfico, sencillamente no hay nota).
   *
   * Sin este desglose no se puede saber por qué falta una nota, y se acaba adivinando. Medido el
   * 29 ago 2026 después de un día con 2 notas de 4.
   */
  relojes: {
    cron: number;
    manual: number;
    ultimas: { t: string; trigger: string; status: string }[];
  } | null;
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
      relojes: null,
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
    const [tables, articles, authors, runs, relojes] = await Promise.all([
      db
        .prepare(`SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'`)
        .first<{ n: number }>(),
      db
        .prepare(`SELECT COUNT(*) AS n FROM articles WHERE status = 'published'`)
        .first<{ n: number }>(),
      db.prepare(`SELECT COUNT(*) AS n FROM authors`).first<{ n: number }>(),
      db.prepare(`SELECT COUNT(*) AS n FROM runs`).first<{ n: number }>(),
      db
        .prepare(
          `SELECT started_at, trigger, status FROM runs
            WHERE started_at > datetime('now', '-2 days') ORDER BY started_at DESC LIMIT 40`,
        )
        .all<{ started_at: string; trigger: string; status: string }>()
        .catch(() => ({ results: [] })),
    ]);
    const filas = relojes.results ?? [];
    return {
      ok: true,
      time,
      relojes: {
        cron: filas.filter((r) => r.trigger === "cron").length,
        manual: filas.filter((r) => r.trigger !== "cron").length,
        ultimas: filas
          .slice(0, 12)
          .map((r) => ({ t: r.started_at, trigger: r.trigger, status: r.status })),
      },
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
      relojes: null,
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
