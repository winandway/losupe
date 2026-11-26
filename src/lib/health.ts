import { fichasPorCaducar, fichasVencidas } from "./casa/vigilar-ficha";
import { FRANJAS, NOMBRE_FRANJA, rangoDelDiaLocal } from "./robot/franjas";
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
  /**
   * Fichas de productos de la casa cuya página cambió y nadie ha releído. Mientras estén aquí, el
   * redactor no usa sus datos: decir de menos de nuestro propio producto es el mismo error que
   * decir de más (25 nov 2026).
   */
  fichasVencidas?: Record<string, string>;
  /** Fichas que caducan dentro de una semana, con los días que les quedan, para releerlas a tiempo. */
  fichasPorCaducar?: Record<string, number>;
  /**
   * LOS TURNOS DE HOY, uno por uno (25 nov 2026). El turno no se elige por el reloj, se elige por
   * cuántas notas van; un turno que quema sus ocho intentos se salta y antes no dejaba rastro de
   * cuál era. Aquí se ve de un vistazo: cuántos intentos lleva cada turno, si salió su nota y, si
   * no salió, el último motivo. Medir antes de creer.
   */
  turnos?: {
    key: string;
    nombre: string;
    seccion: string | null;
    intentos: number;
    notas: number;
    porQue: string | null;
  }[];
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
    const fichas = await fichasVencidas(db).catch(() => ({}));
    const porCaducar = fichasPorCaducar(new Date(time));
    const turnos = await turnosDeHoy(db, new Date(time)).catch(() => []);
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
      ...(Object.keys(fichas).length > 0 ? { fichasVencidas: fichas } : {}),
      ...(Object.keys(porCaducar).length > 0 ? { fichasPorCaducar: porCaducar } : {}),
      ...(turnos.length > 0 ? { turnos } : {}),
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

/**
 * Resumen de los turnos de hoy, leído de `runs.franja`. Una sola consulta agrupada: nada de una
 * consulta por turno (presupuesto de lecturas de la nube).
 */
async function turnosDeHoy(
  db: D1Database,
  now: Date,
): Promise<NonNullable<HealthReport["turnos"]>> {
  const { desde, hasta } = rangoDelDiaLocal(now);
  const { results } = await db
    .prepare(
      `SELECT franja,
              COUNT(*) AS intentos,
              SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS hechos,
              (SELECT r2.error
                 FROM runs r2
                WHERE r2.franja = runs.franja
                  AND r2.started_at >= ?1 AND r2.started_at < ?2
                  AND r2.error IS NOT NULL
                ORDER BY r2.started_at DESC, r2.rowid DESC
                LIMIT 1) AS porQue
         FROM runs
        WHERE started_at >= ?1 AND started_at < ?2 AND franja IS NOT NULL
        GROUP BY franja`,
    )
    .bind(desde, hasta)
    .all<{ franja: string; intentos: number; hechos: number; porQue: string | null }>();
  const porClave = new Map((results ?? []).map((r) => [r.franja, r]));
  return FRANJAS.filter((f) => porClave.has(f.key)).map((f) => {
    const r = porClave.get(f.key);
    return {
      key: f.key,
      nombre: NOMBRE_FRANJA[f.key]?.es ?? f.key,
      seccion: f.seccion ?? null,
      intentos: Number(r?.intentos ?? 0),
      notas: Number(r?.hechos ?? 0),
      porQue: r?.porQue ? String(r.porQue).slice(0, 200) : null,
    };
  });
}
