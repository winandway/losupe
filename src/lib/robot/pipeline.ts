import { pingIndexNow } from "@/lib/indexnow";
import type { SectionId } from "@/lib/sections";
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
} from "./universal";
import { SQL_NOW } from "../sql-time";
import { FRANJAS, franjaActiva, NOMBRE_FRANJA, partesEnZona, ZONA } from "./franjas";
import { TICK_KEY } from "./heartbeat";
import {
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
  /** A cuántos correos se avisó (equipo + suscriptores) y el fallo si lo hubo. */
  notified?: number;
  notifyError?: string;
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
  /** A qué horas publica el diario (hora del Este de EE. UU.) y en cuál estamos. */
  horario: {
    zona: string;
    franjas: { key: string; hour: number; nombre: string }[];
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
      franjas: FRANJAS.map((f) => ({ key: f.key, hour: f.hour, nombre: NOMBRE_FRANJA[f.key].es })),
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
  const discover = await discoverCandidates(db, { fetchImpl, now });

  // 5) Notas, alternando
  for (let i = 0; i < maxNotes; i++) {
    const itemId = crypto.randomUUID();
    const [nextSponsored, nextCandidate] = await Promise.all([
      nextQueuedAssignment(db, now),
      pickCandidate(db, now),
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
          slug: `${now.toISOString().slice(0, 10)}-${slugBase
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 60)}`,
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
      } else if (kind === "universal" && nextCandidate) {
        const c = nextCandidate;
        await noteItem(db, runId, itemId, {
          status: "working",
          step: "research",
          section: c.sectionId,
          topic: c.title,
        });
        const docs = await gatherSources(db, c, fetchImpl);
        if (docs.length === 0) {
          await markCandidate(db, c.id, "skipped");
          throw new Error(`No se pudo leer la fuente: ${c.url}`);
        }
        const noteKind = todayTotal % 10 < Math.round(evergreenRatio * 10) ? "evergreen" : "news";
        await noteItem(db, runId, itemId, { status: "working", step: "write" });
        const prompt = buildUniversalPrompt({
          sectionId: c.sectionId,
          topicTitle: c.title,
          topicSummary: c.summary,
          kind: noteKind,
          sources: docs,
          internalLinks: await internalLinksFor(db, c.sectionId),
        });
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
          slug: `${now.toISOString().slice(0, 10)}-${draft.es.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 60)}`,
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
