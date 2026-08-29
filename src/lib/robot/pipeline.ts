import { pingIndexNow } from "@/lib/indexnow";
import type { SectionId } from "@/lib/sections";
import { slugify } from "@/lib/slug";
import { absoluteUrl, articlePath } from "@/lib/urls";
import {
  assertBudget,
  BudgetExceededError,
  getDailyBudgetUsd,
  getSetting,
  getSpendToday,
  recordSpend,
} from "./budget";
import { mailConfigured, parseRecipients } from "@/lib/mail";
import { pickWriter } from "./authors";
import { notifyPublished } from "./notify";
import { publicarEnRedes, type ResultadoRedes } from "@/lib/redes";
import { DIAS_DE_MEMORIA, type NotaDelArchivo } from "./archivo";
import { recordarConfirmacion } from "@/lib/subscribers";
import { limpiarVisitasViejas } from "@/lib/lectores";
import { enviarBoletin, estadoBoletin } from "@/lib/boletin";
import { embedVideo, findPexelsVideo, illustrate } from "./images";
import { saveArticle } from "./publish";
import {
  decideNextKind,
  getSponsorPace,
  nextQueuedAssignment,
  queueSummary,
  rememberLastKind,
  updateAssignment,
  type JobKind,
  type QueueSummary,
} from "./queue";
import { researchSite } from "./research";
import {
  discoverCandidates,
  gatherSources,
  markCandidate,
  pickCandidate,
  robotNotesToday,
  limpiarCandidatosFueraDeTema,
} from "./universal";
import { SQL_NOW } from "../sql-time";
import {
  FRANJAS,
  franjaActiva,
  NOMBRE_FRANJA,
  NOMBRE_GENERO,
  NOMBRE_SUBGENERO,
  partesEnZona,
  ZONA,
} from "./franjas";
import { TICK_KEY } from "./heartbeat";
import { encargoDelTurno, reglasDeLaMesa } from "./mesa";
import { buscarArticulos } from "./wikipedia";
import { fetchPage } from "./research";
import {
  buildPiezaPropiaPrompt,
  buildSponsoredPrompt,
  buildUniversalPrompt,
  writeDraft,
  type InternalLink,
  type SourceDoc,
} from "./writer";

/**
 * El pipeline del robot: una corrida = hasta N notas. Cada nota alterna entre un ENCARGO de la cola
 * (patrocinador) y una nota UNIVERSAL (fuentes públicas). Todo queda anotado en `runs`/`run_items`;
 * nada falla en silencio: si falta una llave o se pasó el tope, la corrida lo dice.
 */

export type RobotEnv = {
  DB: D1Database;
  BUCKET?: R2Bucket;
  GEMINI_API_KEY?: string;
  FAL_KEY?: string;
  PEXELS_API_KEY?: string;
  BRAVE_API_KEY?: string;
  CRON_SECRET?: string;
  ADMIN_PASSWORD?: string;
  NEXT_PUBLIC_SITE_URL?: string;
  YAD_SITE?: string;
  YAD_TOKEN?: string;
  MAIL_FROM?: string;
  MAIL_FROM_NAME?: string;
  // Redes sociales. Todas opcionales: la red que no tenga sus llaves sencillamente no se usa.
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  BLUESKY_IDENTIFIER?: string;
  BLUESKY_APP_PASSWORD?: string;
  BLUESKY_HOST?: string;
  MASTODON_HOST?: string;
  MASTODON_TOKEN?: string;
  FACEBOOK_PAGE_ID?: string;
  FACEBOOK_PAGE_TOKEN?: string;
};

export type PipelineOptions = {
  trigger: "cron" | "manual";
  base: string;
  maxNotes?: number;
  force?: boolean;
  fetchImpl?: typeof fetch;
  now?: Date;
};

export type NoteResult = {
  kind: JobKind;
  ok: boolean;
  articleId?: string;
  path?: string;
  status?: "published" | "review";
  title?: string;
  costUsd: number;
  error?: string;
  sponsor?: string;
  /** Cuántos intentos hicieron falta para que la nota pasara el control anticopia. */
  attempts?: number;
  /** Qué decidió la mesa de redacción: actualidad, pieza propia o efeméride. */
  genero?: "actualidad" | "propia" | "efemeride";
  /** A cuántos correos se avisó (equipo + suscriptores) y el fallo si lo hubo. */
  notified?: number;
  notifyError?: string;
  /** Cuántas redes recibieron el anuncio de esta nota. */
  socialSent?: number;
  /** Qué red falló y por qué. Se ve en el panel: un fallo mudo es un fallo que dura meses. */
  socialError?: string;
  /** Si esta nota es un capítulo más de otra, de cuál. Para que se vea en el panel. */
  seguimientoDe?: string;
};

export type RunSummary = {
  ok: boolean;
  runId: string;
  status: "skipped" | "done" | "error";
  reason?: string;
  notes: NoteResult[];
  spentUsd: number;
  startedAt: string;
  finishedAt: string;
};

export type RobotStatus = {
  paused: boolean;
  autoPublish: boolean;
  keys: { gemini: boolean; fal: boolean; pexels: boolean; brave: boolean; admin: boolean };
  ready: boolean;
  missing: string[];
  budget: { limitUsd: number; spentTodayUsd: number };
  quota: { notesPerDay: number; today: number };
  evergreenRatio: number;
  mail: { configured: boolean; recipients: string[] };
  sponsorPace: { gapHours: number; maxPerWeek: number };
  /** La mesa de redacción: cuánto se escribe de cosecha propia y si se usan las efemérides. */
  mesa: { ratioPropias: number; efemerides: boolean };
  /** Suscriptores por estado. Solo cuentas, ningún correo: sirve para saber si el boletín llega. */
  subscribers: { confirmed: number; pending: number; unsubscribed: number; withError: number };
  /** El boletín de resumen: si está encendido, cada cuánto sale y cuándo toca el siguiente. */
  boletin: { activo: boolean; cada: number; ultimo: string | null; proximo: string | null };
  /** A qué horas publica el diario (hora del Este de EE. UU.) y en cuál estamos. */
  horario: {
    zona: string;
    franjas: { key: string; hour: number; nombre: string; genero: string }[];
    ahora: string;
    franjaAbierta: string | null;
    turnoHecho: string | null;
  };
  queue: QueueSummary;
  lastRun: {
    id: string;
    status: string;
    trigger: string;
    startedAt: string;
    finishedAt: string | null;
    error: string | null;
    summary: unknown;
    /** En qué paso quedó. Si la corrida se corta, aquí se ve DÓNDE murió. */
    step?: string | null;
    /** Las notas de esa corrida con su último paso: el detalle para diagnosticar un corte. */
    items?: { status: string; step: string | null; topic: string | null; error: string | null }[];
  } | null;
};

export async function isRobotPaused(db: D1Database): Promise<boolean> {
  const v = await getSetting(db, "robot_paused");
  return v === null || v !== "0";
}

export async function robotStatus(env: RobotEnv, now = new Date()): Promise<RobotStatus> {
  const db = env.DB;
  const [paused, auto, limit, spent, today, queue, perDay, ratio, notifyEmails, pace, last] =
    await Promise.all([
      isRobotPaused(db),
      getSetting(db, "robot_auto_publish"),
      getDailyBudgetUsd(db),
      getSpendToday(db, now),
      robotNotesToday(db, now),
      queueSummary(db, now),
      getSetting(db, "notes_per_day"),
      getSetting(db, "evergreen_ratio"),
      getSetting(db, "notify_emails"),
      getSponsorPace(db),
      db.prepare(`SELECT * FROM runs ORDER BY started_at DESC LIMIT 1`).first<{
        id: string;
        status: string;
        trigger: string;
        started_at: string;
        finished_at: string | null;
        error: string | null;
        summary_json: string | null;
        step: string | null;
      }>(),
    ]);
  const keys = {
    gemini: Boolean(env.GEMINI_API_KEY),
    fal: Boolean(env.FAL_KEY),
    pexels: Boolean(env.PEXELS_API_KEY),
    brave: Boolean(env.BRAVE_API_KEY),
    admin: Boolean(env.ADMIN_PASSWORD),
  };
  const missing: string[] = [];
  if (!keys.gemini) missing.push("GEMINI_API_KEY");
  if (!keys.fal && !keys.pexels) missing.push("FAL_KEY o PEXELS_API_KEY");
  if (!keys.admin) missing.push("ADMIN_PASSWORD");
  let summary: unknown = null;
  if (last?.summary_json) {
    try {
      summary = JSON.parse(last.summary_json);
    } catch {
      summary = last.summary_json;
    }
  }
  const itemsUltimaCorrida = last
    ? (
        await db
          .prepare(
            `SELECT status, step, topic, error FROM run_items WHERE run_id = ?1 ORDER BY rowid`,
          )
          .bind(last.id)
          .all<{
            status: string;
            step: string | null;
            topic: string | null;
            error: string | null;
          }>()
          .catch(() => ({ results: [] }))
      ).results
    : [];

  return {
    paused,
    autoPublish: auto === "1",
    keys,
    ready: keys.gemini && !paused,
    missing,
    budget: { limitUsd: limit, spentTodayUsd: spent },
    horario: {
      zona: ZONA,
      franjas: FRANJAS.map((f) => ({
        key: f.key,
        hour: f.hour,
        nombre: NOMBRE_FRANJA[f.key].es,
        genero: f.subgenero ? NOMBRE_SUBGENERO[f.subgenero].es : NOMBRE_GENERO[f.genero].es,
      })),
      ahora: `${String(partesEnZona(now).hh).padStart(2, "0")}:${String(partesEnZona(now).mm).padStart(2, "0")}`,
      franjaAbierta: franjaActiva(now)?.key ?? null,
      turnoHecho: (await getSetting(db, TICK_KEY)) || null,
    },
    quota: {
      notesPerDay: Number(perDay ?? "6") || 6,
      today: Object.values(today).reduce((a, b) => a + b, 0),
    },
    evergreenRatio: Math.min(1, Math.max(0, Number(ratio ?? "0.5") || 0)),
    mail: { configured: mailConfigured(env), recipients: parseRecipients(notifyEmails) },
    sponsorPace: pace,
    mesa: await reglasDeLaMesa(db),
    subscribers: await contarSuscriptores(db),
    boletin: await estadoBoletin(db, now),
    queue,
    lastRun: last
      ? {
          id: last.id,
          status: last.status,
          trigger: last.trigger,
          startedAt: last.started_at,
          finishedAt: last.finished_at,
          error: last.error,
          summary,
          step: last.step ?? null,
          // Sin esto, una corrida cortada solo dice «se cortó» y no hay forma de saber en qué
          // paso murió. El dato ya se guardaba en `run_items`; solo faltaba enseñarlo.
          items: itemsUltimaCorrida,
        }
      : null,
  };
}

/** Si el redactor pidió video y hay Pexels, lo busca y lo incrusta en ambos idiomas (sin romper nada si falla). */
async function maybeAddVideo(
  env: RobotEnv,
  draft: import("./writer").Draft,
  fetchImpl: typeof fetch,
): Promise<{ draft: import("./writer").Draft; video: string | null }> {
  if (!draft.wants_video || !env.PEXELS_API_KEY || draft.video_keywords.length === 0) {
    return { draft, video: null };
  }
  try {
    const video = await findPexelsVideo(draft.video_keywords, env.PEXELS_API_KEY, fetchImpl);
    if (!video) return { draft, video: null };
    return {
      draft: {
        ...draft,
        es: {
          ...draft.es,
          content_html: embedVideo(draft.es.content_html, video, "Video de archivo"),
        },
        en: { ...draft.en, content_html: embedVideo(draft.en.content_html, video, "Stock video") },
      },
      video: video.src,
    };
  } catch {
    return { draft, video: null };
  }
}

/** Notas nuestras ya publicadas de la misma sección, para que el redactor enlace hacia dentro. */
async function internalLinksFor(
  db: D1Database,
  sectionId: SectionId,
  lang: "es" | "en" = "es",
  limit = 6,
): Promise<InternalLink[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT i.title, i.slug, a.section_id FROM articles a
         JOIN article_i18n i ON i.article_id = a.id AND i.lang = ?2
         WHERE a.status = 'published' AND a.section_id = ?1
         ORDER BY a.published_at DESC LIMIT ?3`,
      )
      .bind(sectionId, lang, limit)
      .all<{ title: string; slug: string; section_id: string }>();
    return results.map((r) => ({
      title: r.title,
      path: articlePath(lang, r.section_id as SectionId, r.slug),
    }));
  } catch {
    return [];
  }
}

async function startRun(db: D1Database, runId: string, trigger: string, startedAt: string) {
  await db
    .prepare(
      `INSERT INTO runs (id, trigger, status, step, started_at) VALUES (?1, ?2, 'running', 'start', ?3)`,
    )
    .bind(runId, trigger, startedAt)
    .run();
}

async function finishRun(
  db: D1Database,
  runId: string,
  status: RunSummary["status"],
  step: string,
  summary: unknown,
  error?: string,
) {
  await db
    .prepare(
      `UPDATE runs SET status = ?2, step = ?3, finished_at = ?4, summary_json = ?5, error = ?6 WHERE id = ?1`,
    )
    .bind(runId, status, step, new Date().toISOString(), JSON.stringify(summary), error ?? null)
    .run();
}

async function noteItem(
  db: D1Database,
  runId: string,
  itemId: string,
  patch: {
    status: string;
    step?: string;
    section?: string;
    topic?: string;
    articleId?: string;
    cost?: number;
    error?: string;
    sources?: unknown;
  },
) {
  const exists = await db
    .prepare(`SELECT 1 AS x FROM run_items WHERE id = ?1`)
    .bind(itemId)
    .first();
  if (!exists) {
    await db
      .prepare(
        `INSERT INTO run_items (id, run_id, section_id, status, step, topic) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(
        itemId,
        runId,
        patch.section ?? null,
        patch.status,
        patch.step ?? null,
        patch.topic ?? null,
      )
      .run();
    return;
  }
  await db
    .prepare(
      `UPDATE run_items SET status = ?2, step = COALESCE(?3, step), article_id = COALESCE(?4, article_id), cost_usd = COALESCE(?5, cost_usd), error = ?6, sources_json = COALESCE(?7, sources_json), updated_at = ${SQL_NOW} WHERE id = ?1`,
    )
    .bind(
      itemId,
      patch.status,
      patch.step ?? null,
      patch.articleId ?? null,
      patch.cost ?? null,
      patch.error ?? null,
      patch.sources ? JSON.stringify(patch.sources) : null,
    )
    .run();
}

/**
 * Cuántos suscriptores hay y en qué estado. Sin esto no había forma de saber por qué un aviso «no
 * llegaba a nadie»: con la doble confirmación, quien no toca el enlace de su correo NO recibe nada,
 * y eso es correcto pero invisible.
 */
async function contarSuscriptores(
  db: D1Database,
): Promise<{ confirmed: number; pending: number; unsubscribed: number; withError: number }> {
  const out = { confirmed: 0, pending: 0, unsubscribed: 0, withError: 0 };
  try {
    const { results } = await db
      .prepare(`SELECT status, COUNT(*) AS n FROM subscribers GROUP BY status`)
      .all<{ status: string; n: number }>();
    for (const r of results) {
      if (r.status === "confirmed") out.confirmed = Number(r.n);
      else if (r.status === "pending") out.pending = Number(r.n);
      else if (r.status === "unsubscribed") out.unsubscribed = Number(r.n);
    }
    const err = await db
      .prepare(`SELECT COUNT(*) AS n FROM subscribers WHERE mail_error IS NOT NULL`)
      .first<{ n: number }>();
    out.withError = Number(err?.n ?? 0);
  } catch {
    /* si la tabla aún no existe, se devuelven ceros */
  }
  return out;
}

/**
 * EL ARCHIVO DEL DIARIO: lo que ya contamos estos días, con su entradilla y sus fuentes.
 *
 * Antes solo se leían los titulares, y solo los usaba el banco de ideas propias. Una nota de
 * actualidad no se comparaba con nada, y así salieron dos notas del mismo asunto con cinco días de
 * diferencia (29 ago 2026). Ahora esto lo ve todo el mundo: la actualidad también.
 */
async function archivoDelDiario(db: D1Database, dias = DIAS_DE_MEMORIA): Promise<NotaDelArchivo[]> {
  try {
    const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
    const { results } = await db
      .prepare(
        `SELECT i.title, i.excerpt, a.sources_json, a.created_at
           FROM article_i18n i JOIN articles a ON a.id = i.article_id
          WHERE i.lang = 'es' AND a.created_at >= ?1
          ORDER BY a.created_at DESC LIMIT 80`,
      )
      .bind(desde)
      .all<{
        title: string;
        excerpt: string | null;
        sources_json: string | null;
        created_at: string;
      }>();
    return (results ?? []).map((r) => ({
      titulo: r.title,
      entradilla: r.excerpt,
      publicadaEn: r.created_at,
      fuentes: leerFuentes(r.sources_json),
    }));
  } catch {
    return [];
  }
}

function leerFuentes(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json) as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .map((s) => (typeof s === "string" ? s : ((s as { url?: string })?.url ?? "")))
      .filter((u): u is string => typeof u === "string" && u.length > 0);
  } catch {
    return [];
  }
}

/** Titulares publicados en los últimos meses: la mesa los usa para no repetir tema. */
async function titularesRecientes(db: D1Database, limite = 120): Promise<string[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT i.title FROM article_i18n i JOIN articles a ON a.id = i.article_id
         WHERE i.lang = 'es' ORDER BY a.created_at DESC LIMIT ?1`,
      )
      .bind(limite)
      .all<{ title: string }>();
    return results.map((r) => r.title);
  } catch {
    return [];
  }
}

/** Secciones que todavía tienen cupo hoy, en orden de cuánto les queda. */
async function seccionesConCupo(db: D1Database, ahora: Date): Promise<SectionId[]> {
  try {
    const [{ results: cupos }, hoy] = await Promise.all([
      db
        .prepare(`SELECT id, notes_per_day FROM sections WHERE active = 1 ORDER BY sort_order`)
        .all<{ id: string; notes_per_day: number }>(),
      robotNotesToday(db, ahora),
    ]);
    return cupos
      .map((c) => ({ id: c.id as SectionId, libre: Number(c.notes_per_day) - (hoy[c.id] ?? 0) }))
      .filter((c) => c.libre > 0)
      .sort((a, b) => b.libre - a.libre)
      .map((c) => c.id);
  } catch {
    return [];
  }
}

/** Lee unas páginas y las deja listas como material para el redactor. */
async function leerPaginas(urls: readonly string[], fetchImpl: typeof fetch): Promise<SourceDoc[]> {
  const leidas = await Promise.all(
    urls
      .slice(0, 4)
      .map((url) => fetchPage(url, { fetchImpl, maxChars: 12_000 }).catch(() => null)),
  );
  return leidas
    .filter((p): p is NonNullable<typeof p> => Boolean(p?.text && p.text.length > 400))
    .map((p) => ({ title: p.title || p.url, url: p.url, text: p.text }));
}

/**
 * El anuncio en redes, envuelto para que NUNCA pueda tumbar una publicación. La nota ya está en el
 * sitio cuando esto corre: si aquí revienta algo, lo peor que puede pasar es quedarse sin post.
 */
async function anunciarEnRedes(
  db: D1Database,
  env: RobotEnv,
  base: string,
  nota: {
    articleId: string;
    titulo: string;
    resumen: string;
    path: string;
    sectionId: string;
  },
  fetchImpl: typeof fetch,
): Promise<ResultadoRedes> {
  try {
    return await publicarEnRedes(
      db,
      env as unknown as Record<string, string | undefined>,
      {
        articleId: nota.articleId,
        titulo: nota.titulo,
        resumen: nota.resumen,
        url: absoluteUrl(base, nota.path),
        seccion: nota.sectionId,
        lang: "es",
      },
      fetchImpl,
    );
  } catch (error) {
    return {
      activas: 0,
      enviados: [
        {
          red: "telegram",
          ok: false,
          error: `fallo inesperado: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

export async function runPipeline(env: RobotEnv, opts: PipelineOptions): Promise<RunSummary> {
  const db = env.DB;
  const now = opts.now ?? new Date();
  const startedAt = now.toISOString();
  const runId = crypto.randomUUID();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const notes: NoteResult[] = [];
  let spent = 0;
  await startRun(db, runId, opts.trigger, startedAt);

  const done = async (
    status: RunSummary["status"],
    step: string,
    reason?: string,
    error?: string,
  ): Promise<RunSummary> => {
    const summary = { reason, notes, spentUsd: spent };
    await finishRun(db, runId, status, step, summary, error);
    return {
      ok: status !== "error",
      runId,
      status,
      reason,
      notes,
      spentUsd: spent,
      startedAt,
      finishedAt: new Date().toISOString(),
    };
  };

  // 1) Interruptor
  if (!opts.force && (await isRobotPaused(db))) return done("skipped", "paused", "robot_paused");

  // 2) Llaves (sin Gemini no hay redactor): se dice claro, no se disimula.
  if (!env.GEMINI_API_KEY) {
    return done(
      "error",
      "keys",
      "missing_env:GEMINI_API_KEY",
      "Falta GEMINI_API_KEY en el panel de YaDominios Cloud",
    );
  }

  // 3) Tope de gasto y cupo diario
  try {
    await assertBudget(db, 0, now);
  } catch (e) {
    if (e instanceof BudgetExceededError)
      return done("skipped", "budget", "daily_budget_reached", e.message);
    throw e;
  }
  const perDay = Number((await getSetting(db, "notes_per_day")) ?? "6") || 6;
  const todayBySection = await robotNotesToday(db, now);
  let todayTotal = Object.values(todayBySection).reduce((a, b) => a + b, 0);
  if (todayTotal >= perDay) return done("skipped", "quota", "daily_quota_reached");

  const autoPublish = (await getSetting(db, "robot_auto_publish")) === "1";
  // La firma por defecto tiene que existir y estar activa: si el ajuste apunta a alguien que ya no
  // trabaja con nosotros (pasó con Magaly Molina), se usa la redacción en su lugar.
  const ajuste = await getSetting(db, "default_author");
  const valido = ajuste
    ? await db
        .prepare(`SELECT id FROM authors WHERE id = ?1 AND active = 1`)
        .bind(ajuste)
        .first<{ id: string }>()
    : null;
  const defaultAuthor = valido?.id ?? "equipo-losupe";
  /** Firma de esta nota: turno del equipo para esa sección (o la de por defecto si no hay equipo). */
  const authorFor = async (section: SectionId) =>
    (await pickWriter(db, section, now).catch(() => null))?.id ?? defaultAuthor;
  const evergreenRatio = Number((await getSetting(db, "evergreen_ratio")) ?? "0.7");
  const maxNotes = Math.max(
    1,
    Math.min(
      (opts.maxNotes ?? Number((await getSetting(db, "robot_notes_per_run")) ?? "1")) || 1,
      perDay - todayTotal,
    ),
  );

  // 4) Descubrir candidatos universales (barato: solo RSS)
  // Antes de nada, fuera los temas guardados que hoy no publicaríamos: el filtro se aplica al
  // descubrir, así que al mejorarlo lo que ya estaba dentro se quedaba dentro.
  await limpiarCandidatosFueraDeTema(db).catch(() => 0);
  // Y de paso, el recordatorio a quien se apuntó y no confirmó. Va aquí porque el robot ya corre
  // tres veces al día: no hace falta otro reloj para algo que manda un correo cada tanto.
  await recordarConfirmacion(db, env, opts.base).catch(() => undefined);
  // Y el detalle de visitas que ya no sirve: se guarda lo justo y se borra solo.
  await limpiarVisitasViejas(db, now).catch(() => 0);
  // Y el boletín, si toca. Sale cada cuatro días desde la propia corrida: no hace falta otro reloj.
  await enviarBoletin(db, env, opts.base, now).catch(() => undefined);
  const discover = await discoverCandidates(db, { fetchImpl, now });

  // 5) Notas, alternando
  for (let i = 0; i < maxNotes; i++) {
    const itemId = crypto.randomUUID();
    const archivo = await archivoDelDiario(db);
    const [nextSponsored, nextCandidate] = await Promise.all([
      nextQueuedAssignment(db, now),
      pickCandidate(db, now, archivo),
    ]);
    const kind = await decideNextKind(db, {
      sponsoredAvailable: Boolean(nextSponsored),
      universalAvailable: Boolean(nextCandidate),
    });
    if (!kind) {
      if (notes.length === 0) return done("skipped", "nothing", "nothing_to_do");
      break;
    }
    const result: NoteResult = { kind, ok: false, costUsd: 0 };
    try {
      await assertBudget(db, 0.05, now);
      if (kind === "sponsored" && nextSponsored) {
        const a = nextSponsored;
        const sectionId: SectionId = a.sectionId ?? a.sponsor.sectionId ?? "ventas";
        result.sponsor = a.sponsor.name;
        await noteItem(db, runId, itemId, {
          status: "working",
          step: "research",
          section: sectionId,
          topic: a.titleIdea,
        });
        await updateAssignment(db, a.id, { status: "working" });
        await db
          .prepare(`UPDATE assignments SET run_id = ?2 WHERE id = ?1`)
          .bind(a.id, runId)
          .run();

        const research = await researchSite(a.sponsor.website, {
          extraUrls: a.sourceUrls,
          fetchImpl,
        });
        if (research.pages.length === 0) {
          throw new Error(
            `No se pudo leer el sitio del patrocinador (${research.errors.join("; ") || a.sponsor.website})`,
          );
        }
        await db
          .prepare(`UPDATE assignments SET research_json = ?2 WHERE id = ?1`)
          .bind(
            a.id,
            JSON.stringify({
              fetchedAt: research.fetchedAt,
              pages: research.pages.map((p) => ({
                url: p.url,
                title: p.title,
                chars: p.text.length,
              })),
              errors: research.errors,
            }),
          )
          .run();
        await noteItem(db, runId, itemId, { status: "working", step: "write" });
        const prompt = buildSponsoredPrompt({
          internalLinks: await internalLinksFor(db, sectionId),
          sponsorName: a.sponsor.name,
          website: a.sponsor.website,
          sponsorBrief: a.sponsor.brief,
          titleIdea: a.titleIdea,
          brief: a.brief,
          sectionId,
          pages: research.pages,
        });
        const sourceTexts = research.pages.map((p) => p.text);
        const written = await writeDraft(prompt, sourceTexts, {
          apiKey: env.GEMINI_API_KEY,
          fetchImpl,
        });
        if (written.attempts > 1) result.attempts = written.attempts;
        const usage = written.usage;
        const { draft } = await maybeAddVideo(env, written.draft, fetchImpl);
        await recordSpend(
          db,
          {
            provider: "gemini",
            model: usage.model,
            units: usage.inputTokens + usage.outputTokens,
            costUsd: usage.costUsd,
            runId,
          },
          now,
        );
        result.costUsd += usage.costUsd;
        spent += usage.costUsd;

        await noteItem(db, runId, itemId, { status: "working", step: "illustrate" });
        const slugBase = draft.es.title;
        const { image, errors: imgErrors } = await illustrate({
          env,
          db,
          prompt: draft.image_prompt,
          keywords: draft.image_keywords,
          slug: `${now.toISOString().slice(0, 10)}-${slugify(slugBase).slice(0, 60)}`,
          runId,
          fetchImpl,
        });
        if (image?.provider === "fal") {
          result.costUsd += 0.03;
          spent += 0.03;
        }

        await noteItem(db, runId, itemId, { status: "working", step: "publish" });
        const sources: SourceDoc[] = research.pages.map((p) => ({
          title: p.title || a.sponsor.name,
          url: p.url,
          text: "",
        }));
        const saved = await saveArticle(db, {
          draft,
          sectionId,
          authorId: await authorFor(sectionId),
          origin: "sponsored",
          status: autoPublish ? "published" : "review",
          sources: sources.slice(0, 5).map(({ title, url }) => ({ title, url })),
          image: image ? { url: image.url, credit: image.credit } : null,
          runId,
          now,
        });
        await updateAssignment(db, a.id, {
          status: saved.status === "published" ? "published" : "review",
        });
        await db
          .prepare(
            `UPDATE assignments SET article_id = ?2, published_at = ?3, error = ?4 WHERE id = ?1`,
          )
          .bind(
            a.id,
            saved.articleId,
            saved.status === "published" ? now.toISOString() : null,
            imgErrors.length ? `Imagen: ${imgErrors.join("; ")}` : null,
          )
          .run();
        await rememberLastKind(db, "sponsored");
        if (saved.status === "published") {
          await pingIndexNow(
            opts.base,
            [absoluteUrl(opts.base, saved.pathEs), absoluteUrl(opts.base, saved.pathEn)],
            fetchImpl,
          ).catch(() => undefined);
          // Aviso por correo: nunca frena la publicación (la nota ya está en el sitio).
          const aviso = await notifyPublished(
            db,
            env,
            opts.base,
            {
              articleId: saved.articleId,
              title: draft.es.title,
              excerpt: draft.es.excerpt,
              path: saved.pathEs,
              sectionId: sectionId,
              authorName: saved.authorName,
            },
            fetchImpl,
          ).catch(() => ({ team: 0, subscribers: 0, errors: ["aviso: fallo inesperado"] }));
          result.notified = aviso.team + aviso.subscribers;
          if (aviso.errors.length > 0) result.notifyError = aviso.errors.join(" | ");
          // Y se anuncia en las redes encendidas. Como el correo: no puede frenar nada, y si falla
          // queda escrito con su motivo en `social_posts` y sale en el panel.
          const redes = await anunciarEnRedes(
            db,
            env,
            opts.base,
            {
              articleId: saved.articleId,
              titulo: draft.es.title,
              resumen: draft.es.excerpt,
              path: saved.pathEs,
              sectionId: sectionId,
            },
            fetchImpl,
          );
          result.socialSent = redes.enviados.filter((e) => e.ok).length;
          const malas = redes.enviados.filter((e) => !e.ok);
          if (malas.length > 0)
            result.socialError = malas.map((e) => `${e.red}: ${e.error}`).join(" | ");
        }
        Object.assign(result, {
          ok: true,
          articleId: saved.articleId,
          path: saved.pathEs,
          status: saved.status,
          title: draft.es.title,
        });
        await noteItem(db, runId, itemId, {
          status: "done",
          step: "done",
          articleId: saved.articleId,
          cost: result.costUsd,
          sources: sources.map((s) => s.url),
        });
      } else if (kind === "universal") {
        // LA MESA DE REDACCIÓN decide qué se escribe: la actualidad que trajo el RSS, una pieza
        // propia (curiosidades, errores, guía) o la efeméride del día. Antes solo existía lo
        // primero, y por eso se perdían notas que la gente estaba esperando.
        const encargo = await encargoDelTurno(db, {
          // La franja de este momento decide el género (la escaleta). Si la corrida es a mano y
          // estamos fuera de horario, `encargoDelTurno` alterna por posición del día.
          franja: franjaActiva(now),
          notasHoy: todayTotal,
          hayActualidad: Boolean(nextCandidate),
          titularesRecientes: await titularesRecientes(db),
          seccionesConCupo: await seccionesConCupo(db, now),
          ahora: now,
          fetchImpl,
        }).catch(() => ({ genero: "actualidad" as const }));

        let seccion: SectionId;
        let tema: string;
        let docs: SourceDoc[];
        let prompt: string;
        let noteKind: "news" | "evergreen";
        let candidatoUsado: typeof nextCandidate = null;

        if (encargo.genero === "actualidad") {
          if (!nextCandidate) throw new Error("No hay actualidad ni pieza propia que escribir");
          const c = nextCandidate;
          candidatoUsado = c;
          seccion = c.sectionId;
          tema = c.title;
          result.genero = "actualidad";
          await noteItem(db, runId, itemId, {
            status: "working",
            step: "research",
            section: seccion,
            topic: tema,
          });
          docs = await gatherSources(db, c, fetchImpl);
          if (docs.length === 0) {
            await markCandidate(db, c.id, "skipped");
            throw new Error(`No se pudo leer la fuente: ${c.url}`);
          }
          noteKind = todayTotal % 10 < Math.round(evergreenRatio * 10) ? "evergreen" : "news";
          await noteItem(db, runId, itemId, { status: "working", step: "write" });
          prompt = buildUniversalPrompt({
            sectionId: seccion,
            topicTitle: tema,
            topicSummary: c.summary,
            kind: noteKind,
            sources: docs,
            internalLinks: await internalLinksFor(db, seccion),
            // Si el tema ya se contó y sigue vivo, el redactor tiene que empezar por lo nuevo.
            seguimiento: c.seguimiento,
            // Y aunque el tema sea otro, que no titule igual que algo que ya está en la portada.
            yaPublicado: archivo.slice(0, 12).map((n) => n.titulo),
          });
          if (c.seguimiento) result.seguimientoDe = c.seguimiento.de;
        } else {
          const propio =
            encargo.genero === "propia"
              ? {
                  seccion: encargo.idea.sectionId,
                  titular: encargo.idea.titular,
                  genero: encargo.idea.genero,
                  buscar: encargo.idea.busqueda,
                  urls: [] as string[],
                }
              : {
                  seccion: encargo.sectionId,
                  titular: encargo.titular,
                  genero: "curiosidades" as const,
                  buscar: encargo.efemeride.texto,
                  urls: encargo.efemeride.fuentes.map((f) => f.url),
                };
          seccion = propio.seccion;
          tema = propio.titular;
          result.genero = encargo.genero;
          await noteItem(db, runId, itemId, {
            status: "working",
            step: "research",
            section: seccion,
            topic: tema,
          });
          // Una pieza propia también se documenta: sin fuentes, una lista de curiosidades se
          // inventa sola, que es exactamente lo que no queremos.
          const encontrados =
            propio.urls.length > 0
              ? propio.urls
              : (await buscarArticulos(propio.buscar, 3, fetchImpl)).map((a) => a.url);
          docs = await leerPaginas(encontrados, fetchImpl);
          if (docs.length === 0) {
            throw new Error(`No se encontró material para documentar «${tema}»`);
          }
          noteKind = "evergreen";
          await noteItem(db, runId, itemId, { status: "working", step: "write" });
          prompt = buildPiezaPropiaPrompt({
            titularPropuesto: propio.titular,
            genero: propio.genero,
            sectionId: seccion,
            sources: docs,
            internalLinks: await internalLinksFor(db, seccion),
          });
        }
        const c = candidatoUsado ?? { id: "", sectionId: seccion, title: tema, url: "" };
        const written = await writeDraft(
          prompt,
          docs.map((d) => d.text),
          { apiKey: env.GEMINI_API_KEY, fetchImpl },
        );
        if (written.attempts > 1) result.attempts = written.attempts;
        const usage = written.usage;
        const { draft } = await maybeAddVideo(env, written.draft, fetchImpl);
        await recordSpend(
          db,
          {
            provider: "gemini",
            model: usage.model,
            units: usage.inputTokens + usage.outputTokens,
            costUsd: usage.costUsd,
            runId,
          },
          now,
        );
        result.costUsd += usage.costUsd;
        spent += usage.costUsd;

        await noteItem(db, runId, itemId, { status: "working", step: "illustrate" });
        const { image } = await illustrate({
          env,
          db,
          prompt: draft.image_prompt,
          keywords: draft.image_keywords,
          // El nombre del archivo cuenta para Google Imágenes. Antes se hacía a mano y las tildes
          // se convertían en guiones («gu-a-para-empresas»); `slugify` las transcribe («guia»).
          slug: `${now.toISOString().slice(0, 10)}-${slugify(draft.es.title).slice(0, 60)}`,
          runId,
          fetchImpl,
        });
        if (image?.provider === "fal") {
          result.costUsd += 0.03;
          spent += 0.03;
        }
        await noteItem(db, runId, itemId, { status: "working", step: "publish" });
        const saved = await saveArticle(db, {
          draft,
          sectionId: c.sectionId,
          authorId: await authorFor(c.sectionId),
          origin: "robot",
          status: autoPublish ? "published" : "review",
          sources: docs.map((d) => ({ title: d.title, url: d.url })),
          image: image ? { url: image.url, credit: image.credit } : null,
          runId,
          now,
        });
        await markCandidate(db, c.id, "used", saved.articleId);
        await rememberLastKind(db, "universal");
        if (saved.status === "published") {
          await pingIndexNow(
            opts.base,
            [absoluteUrl(opts.base, saved.pathEs), absoluteUrl(opts.base, saved.pathEn)],
            fetchImpl,
          ).catch(() => undefined);
          const aviso = await notifyPublished(
            db,
            env,
            opts.base,
            {
              articleId: saved.articleId,
              title: draft.es.title,
              excerpt: draft.es.excerpt,
              path: saved.pathEs,
              sectionId: c.sectionId,
              authorName: saved.authorName,
            },
            fetchImpl,
          ).catch(() => ({ team: 0, subscribers: 0, errors: ["aviso: fallo inesperado"] }));
          result.notified = aviso.team + aviso.subscribers;
          if (aviso.errors.length > 0) result.notifyError = aviso.errors.join(" | ");
          // Y se anuncia en las redes encendidas. Como el correo: no puede frenar nada, y si falla
          // queda escrito con su motivo en `social_posts` y sale en el panel.
          const redes = await anunciarEnRedes(
            db,
            env,
            opts.base,
            {
              articleId: saved.articleId,
              titulo: draft.es.title,
              resumen: draft.es.excerpt,
              path: saved.pathEs,
              sectionId: c.sectionId,
            },
            fetchImpl,
          );
          result.socialSent = redes.enviados.filter((e) => e.ok).length;
          const malas = redes.enviados.filter((e) => !e.ok);
          if (malas.length > 0)
            result.socialError = malas.map((e) => `${e.red}: ${e.error}`).join(" | ");
        }
        Object.assign(result, {
          ok: true,
          articleId: saved.articleId,
          path: saved.pathEs,
          status: saved.status,
          title: draft.es.title,
        });
        await noteItem(db, runId, itemId, {
          status: "done",
          step: "done",
          articleId: saved.articleId,
          cost: result.costUsd,
          sources: docs.map((d) => d.url),
        });
      }
      todayTotal += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      result.error = message;
      await noteItem(db, runId, itemId, { status: "error", error: message, cost: result.costUsd });
      if (kind === "sponsored" && nextSponsored) {
        // El encargo vuelve a la cola con el error a la vista (no se pierde; el panel lo muestra).
        await updateAssignment(db, nextSponsored.id, { status: "error" });
        await db
          .prepare(`UPDATE assignments SET error = ?2 WHERE id = ?1`)
          .bind(nextSponsored.id, message.slice(0, 500))
          .run();
      }
      if (e instanceof BudgetExceededError) {
        notes.push(result);
        return done("done", "budget", "daily_budget_reached");
      }
      // Si Gemini rechazó la llave (401/403), no tiene sentido seguir.
      if (/respondió 40[13]/.test(message) || /GEMINI_API_KEY/.test(message)) {
        notes.push(result);
        return done("error", "keys", "gemini_auth", message);
      }
    }
    notes.push(result);
  }

  const okCount = notes.filter((n) => n.ok).length;
  const summaryReason = `${okCount}/${notes.length} notas; fuentes leídas ${discover.fetched}, candidatos nuevos ${discover.added}`;
  return done(
    okCount > 0 || notes.length === 0 ? "done" : "error",
    "done",
    summaryReason,
    okCount === 0 && notes.length > 0
      ? notes
          .map((n) => n.error)
          .filter(Boolean)
          .join(" | ")
      : undefined,
  );
}
