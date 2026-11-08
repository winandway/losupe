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
    /**
     * EL MOTIVO de las últimas corridas que fallaron. Sin esto solo se veía «error» y había que
     * adivinar: el 1 de octubre de 2026 el diario pasó un día entero sin publicar y el porqué estaba
     * escrito en la base, pero no se podía leer desde fuera.
     */
    fallos: { t: string; error: string }[];
  } | null;
  /**
   * GUIONES PARA CREADORES: cuántas notas publicadas en las últimas 24 horas siguen sin guion, y el
   * último fallo con su motivo real (503 de Google, ubicación, guion rechazado). Pendiente del
   * 19 oct 2026: «hay que medir cuántos quedan sin guion al final del día».
   */
  guiones?: { sinGuion24h: number; ultimoError: { t: string; error: string } | null } | null;
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
          `SELECT started_at, trigger, status, error FROM runs
            WHERE started_at > datetime('now', '-2 days') ORDER BY started_at DESC LIMIT 40`,
        )
        .all<{ started_at: string; trigger: string; status: string; error: string | null }>()
        .catch(() => ({ results: [] })),
    ]);
    const filas = relojes.results ?? [];
    const guiones = await leerEstadoGuiones(db);
    return {
      ok: true,
      time,
      relojes: {
        cron: filas.filter((r) => r.trigger === "cron").length,
        manual: filas.filter((r) => r.trigger !== "cron").length,
        ultimas: filas
          .slice(0, 12)
          .map((r) => ({ t: r.started_at, trigger: r.trigger, status: r.status })),
        fallos: filas
          .filter((r) => r.status === "error" && r.error)
          .slice(0, 5)
          .map((r) => ({ t: r.started_at, error: String(r.error).slice(0, 300) })),
      },
      guiones,
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

/** Notas de las últimas 24 h sin guion y el último fallo guardado. Solo lectura; nunca lanza. */
async function leerEstadoGuiones(db: D1Database): Promise<HealthReport["guiones"]> {
  try {
    const [pendientes, ultimo] = await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM articles a
             JOIN article_i18n es ON es.article_id = a.id AND es.lang = 'es'
            WHERE a.status = 'published' AND a.published_at >= ?1
              AND (es.guion_1m IS NULL OR es.guion_1m = '')`,
        )
        .bind(new Date(Date.now() - 86_400_000).toISOString())
        .first<{ n: number }>(),
      db
        .prepare(`SELECT value FROM settings WHERE key = 'guion_ultimo_error'`)
        .first<{ value: string }>(),
    ]);
    let ultimoError: { t: string; error: string } | null = null;
    try {
      ultimoError = ultimo?.value
        ? (JSON.parse(ultimo.value) as { t: string; error: string })
        : null;
    } catch {
      ultimoError = { t: "", error: String(ultimo?.value).slice(0, 300) };
    }
    return { sinGuion24h: pendientes?.n ?? 0, ultimoError };
  } catch (error) {
    console.error("[health] no se pudo leer el estado de los guiones", error);
    return null;
  }
}
