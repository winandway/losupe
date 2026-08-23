import { decodeEntities, stripHtml } from "@/lib/html";
import { SECTIONS, type SectionId } from "@/lib/sections";
import { BOT_USER_AGENT, fetchPage } from "./research";
import type { SourceDoc } from "./writer";

/**
 * Notas universales: el robot lee las fuentes (RSS) de cada sección, guarda candidatos y elige el
 * mejor tema pendiente respetando el cupo diario de cada sección.
 */

export type FeedItem = {
  title: string;
  url: string;
  summary: string;
  publishedAt: string | null;
};

function unwrapCdata(text: string): string {
  return text.replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1");
}

/** Contenido de la primera etiqueta `<tag>` de un bloque (sin RegExp dinámico: búsqueda por índice). */
function pickTag(xml: string, tag: string): string {
  const lower = xml.toLowerCase();
  const open = `<${tag.toLowerCase()}`;
  let from = 0;
  while (from < lower.length) {
    const i = lower.indexOf(open, from);
    if (i < 0) return "";
    const after = lower.charAt(i + open.length);
    if (after !== ">" && after !== " " && after !== "\n" && after !== "\t" && after !== "/") {
      from = i + open.length;
      continue;
    }
    const gt = lower.indexOf(">", i);
    if (gt < 0) return "";
    if (lower.charAt(gt - 1) === "/") return ""; // <tag/> vacío
    const close = lower.indexOf(`</${tag.toLowerCase()}`, gt + 1);
    if (close < 0) return "";
    return decodeEntities(unwrapCdata(xml.slice(gt + 1, close))).trim();
  }
  return "";
}

/** Deshace los enlaces de rastreo de Bing News (…apiclick.aspx?url=https%3A%2F%2F…). */
export function unwrapTrackingUrl(url: string): string {
  try {
    const u = new URL(url);
    if (/bing\.com$/i.test(u.hostname) && u.searchParams.get("url")) {
      return new URL(u.searchParams.get("url")!).toString();
    }
    return u.toString();
  } catch {
    return url;
  }
}

/** Parser mínimo de RSS 2.0 y Atom (suficiente para medios y Bing News). */
export function parseFeed(xml: string, limit = 30): FeedItem[] {
  const items: FeedItem[] = [];
  const blocks = [
    ...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi),
    ...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi),
  ];
  for (const b of blocks) {
    const body = b[0].replace(/^<[^>]*>/, "").replace(/<\/(?:item|entry)>$/i, "");
    const title = stripHtml(pickTag(body, "title"));
    let url = pickTag(body, "link");
    if (!url) {
      const href = body.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1];
      if (href) url = decodeEntities(href);
    }
    const summary = stripHtml(
      pickTag(body, "description") || pickTag(body, "summary") || pickTag(body, "content"),
    ).slice(0, 600);
    const date =
      pickTag(body, "pubDate") || pickTag(body, "published") || pickTag(body, "updated") || "";
    const publishedAt =
      date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : null;
    if (!title || !url || !/^https?:\/\//i.test(url)) continue;
    items.push({ title, url: unwrapTrackingUrl(url), summary, publishedAt });
    if (items.length >= limit) break;
  }
  return items;
}

export type SourceRow = {
  id: string;
  section_id: string;
  name: string;
  url: string;
  kind: string;
  lang: string;
  weight: number;
  active: number;
};

export type DiscoverResult = { fetched: number; added: number; errors: string[] };

/** Lee todas las fuentes activas y guarda candidatos nuevos (sin repetir URL). */
export async function discoverCandidates(
  db: D1Database,
  opts: { fetchImpl?: typeof fetch; now?: Date; maxAgeDays?: number } = {},
): Promise<DiscoverResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? new Date();
  const minDate = new Date(now.getTime() - (opts.maxAgeDays ?? 3) * 86_400_000).toISOString();
  const { results: sources } = await db
    .prepare(`SELECT * FROM sources WHERE active = 1 AND kind = 'rss'`)
    .all<SourceRow>();
  let fetched = 0;
  let added = 0;
  const errors: string[] = [];
  for (const s of sources) {
    try {
      const res = await fetchImpl(s.url, {
        headers: {
          "User-Agent": BOT_USER_AGENT,
          Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) throw new Error(`respondió ${res.status}`);
      const items = parseFeed(await res.text());
      fetched += 1;
      const stmts = items
        .filter((it) => !it.publishedAt || it.publishedAt >= minDate)
        .map((it, i) => {
          const ageHours = it.publishedAt
            ? Math.max(0, (now.getTime() - Date.parse(it.publishedAt)) / 3_600_000)
            : 48;
          const score = Number(s.weight) * 10 - ageHours / 6 - i * 0.2;
          return db
            .prepare(
              `INSERT OR IGNORE INTO candidates (id, source_id, section_id, url, title, summary, lang, published_at, score) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
            )
            .bind(
              crypto.randomUUID(),
              s.id,
              s.section_id,
              it.url,
              it.title.slice(0, 300),
              it.summary,
              s.lang,
              it.publishedAt,
              score,
            );
        });
      if (stmts.length > 0) {
        const results = await db.batch(stmts);
        added += results.filter((r) => (r.meta?.changes ?? 0) > 0).length;
      }
      await db
        .prepare(`UPDATE sources SET last_ok_at = ?2, last_error = NULL WHERE id = ?1`)
        .bind(s.id, now.toISOString())
        .run();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${s.name}: ${msg}`);
      await db
        .prepare(`UPDATE sources SET last_error = ?2 WHERE id = ?1`)
        .bind(s.id, msg.slice(0, 300))
        .run();
    }
  }
  return { fetched, added, errors };
}

export type Candidate = {
  id: string;
  sectionId: SectionId;
  url: string;
  title: string;
  summary: string | null;
  lang: "es" | "en";
  publishedAt: string | null;
  score: number;
};

type CandidateRow = {
  id: string;
  section_id: string;
  url: string;
  title: string;
  summary: string | null;
  lang: string;
  published_at: string | null;
  score: number;
};

/** Notas del robot publicadas hoy por sección (para respetar el cupo). */
export async function robotNotesToday(
  db: D1Database,
  now = new Date(),
): Promise<Record<string, number>> {
  const day = now.toISOString().slice(0, 10);
  const { results } = await db
    .prepare(
      `SELECT section_id, COUNT(*) AS n FROM articles WHERE origin IN ('robot', 'sponsored') AND substr(created_at, 1, 10) = ?1 GROUP BY section_id`,
    )
    .bind(day)
    .all<{ section_id: string; n: number }>();
  const out: Record<string, number> = {};
  for (const r of results) out[r.section_id] = Number(r.n);
  return out;
}

/**
 * Elige el mejor candidato nuevo: primero la sección con más cupo libre hoy (cupo = notes_per_day
 * de `sections`), y dentro de ella el de mayor puntaje.
 */
export async function pickCandidate(db: D1Database, now = new Date()): Promise<Candidate | null> {
  const [{ results: quotas }, today] = await Promise.all([
    db
      .prepare(`SELECT id, notes_per_day FROM sections WHERE active = 1 ORDER BY sort_order`)
      .all<{ id: string; notes_per_day: number }>(),
    robotNotesToday(db, now),
  ]);
  const order = [...quotas]
    .map((q) => ({ id: q.id, free: Number(q.notes_per_day) - (today[q.id] ?? 0) }))
    .sort((a, b) => b.free - a.free);
  for (const sec of order) {
    if (sec.free <= 0) continue;
    const row = await db
      .prepare(
        `SELECT id, section_id, url, title, summary, lang, published_at, score FROM candidates WHERE status = 'new' AND section_id = ?1 ORDER BY score DESC, published_at DESC LIMIT 1`,
      )
      .bind(sec.id)
      .first<CandidateRow>();
    if (row) {
      return {
        id: row.id,
        sectionId: row.section_id as SectionId,
        url: row.url,
        title: row.title,
        summary: row.summary,
        lang: row.lang === "en" ? "en" : "es",
        publishedAt: row.published_at,
        score: Number(row.score),
      };
    }
  }
  // Sin cupo libre en ninguna sección: no hay nota universal hoy.
  return null;
}

export async function markCandidate(
  db: D1Database,
  id: string,
  status: "used" | "skipped",
  articleId?: string,
): Promise<void> {
  await db
    .prepare(`UPDATE candidates SET status = ?2, article_id = ?3 WHERE id = ?1`)
    .bind(id, status, articleId ?? null)
    .run();
}

/** Descarga el texto de la fuente principal (y hasta 2 candidatos hermanos del mismo tema). */
export async function gatherSources(
  db: D1Database,
  candidate: Candidate,
  fetchImpl: typeof fetch = fetch,
): Promise<SourceDoc[]> {
  const docs: SourceDoc[] = [];
  const main = await fetchPage(candidate.url, { fetchImpl, maxChars: 10_000 });
  if (main && main.text.length > 400)
    docs.push({ title: main.title || candidate.title, url: main.url, text: main.text });
  // Hermanos: candidatos de la misma sección con palabras clave del título en común.
  const keywords = candidate.title
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 4)
    .slice(0, 4);
  if (keywords.length > 0) {
    const like = keywords.map((_, i) => `LOWER(title) LIKE ?${i + 3}`).join(" OR ");
    const { results } = await db
      .prepare(
        `SELECT url, title FROM candidates WHERE section_id = ?1 AND id != ?2 AND status = 'new' AND (${like}) ORDER BY score DESC LIMIT 2`,
      )
      .bind(candidate.sectionId, candidate.id, ...keywords.map((k) => `%${k}%`))
      .all<{ url: string; title: string }>();
    for (const r of results) {
      const page = await fetchPage(r.url, { fetchImpl, maxChars: 6_000 });
      if (page && page.text.length > 400)
        docs.push({ title: page.title || r.title, url: page.url, text: page.text });
    }
  }
  if (docs.length === 0 && candidate.summary) {
    docs.push({ title: candidate.title, url: candidate.url, text: candidate.summary });
  }
  return docs;
}

export function sectionIds(): SectionId[] {
  return SECTIONS.map((s) => s.id);
}
