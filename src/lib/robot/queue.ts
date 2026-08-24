import type { SectionId } from "@/lib/sections";
import { getSetting, setSetting } from "./budget";
import { SQL_NOW, laterThan, parseSqlDate } from "../sql-time";

/**
 * Cola de encargos: patrocinadores (empresas que compraron notas) y sus notas prometidas.
 * Aquí vive también la regla de alternancia: una nota de encargo, una universal, una de encargo…
 */

export type SponsorStatus = "active" | "paused" | "finished" | "canceled";
export type AssignmentStatus = "queued" | "working" | "review" | "published" | "canceled" | "error";

export type Sponsor = {
  id: string;
  name: string;
  website: string;
  contactName: string | null;
  contactEmail: string | null;
  brief: string | null;
  sectionId: SectionId | null;
  notesTotal: number;
  periodStart: string | null;
  periodEnd: string | null;
  status: SponsorStatus;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SponsorWithCounts = Sponsor & {
  queued: number;
  published: number;
  inReview: number;
  remaining: number;
};

export type Assignment = {
  id: string;
  sponsorId: string;
  position: number;
  titleIdea: string;
  brief: string | null;
  sectionId: SectionId | null;
  sourceUrls: string[];
  scheduledFor: string | null;
  status: AssignmentStatus;
  articleId: string | null;
  runId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

type SponsorRow = {
  id: string;
  name: string;
  website: string;
  contact_name: string | null;
  contact_email: string | null;
  brief: string | null;
  section_id: string | null;
  notes_total: number;
  period_start: string | null;
  period_end: string | null;
  status: string;
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  queued?: number;
  published?: number;
  in_review?: number;
};

type AssignmentRow = {
  id: string;
  sponsor_id: string;
  position: number;
  title_idea: string;
  brief: string | null;
  section_id: string | null;
  source_urls_json: string | null;
  scheduled_for: string | null;
  status: string;
  article_id: string | null;
  run_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

function mapSponsor(r: SponsorRow): SponsorWithCounts {
  const published = Number(r.published ?? 0);
  return {
    id: r.id,
    name: r.name,
    website: r.website,
    contactName: r.contact_name,
    contactEmail: r.contact_email,
    brief: r.brief,
    sectionId: (r.section_id as SectionId | null) ?? null,
    notesTotal: Number(r.notes_total),
    periodStart: r.period_start,
    periodEnd: r.period_end,
    status: r.status as SponsorStatus,
    internalNotes: r.internal_notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    queued: Number(r.queued ?? 0),
    published,
    inReview: Number(r.in_review ?? 0),
    remaining: Math.max(0, Number(r.notes_total) - published),
  };
}

function mapAssignment(r: AssignmentRow): Assignment {
  let urls: string[] = [];
  try {
    const parsed = JSON.parse(r.source_urls_json ?? "[]") as unknown;
    if (Array.isArray(parsed)) urls = parsed.filter((u): u is string => typeof u === "string");
  } catch {
    urls = [];
  }
  return {
    id: r.id,
    sponsorId: r.sponsor_id,
    position: Number(r.position),
    titleIdea: r.title_idea,
    brief: r.brief,
    sectionId: (r.section_id as SectionId | null) ?? null,
    sourceUrls: urls,
    scheduledFor: r.scheduled_for,
    status: r.status as AssignmentStatus,
    articleId: r.article_id,
    runId: r.run_id,
    error: r.error,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    publishedAt: r.published_at,
  };
}

const SPONSOR_SELECT = `SELECT s.*,
  (SELECT COUNT(*) FROM assignments a WHERE a.sponsor_id = s.id AND a.status = 'queued') AS queued,
  (SELECT COUNT(*) FROM assignments a WHERE a.sponsor_id = s.id AND a.status = 'published') AS published,
  (SELECT COUNT(*) FROM assignments a WHERE a.sponsor_id = s.id AND a.status IN ('review', 'working')) AS in_review
  FROM sponsors s`;

export async function listSponsors(db: D1Database): Promise<SponsorWithCounts[]> {
  const { results } = await db
    .prepare(
      `${SPONSOR_SELECT} ORDER BY CASE s.status WHEN 'active' THEN 0 ELSE 1 END, s.created_at DESC`,
    )
    .all<SponsorRow>();
  return results.map(mapSponsor);
}

export async function getSponsor(db: D1Database, id: string): Promise<SponsorWithCounts | null> {
  const row = await db.prepare(`${SPONSOR_SELECT} WHERE s.id = ?1`).bind(id).first<SponsorRow>();
  return row ? mapSponsor(row) : null;
}

export type SponsorInput = {
  name: string;
  website: string;
  contactName?: string | null;
  contactEmail?: string | null;
  brief?: string | null;
  sectionId?: SectionId | null;
  notesTotal: number;
  periodStart?: string | null;
  periodEnd?: string | null;
  status?: SponsorStatus;
  internalNotes?: string | null;
};

export async function createSponsor(db: D1Database, input: SponsorInput): Promise<string> {
  const id = crypto.randomUUID();
  await db
    .prepare(
      `INSERT INTO sponsors (id, name, website, contact_name, contact_email, brief, section_id, notes_total, period_start, period_end, status, internal_notes)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`,
    )
    .bind(
      id,
      input.name,
      input.website,
      input.contactName ?? null,
      input.contactEmail ?? null,
      input.brief ?? null,
      input.sectionId ?? null,
      input.notesTotal,
      input.periodStart ?? null,
      input.periodEnd ?? null,
      input.status ?? "active",
      input.internalNotes ?? null,
    )
    .run();
  return id;
}

export async function updateSponsor(
  db: D1Database,
  id: string,
  input: SponsorInput,
): Promise<void> {
  await db
    .prepare(
      `UPDATE sponsors SET name = ?2, website = ?3, contact_name = ?4, contact_email = ?5, brief = ?6, section_id = ?7, notes_total = ?8, period_start = ?9, period_end = ?10, status = ?11, internal_notes = ?12, updated_at = ${SQL_NOW} WHERE id = ?1`,
    )
    .bind(
      id,
      input.name,
      input.website,
      input.contactName ?? null,
      input.contactEmail ?? null,
      input.brief ?? null,
      input.sectionId ?? null,
      input.notesTotal,
      input.periodStart ?? null,
      input.periodEnd ?? null,
      input.status ?? "active",
      input.internalNotes ?? null,
    )
    .run();
}

export async function listAssignments(db: D1Database, sponsorId: string): Promise<Assignment[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM assignments WHERE sponsor_id = ?1 ORDER BY CASE status WHEN 'queued' THEN 0 WHEN 'working' THEN 1 WHEN 'review' THEN 2 WHEN 'error' THEN 3 ELSE 4 END, position ASC, created_at ASC`,
    )
    .bind(sponsorId)
    .all<AssignmentRow>();
  return results.map(mapAssignment);
}

export async function getAssignment(db: D1Database, id: string): Promise<Assignment | null> {
  const row = await db
    .prepare(`SELECT * FROM assignments WHERE id = ?1`)
    .bind(id)
    .first<AssignmentRow>();
  return row ? mapAssignment(row) : null;
}

export type AssignmentInput = {
  titleIdea: string;
  brief?: string | null;
  sectionId?: SectionId | null;
  sourceUrls?: string[];
  scheduledFor?: string | null;
};

/** Agrega ideas de titular a la cola del patrocinador (una fila por idea, en orden). */
export async function addAssignments(
  db: D1Database,
  sponsorId: string,
  items: readonly AssignmentInput[],
): Promise<string[]> {
  if (items.length === 0) return [];
  const row = await db
    .prepare(`SELECT COALESCE(MAX(position), 0) AS p FROM assignments WHERE sponsor_id = ?1`)
    .bind(sponsorId)
    .first<{ p: number }>();
  let position = Number(row?.p ?? 0);
  const ids: string[] = [];
  const stmts = items.map((it) => {
    const id = crypto.randomUUID();
    ids.push(id);
    position += 1;
    return db
      .prepare(
        `INSERT INTO assignments (id, sponsor_id, position, title_idea, brief, section_id, source_urls_json, scheduled_for, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'queued')`,
      )
      .bind(
        id,
        sponsorId,
        position,
        it.titleIdea,
        it.brief ?? null,
        it.sectionId ?? null,
        JSON.stringify(it.sourceUrls ?? []),
        it.scheduledFor ?? null,
      );
  });
  await db.batch(stmts);
  return ids;
}

export async function updateAssignment(
  db: D1Database,
  id: string,
  patch: Partial<AssignmentInput> & { status?: AssignmentStatus; position?: number },
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [id];
  const push = (col: string, val: unknown) => {
    params.push(val);
    sets.push(`${col} = ?${params.length}`);
  };
  if (patch.titleIdea !== undefined) push("title_idea", patch.titleIdea);
  if (patch.brief !== undefined) push("brief", patch.brief);
  if (patch.sectionId !== undefined) push("section_id", patch.sectionId);
  if (patch.sourceUrls !== undefined) push("source_urls_json", JSON.stringify(patch.sourceUrls));
  if (patch.scheduledFor !== undefined) push("scheduled_for", patch.scheduledFor);
  if (patch.status !== undefined) push("status", patch.status);
  if (patch.position !== undefined) push("position", patch.position);
  if (sets.length === 0) return;
  sets.push(`updated_at = ${SQL_NOW}`);
  await db
    .prepare(`UPDATE assignments SET ${sets.join(", ")} WHERE id = ?1`)
    .bind(...params)
    .run();
}

/** Sube o baja un encargo en la cola de su patrocinador. */
export async function moveAssignment(
  db: D1Database,
  id: string,
  dir: "up" | "down",
): Promise<void> {
  const me = await getAssignment(db, id);
  if (!me) return;
  const neighbor = await db
    .prepare(
      dir === "up"
        ? `SELECT id, position FROM assignments WHERE sponsor_id = ?1 AND status = 'queued' AND position < ?2 ORDER BY position DESC LIMIT 1`
        : `SELECT id, position FROM assignments WHERE sponsor_id = ?1 AND status = 'queued' AND position > ?2 ORDER BY position ASC LIMIT 1`,
    )
    .bind(me.sponsorId, me.position)
    .first<{ id: string; position: number }>();
  if (!neighbor) return;
  await db.batch([
    db.prepare(`UPDATE assignments SET position = ?2 WHERE id = ?1`).bind(me.id, neighbor.position),
    db.prepare(`UPDATE assignments SET position = ?2 WHERE id = ?1`).bind(neighbor.id, me.position),
  ]);
}

export type NextAssignment = Assignment & { sponsor: SponsorWithCounts };

/**
 * Ritmo de publicación de los patrocinadores. Publicar varias notas de la misma empresa el mismo día
 * es spam a ojos del lector y de Google: se guarda una separación mínima entre una y otra, y un tope
 * por semana. Los valores se pueden cambiar en `settings`.
 */
export const DEFAULT_SPONSOR_GAP_HOURS = 72; // una nota cada 3 días
export const DEFAULT_SPONSOR_MAX_PER_WEEK = 2;

export type SponsorPace = { gapHours: number; maxPerWeek: number };

export async function getSponsorPace(db: D1Database): Promise<SponsorPace> {
  const leer = async (key: string, porDefecto: number) => {
    try {
      const row = await db
        .prepare(`SELECT value FROM settings WHERE key = ?1`)
        .bind(key)
        .first<{ value: string }>();
      // OJO: si el ajuste no existe, `Number("")` da 0 y el freno quedaría desactivado. Solo se usa
      // el valor guardado cuando de verdad hay uno.
      const crudo = (row?.value ?? "").trim();
      if (crudo === "") return porDefecto;
      const n = Number(crudo);
      return Number.isFinite(n) && n >= 0 ? n : porDefecto;
    } catch {
      return porDefecto;
    }
  };
  return {
    gapHours: await leer("sponsor_min_gap_hours", DEFAULT_SPONSOR_GAP_HOURS),
    maxPerWeek: await leer("sponsor_max_per_week", DEFAULT_SPONSOR_MAX_PER_WEEK),
  };
}

/**
 * Siguiente encargo listo para salir: patrocinador activo y dentro de su periodo, con notas
 * restantes, encargo en cola cuya fecha (si la tiene) ya llegó, **y respetando el ritmo**: nada de
 * dos notas de la misma empresa seguidas. Orden: fecha pedida, posición.
 */
export async function nextQueuedAssignment(
  db: D1Database,
  now = new Date(),
): Promise<NextAssignment | null> {
  const iso = now.toISOString();
  const pace = await getSponsorPace(db);
  const desde = new Date(now.getTime() - pace.gapHours * 3_600_000).toISOString();
  const semana = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const { results } = await db
    .prepare(
      `SELECT a.* FROM assignments a
       JOIN sponsors s ON s.id = a.sponsor_id
       WHERE a.status = 'queued'
         AND s.status = 'active'
         AND (a.scheduled_for IS NULL OR a.scheduled_for <= ?1)
         AND (s.period_start IS NULL OR s.period_start <= ?1)
         AND (s.period_end IS NULL OR s.period_end >= substr(?1, 1, 10))
         AND s.notes_total > (SELECT COUNT(*) FROM assignments p WHERE p.sponsor_id = s.id AND p.status = 'published')
         AND NOT EXISTS (
           SELECT 1 FROM assignments r
           WHERE r.sponsor_id = s.id AND r.status = 'published' AND ${laterThan("r.published_at", "?2")}
         )
         AND (
           SELECT COUNT(*) FROM assignments w
           WHERE w.sponsor_id = s.id AND w.status = 'published' AND ${laterThan("w.published_at", "?3")}
         ) < ?4
       ORDER BY COALESCE(a.scheduled_for, '0000') ASC, a.position ASC, a.created_at ASC
       LIMIT 1`,
    )
    .bind(iso, desde, semana, pace.maxPerWeek)
    .all<AssignmentRow>();
  const row = results[0];
  if (!row) return null;
  const sponsor = await getSponsor(db, row.sponsor_id);
  if (!sponsor) return null;
  return { ...mapAssignment(row), sponsor };
}

/** Cuándo podrá salir la siguiente nota de este patrocinador (null = ya puede). */
export async function sponsorNextSlot(
  db: D1Database,
  sponsorId: string,
  now = new Date(),
): Promise<{ availableAt: string | null; publishedThisWeek: number; maxPerWeek: number }> {
  const pace = await getSponsorPace(db);
  const semana = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const row = await db
    .prepare(
      `SELECT (SELECT published_at FROM assignments u WHERE u.sponsor_id = ?1 AND u.status = 'published' AND u.published_at IS NOT NULL ORDER BY julianday(u.published_at) DESC LIMIT 1) AS ultima,
              (SELECT COUNT(*) FROM assignments w WHERE w.sponsor_id = ?1 AND w.status = 'published' AND ${laterThan("w.published_at", "?2")}) AS semana
       FROM assignments WHERE sponsor_id = ?1 AND status = 'published'`,
    )
    .bind(sponsorId, semana)
    .first<{ ultima: string | null; semana: number }>();
  const publishedThisWeek = Number(row?.semana ?? 0);
  if (publishedThisWeek >= pace.maxPerWeek) {
    return { availableAt: "semana", publishedThisWeek, maxPerWeek: pace.maxPerWeek };
  }
  const ultima = parseSqlDate(row?.ultima);
  if (!ultima) return { availableAt: null, publishedThisWeek, maxPerWeek: pace.maxPerWeek };
  const libre = new Date(ultima.getTime() + pace.gapHours * 3_600_000);
  return {
    availableAt: libre > now ? libre.toISOString() : null,
    publishedThisWeek,
    maxPerWeek: pace.maxPerWeek,
  };
}

export type JobKind = "sponsored" | "universal";

/**
 * Alternancia: si la última nota fue universal y hay un encargo listo, toca encargo; si la última
 * fue encargo, toca universal. Si solo hay de un tipo, sale ese. Devuelve null si no hay nada.
 */
export async function decideNextKind(
  db: D1Database,
  opts: { sponsoredAvailable: boolean; universalAvailable: boolean },
): Promise<JobKind | null> {
  const last = ((await getSetting(db, "robot_last_kind")) ?? "universal") as JobKind;
  if (opts.sponsoredAvailable && opts.universalAvailable) {
    return last === "sponsored" ? "universal" : "sponsored";
  }
  if (opts.sponsoredAvailable) return "sponsored";
  if (opts.universalAvailable) return "universal";
  return null;
}

export async function rememberLastKind(db: D1Database, kind: JobKind): Promise<void> {
  await setSetting(db, "robot_last_kind", kind);
}

export type QueueSummary = {
  sponsorsActive: number;
  queued: number;
  inReview: number;
  publishedTotal: number;
  nextTitle: string | null;
  nextSponsor: string | null;
};

export async function queueSummary(db: D1Database, now = new Date()): Promise<QueueSummary> {
  const [counts, next] = await Promise.all([
    db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM sponsors WHERE status = 'active') AS sponsors_active,
          (SELECT COUNT(*) FROM assignments WHERE status = 'queued') AS queued,
          (SELECT COUNT(*) FROM assignments WHERE status IN ('review', 'working')) AS in_review,
          (SELECT COUNT(*) FROM assignments WHERE status = 'published') AS published_total`,
      )
      .first<{
        sponsors_active: number;
        queued: number;
        in_review: number;
        published_total: number;
      }>(),
    nextQueuedAssignment(db, now),
  ]);
  return {
    sponsorsActive: Number(counts?.sponsors_active ?? 0),
    queued: Number(counts?.queued ?? 0),
    inReview: Number(counts?.in_review ?? 0),
    publishedTotal: Number(counts?.published_total ?? 0),
    nextTitle: next?.titleIdea ?? null,
    nextSponsor: next?.sponsor.name ?? null,
  };
}
