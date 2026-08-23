/**
 * Buscador: índice FTS5 en D1 (acentos indiferentes, prefijos, ranking bm25) + sinónimos ES/EN.
 * Si el índice no está disponible, cae a LIKE sobre título y bajada.
 */
import type { Lang } from "../i18n/config";
import { stripHtml } from "./html";
import { mapCard, PER_PAGE, type ArticleCard } from "./queries";
import { nowIso } from "./dates";
import { normalizeTerm, synonymsFor } from "./search-synonyms";

export const FTS_TABLE = "articles_fts";
const MAX_QUERY = 80;

export function normalizeQuery(q: string): string {
  return normalizeTerm(q).slice(0, MAX_QUERY).trim();
}

/** Tokens del usuario, cada uno con sus sinónimos. */
export function expandQuery(q: string): string[][] {
  const clean = normalizeQuery(q);
  if (!clean) return [];
  const tokens = clean.split(" ").filter((t) => t.length > 0);
  // Frases del diccionario de dos o tres palabras (p. ej. "inteligencia artificial").
  const groups: string[][] = [];
  for (let i = 0; i < tokens.length; i++) {
    const three = tokens.slice(i, i + 3).join(" ");
    const two = tokens.slice(i, i + 2).join(" ");
    if (tokens.length - i >= 3 && synonymsFor(three).length > 1) {
      groups.push(synonymsFor(three));
      i += 2;
    } else if (tokens.length - i >= 2 && synonymsFor(two).length > 1) {
      groups.push(synonymsFor(two));
      i += 1;
    } else {
      groups.push(synonymsFor(tokens[i] as string));
    }
  }
  return groups;
}

function ftsTerm(term: string, prefix: boolean): string {
  const safe = term.replace(/"/g, "").trim();
  if (!safe) return "";
  const quoted = `"${safe}"`;
  return prefix ? `${quoted}*` : quoted;
}

/** Expresión MATCH de FTS5: (tok OR sin1 OR sin2) AND (...). El último token busca por prefijo. */
export function buildFtsMatch(q: string, prefixAll = false): string {
  const groups = expandQuery(q);
  if (groups.length === 0) return "";
  return groups
    .map((group, idx) => {
      const last = idx === groups.length - 1;
      const alternatives = group
        .map((t) => ftsTerm(t, prefixAll || last))
        .filter((t) => t.length > 0);
      return alternatives.length === 1
        ? (alternatives[0] as string)
        : `(${alternatives.join(" OR ")})`;
    })
    .join(" AND ");
}

const CARD_COLUMNS = `
  a.id, a.section_id, a.author_id, au.name AS author_name,
  a.image_url, a.image_alt_es, a.image_alt_en, a.published_at, a.updated_at,
  a.reading_minutes, a.kind, a.origin, a.ai_assisted,
  COALESCE(t.lang, f.lang) AS lang,
  COALESCE(t.slug, f.slug) AS slug,
  COALESCE(t.title, f.title) AS title,
  COALESCE(t.excerpt, f.excerpt) AS excerpt,
  CASE WHEN t.article_id IS NULL THEN 1 ELSE 0 END AS fallback`;

type CardRow = Parameters<typeof mapCard>[0];

/** Carga tarjetas por id conservando el orden pedido. */
export async function listByIds(db: D1Database, lang: Lang, ids: string[]): Promise<ArticleCard[]> {
  if (ids.length === 0) return [];
  const limited = ids.slice(0, 90);
  const placeholders = limited.map((_, i) => `?${i + 3}`).join(", ");
  const { results } = await db
    .prepare(
      `SELECT ${CARD_COLUMNS}
       FROM articles a
       JOIN authors au ON au.id = a.author_id
       LEFT JOIN article_i18n t ON t.article_id = a.id AND t.lang = ?1
       LEFT JOIN article_i18n f ON f.article_id = a.id AND f.lang = 'es'
       WHERE a.status = 'published' AND a.published_at IS NOT NULL AND a.published_at <= ?2
         AND a.id IN (${placeholders})`,
    )
    .bind(lang, nowIso(), ...limited)
    .all<CardRow>();
  const byId = new Map(results.map((r) => [r.id, mapCard(r, lang)]));
  return limited.map((id) => byId.get(id)).filter((c): c is ArticleCard => Boolean(c));
}

/** Ids ordenados por relevancia desde el índice FTS (lanza si el índice no existe). */
export async function ftsSearchIds(
  db: D1Database,
  lang: Lang,
  match: string,
  limit: number,
): Promise<string[]> {
  const { results } = await db
    .prepare(
      `SELECT article_id, bm25(${FTS_TABLE}, 0, 0, 10, 5, 3, 1) AS score
       FROM ${FTS_TABLE}
       WHERE ${FTS_TABLE} MATCH ?1 AND lang IN (?2, 'es')
       ORDER BY score LIMIT ?3`,
    )
    .bind(match, lang, limit * 2)
    .all<{ article_id: string; score: number }>();
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const r of results) {
    if (!seen.has(r.article_id)) {
      seen.add(r.article_id);
      ids.push(r.article_id);
    }
    if (ids.length >= limit) break;
  }
  return ids;
}

/** Respaldo sin índice: LIKE sobre título y bajada con los sinónimos. */
export async function likeSearch(
  db: D1Database,
  lang: Lang,
  q: string,
  limit: number,
): Promise<ArticleCard[]> {
  const groups = expandQuery(q);
  if (groups.length === 0) return [];
  const params: unknown[] = [lang, nowIso()];
  const clauses = groups.map((group) => {
    const ors = group.map((term) => {
      params.push(`%${term}%`);
      const n = params.length;
      return `(s.title LIKE ?${n} OR s.excerpt LIKE ?${n})`;
    });
    return `(${ors.join(" OR ")})`;
  });
  params.push(limit);
  const { results } = await db
    .prepare(
      `SELECT ${CARD_COLUMNS}
       FROM articles a
       JOIN authors au ON au.id = a.author_id
       LEFT JOIN article_i18n t ON t.article_id = a.id AND t.lang = ?1
       LEFT JOIN article_i18n f ON f.article_id = a.id AND f.lang = 'es'
       WHERE a.status = 'published' AND a.published_at IS NOT NULL AND a.published_at <= ?2
         AND EXISTS (SELECT 1 FROM article_i18n s WHERE s.article_id = a.id AND ${clauses.join(" AND ")})
       ORDER BY a.published_at DESC LIMIT ?${params.length}`,
    )
    .bind(...params)
    .all<CardRow>();
  return results.map((r) => mapCard(r, lang));
}

export type SearchOptions = { limit?: number; prefixAll?: boolean };

/** Búsqueda completa: FTS + sinónimos, con respaldo LIKE si el índice falla. */
export async function searchSmart(
  db: D1Database,
  lang: Lang,
  q: string,
  opts: SearchOptions = {},
): Promise<ArticleCard[]> {
  const limit = opts.limit ?? 30;
  const match = buildFtsMatch(q, opts.prefixAll);
  if (!match) return [];
  try {
    const ids = await ftsSearchIds(db, lang, match, limit);
    return await listByIds(db, lang, ids);
  } catch {
    return likeSearch(db, lang, q, limit);
  }
}

/** Sugerencias mientras se escribe: todo por prefijo, pocas y rápidas. */
export async function suggest(
  db: D1Database,
  lang: Lang,
  q: string,
  limit = 8,
): Promise<ArticleCard[]> {
  return searchSmart(db, lang, q, { limit, prefixAll: true });
}

/** Reconstruye el índice completo desde article_i18n (pocas filas hoy; el robot indexa de a una). */
export async function rebuildSearchIndex(db: D1Database): Promise<number> {
  const { results } = await db
    .prepare(
      `SELECT i.article_id, i.lang, i.title, i.excerpt, i.tags_json, i.content_html
       FROM article_i18n i JOIN articles a ON a.id = i.article_id
       WHERE a.status = 'published'`,
    )
    .all<{
      article_id: string;
      lang: string;
      title: string;
      excerpt: string;
      tags_json: string | null;
      content_html: string;
    }>();
  await db.prepare(`DELETE FROM ${FTS_TABLE}`).run();
  const stmts = results.map((r) =>
    db
      .prepare(
        `INSERT INTO ${FTS_TABLE} (article_id, lang, title, excerpt, tags, body) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(
        r.article_id,
        r.lang,
        r.title,
        r.excerpt ?? "",
        tagsText(r.tags_json),
        stripHtml(r.content_html).slice(0, 20_000),
      ),
  );
  for (let i = 0; i < stmts.length; i += 20) await db.batch(stmts.slice(i, i + 20));
  return stmts.length;
}

/** Índice de una sola nota (para el robot y el panel). */
export async function indexArticle(db: D1Database, articleId: string): Promise<void> {
  const { results } = await db
    .prepare(
      `SELECT article_id, lang, title, excerpt, tags_json, content_html FROM article_i18n WHERE article_id = ?1`,
    )
    .bind(articleId)
    .all<{
      article_id: string;
      lang: string;
      title: string;
      excerpt: string;
      tags_json: string | null;
      content_html: string;
    }>();
  await db.prepare(`DELETE FROM ${FTS_TABLE} WHERE article_id = ?1`).bind(articleId).run();
  if (results.length === 0) return;
  await db.batch(
    results.map((r) =>
      db
        .prepare(
          `INSERT INTO ${FTS_TABLE} (article_id, lang, title, excerpt, tags, body) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
        )
        .bind(
          r.article_id,
          r.lang,
          r.title,
          r.excerpt ?? "",
          tagsText(r.tags_json),
          stripHtml(r.content_html).slice(0, 20_000),
        ),
    ),
  );
}

function tagsText(json: string | null): string {
  if (!json) return "";
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map(String).join(" ") : "";
  } catch {
    return "";
  }
}

/** ¿El índice tiene filas? (para reconstruirlo una vez si quedó vacío). */
export async function searchIndexCount(db: D1Database): Promise<number> {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${FTS_TABLE}`).first<{ n: number }>();
  return row?.n ?? 0;
}

/** Memoriza por instancia: si el índice está vacío pero hay notas, lo reconstruye una vez. */
export function createSearchIndexGuard() {
  let checked = false;
  let pending: Promise<void> | null = null;
  return {
    async ensure(db: D1Database): Promise<void> {
      if (checked) return;
      if (!pending) {
        pending = (async () => {
          try {
            if ((await searchIndexCount(db)) === 0) await rebuildSearchIndex(db);
          } catch {
            /* el índice no existe todavía: el buscador cae a LIKE */
          } finally {
            checked = true;
            pending = null;
          }
        })();
      }
      return pending;
    },
    reset() {
      checked = false;
    },
  };
}

export { PER_PAGE };
