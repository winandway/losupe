import type { Lang } from "@/i18n/config";
import { isSectionId, type SectionId } from "./sections";
import { stripInlineBylines } from "./html";
import { nowIso } from "./dates";

export type ArticleCard = {
  id: string;
  sectionId: SectionId;
  authorId: string;
  authorName: string;
  lang: Lang;
  slug: string;
  title: string;
  excerpt: string;
  imageUrl: string | null;
  imageAlt: string;
  publishedAt: string;
  updatedAt: string;
  readingMinutes: number | null;
  kind: string;
  origin: string;
  aiAssisted: boolean;
  /** true cuando no existe traducción y se muestra la versión en español. */
  fallback: boolean;
};

export type ArticleSource = { title: string; url: string };

export type ArticleFull = ArticleCard & {
  contentHtml: string;
  metaTitle: string | null;
  metaDescription: string | null;
  tags: string[];
  sources: ArticleSource[];
  imageCredit: string | null;
  /** Pie de foto: lo que se lee debajo de la imagen. */
  imageCaption: string | null;
  machineTranslated: boolean;
  /** Slug por idioma de las traducciones disponibles. */
  translations: Partial<Record<Lang, string>>;
};

export type Author = {
  id: string;
  name: string;
  kind: "person" | "newsroom";
  bio: string | null;
  role: string | null;
  avatarUrl: string | null;
  /** En qué es experta esta persona. Google mira esto para decidir si la nota la firma alguien que sabe. */
  expertise: string | null;
  /** Perfiles públicos. Van al JSON-LD como `sameAs`: es como Google verifica que la persona existe. */
  links: { linkedin: string | null; x: string | null; email: string | null };
};

export type Paged<T> = { items: T[]; total: number; page: number; perPage: number; pages: number };

export const PER_PAGE = 12;

type CardRow = {
  id: string;
  section_id: string;
  author_id: string;
  author_name: string;
  image_url: string | null;
  image_alt_es: string | null;
  image_alt_en: string | null;
  published_at: string;
  updated_at: string;
  reading_minutes: number | null;
  kind: string;
  origin: string;
  ai_assisted: number;
  lang: string;
  slug: string;
  title: string;
  excerpt: string;
  fallback: number;
};

type FullRow = CardRow & {
  content_html: string;
  meta_title: string | null;
  meta_description: string | null;
  tags_json: string | null;
  sources_json: string | null;
  image_credit: string | null;
  image_caption_es: string | null;
  image_caption_en: string | null;
  machine_translated: number;
};

const CARD_COLUMNS = `
  a.id, a.section_id, a.author_id, au.name AS author_name,
  a.image_url, a.image_alt_es, a.image_alt_en, a.published_at, a.updated_at,
  a.reading_minutes, a.kind, a.origin, a.ai_assisted,
  COALESCE(t.lang, f.lang) AS lang,
  COALESCE(t.slug, f.slug) AS slug,
  COALESCE(t.title, f.title) AS title,
  COALESCE(t.excerpt, f.excerpt) AS excerpt,
  CASE WHEN t.article_id IS NULL THEN 1 ELSE 0 END AS fallback`;

const FULL_COLUMNS = `${CARD_COLUMNS},
  COALESCE(t.content_html, f.content_html) AS content_html,
  COALESCE(t.meta_title, f.meta_title) AS meta_title,
  COALESCE(t.meta_description, f.meta_description) AS meta_description,
  COALESCE(t.tags_json, f.tags_json) AS tags_json,
  a.sources_json, a.image_credit, a.image_caption_es, a.image_caption_en,
  COALESCE(t.machine_translated, f.machine_translated, 0) AS machine_translated`;

// ?1 = idioma pedido, ?2 = ahora (ISO). Siempre hay respaldo al español.
const FROM_PUBLISHED = `
  FROM articles a
  JOIN authors au ON au.id = a.author_id
  LEFT JOIN article_i18n t ON t.article_id = a.id AND t.lang = ?1
  LEFT JOIN article_i18n f ON f.article_id = a.id AND f.lang = 'es'
  WHERE a.status = 'published' AND a.published_at IS NOT NULL AND a.published_at <= ?2
    AND COALESCE(t.slug, f.slug) IS NOT NULL`;

export function parseJsonArray<T>(value: string | null | undefined): T[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function toSectionId(value: string): SectionId {
  return isSectionId(value) ? value : "economia";
}

export function mapCard(row: CardRow, requested: Lang): ArticleCard {
  const lang: Lang = row.lang === "en" ? "en" : "es";
  const alt = (requested === "en" ? row.image_alt_en : row.image_alt_es) ?? row.image_alt_es ?? "";
  return {
    id: row.id,
    sectionId: toSectionId(row.section_id),
    authorId: row.author_id,
    authorName: row.author_name,
    lang,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    imageUrl: row.image_url,
    imageAlt: alt || row.title,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    readingMinutes: row.reading_minutes,
    kind: row.kind,
    origin: row.origin,
    aiAssisted: row.ai_assisted === 1,
    fallback: row.fallback === 1,
  };
}

export function mapFull(
  row: FullRow,
  requested: Lang,
  translations: Partial<Record<Lang, string>>,
): ArticleFull {
  return {
    ...mapCard(row, requested),
    // Se limpian las firmas incrustadas al leer: así también quedan limpias las notas ya publicadas.
    contentHtml: stripInlineBylines(row.content_html),
    metaTitle: row.meta_title,
    metaDescription: row.meta_description,
    tags: parseJsonArray<string>(row.tags_json).filter((t) => typeof t === "string"),
    sources: parseJsonArray<ArticleSource>(row.sources_json).filter(
      (s) => s && typeof s.url === "string",
    ),
    imageCredit: row.image_credit,
    imageCaption:
      (requested === "en" ? row.image_caption_en : row.image_caption_es) ||
      row.image_caption_es ||
      null,
    machineTranslated: row.machine_translated === 1,
    translations,
  };
}

export function mapAuthor(
  row: {
    id: string;
    name: string;
    kind: string;
    bio_es: string | null;
    bio_en: string | null;
    role_es: string | null;
    role_en: string | null;
    avatar_url: string | null;
    expertise_es?: string | null;
    expertise_en?: string | null;
    linkedin_url?: string | null;
    x_url?: string | null;
    public_email?: string | null;
  },
  lang: Lang,
): Author {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind === "newsroom" ? "newsroom" : "person",
    bio: (lang === "en" ? row.bio_en : row.bio_es) ?? row.bio_es,
    role: (lang === "en" ? row.role_en : row.role_es) ?? row.role_es,
    avatarUrl: row.avatar_url,
    expertise: (lang === "en" ? row.expertise_en : row.expertise_es) ?? row.expertise_es ?? null,
    links: {
      linkedin: row.linkedin_url ?? null,
      x: row.x_url ?? null,
      email: row.public_email ?? null,
    },
  };
}

type ListFilters = { sectionId?: SectionId; authorId?: string };

/**
 * Agrega los filtros opcionales numerando los parámetros a continuación de los ya enlazados.
 * D1 exige que la cantidad de valores enlazados coincida exactamente con el mayor ?N de la consulta.
 */
function appendFilters(opts: ListFilters, params: unknown[]): string {
  const parts: string[] = [];
  if (opts.sectionId) {
    params.push(opts.sectionId);
    parts.push(`AND a.section_id = ?${params.length}`);
  }
  if (opts.authorId) {
    params.push(opts.authorId);
    parts.push(`AND a.author_id = ?${params.length}`);
  }
  return parts.join(" ");
}

export async function listLatest(
  db: D1Database,
  lang: Lang,
  opts: ListFilters & { limit?: number; offset?: number } = {},
): Promise<ArticleCard[]> {
  const params: unknown[] = [lang, nowIso()];
  const filters = appendFilters(opts, params);
  params.push(opts.limit ?? PER_PAGE);
  const limitIndex = params.length;
  params.push(opts.offset ?? 0);
  const offsetIndex = params.length;
  const { results } = await db
    .prepare(
      `SELECT ${CARD_COLUMNS} ${FROM_PUBLISHED} ${filters}
       ORDER BY a.published_at DESC LIMIT ?${limitIndex} OFFSET ?${offsetIndex}`,
    )
    .bind(...params)
    .all<CardRow>();
  return results.map((r) => mapCard(r, lang));
}

export async function countPublished(db: D1Database, opts: ListFilters = {}): Promise<number> {
  const params: unknown[] = [nowIso()];
  const filters = appendFilters(opts, params);
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM articles a
       WHERE a.status = 'published' AND a.published_at IS NOT NULL AND a.published_at <= ?1 ${filters}`,
    )
    .bind(...params)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

export async function listPaged(
  db: D1Database,
  lang: Lang,
  page: number,
  opts: ListFilters = {},
  perPage = PER_PAGE,
): Promise<Paged<ArticleCard>> {
  const safePage = Math.max(1, Math.floor(page));
  const [items, total] = await Promise.all([
    listLatest(db, lang, { ...opts, limit: perPage, offset: (safePage - 1) * perPage }),
    countPublished(db, opts),
  ]);
  return { items, total, page: safePage, perPage, pages: Math.max(1, Math.ceil(total / perPage)) };
}

/** Últimas N notas de cada sección en una sola consulta (función de ventana). */
export async function listLatestPerSection(
  db: D1Database,
  lang: Lang,
  perSection = 3,
): Promise<Record<SectionId, ArticleCard[]>> {
  const { results } = await db
    .prepare(
      `SELECT * FROM (
         SELECT ${CARD_COLUMNS},
           ROW_NUMBER() OVER (PARTITION BY a.section_id ORDER BY a.published_at DESC) AS rn
         ${FROM_PUBLISHED}
       ) WHERE rn <= ?3 ORDER BY section_id, published_at DESC`,
    )
    .bind(lang, nowIso(), perSection)
    .all<CardRow & { rn: number }>();
  const grouped = {
    economia: [],
    ventas: [],
    tecnologia: [],
    cripto: [],
    artistas: [],
  } as Record<SectionId, ArticleCard[]>;
  for (const row of results) {
    const card = mapCard(row, lang);
    grouped[card.sectionId].push(card);
  }
  return grouped;
}

export async function findArticleIdBySlug(
  db: D1Database,
  slug: string,
): Promise<{ articleId: string; lang: Lang } | null> {
  const row = await db
    .prepare(`SELECT article_id, lang FROM article_i18n WHERE slug = ?1 LIMIT 1`)
    .bind(slug)
    .first<{ article_id: string; lang: string }>();
  if (!row) return null;
  return { articleId: row.article_id, lang: row.lang === "en" ? "en" : "es" };
}

export async function getArticleById(
  db: D1Database,
  lang: Lang,
  articleId: string,
): Promise<ArticleFull | null> {
  const [row, tr] = await Promise.all([
    db
      .prepare(`SELECT ${FULL_COLUMNS} ${FROM_PUBLISHED} AND a.id = ?3 LIMIT 1`)
      .bind(lang, nowIso(), articleId)
      .first<FullRow>(),
    db
      .prepare(`SELECT lang, slug FROM article_i18n WHERE article_id = ?1`)
      .bind(articleId)
      .all<{ lang: string; slug: string }>(),
  ]);
  if (!row) return null;
  const translations: Partial<Record<Lang, string>> = {};
  for (const t of tr.results) {
    if (t.lang === "es" || t.lang === "en") translations[t.lang] = t.slug;
  }
  return mapFull(row, lang, translations);
}

export async function getArticleBySlug(
  db: D1Database,
  lang: Lang,
  slug: string,
): Promise<ArticleFull | null> {
  const found = await findArticleIdBySlug(db, slug);
  if (!found) return null;
  return getArticleById(db, lang, found.articleId);
}

export async function listRelated(
  db: D1Database,
  lang: Lang,
  sectionId: SectionId,
  excludeId: string,
  limit = 4,
): Promise<ArticleCard[]> {
  const { results } = await db
    .prepare(
      `SELECT ${CARD_COLUMNS} ${FROM_PUBLISHED} AND a.section_id = ?3 AND a.id <> ?4
       ORDER BY a.published_at DESC LIMIT ?5`,
    )
    .bind(lang, nowIso(), sectionId, excludeId, limit)
    .all<CardRow>();
  return results.map((r) => mapCard(r, lang));
}

export async function searchArticles(
  db: D1Database,
  lang: Lang,
  query: string,
  limit = 30,
): Promise<ArticleCard[]> {
  const like = `%${query.replace(/[%_]/g, " ").trim()}%`;
  const { results } = await db
    .prepare(
      `SELECT ${CARD_COLUMNS} ${FROM_PUBLISHED}
       AND EXISTS (
         SELECT 1 FROM article_i18n s
         WHERE s.article_id = a.id AND (s.title LIKE ?3 OR s.excerpt LIKE ?3)
       )
       ORDER BY a.published_at DESC LIMIT ?4`,
    )
    .bind(lang, nowIso(), like, limit)
    .all<CardRow>();
  return results.map((r) => mapCard(r, lang));
}

export async function getAuthor(db: D1Database, id: string, lang: Lang): Promise<Author | null> {
  const row = await db
    .prepare(
      `SELECT id, name, kind, bio_es, bio_en, role_es, role_en, avatar_url,
              expertise_es, expertise_en, linkedin_url, x_url, public_email
       FROM authors WHERE id = ?1 AND active = 1`,
    )
    .bind(id)
    .first<{
      id: string;
      name: string;
      kind: string;
      bio_es: string | null;
      bio_en: string | null;
      role_es: string | null;
      role_en: string | null;
      avatar_url: string | null;
      expertise_es: string | null;
      expertise_en: string | null;
      linkedin_url: string | null;
      x_url: string | null;
      public_email: string | null;
    }>();
  return row ? mapAuthor(row, lang) : null;
}

/** Equipo de redacción activo (personas con especialidad), para la página «Acerca». */
export async function listWriters(db: D1Database, lang: Lang): Promise<Author[]> {
  const { results } = await db
    .prepare(
      `SELECT id, name, kind, bio_es, bio_en, role_es, role_en, avatar_url,
              expertise_es, expertise_en, linkedin_url, x_url, public_email
       FROM authors
       WHERE active = 1 AND kind = 'person' AND sections_json IS NOT NULL AND sections_json != '[]'
       ORDER BY name`,
    )
    .all<{
      id: string;
      name: string;
      kind: string;
      bio_es: string | null;
      bio_en: string | null;
      role_es: string | null;
      role_en: string | null;
      avatar_url: string | null;
    }>();
  return results.map((r) => mapAuthor(r, lang));
}

export type SitemapRow = {
  id: string;
  section_id: string;
  lang: string;
  slug: string;
  published_at: string;
  updated_at: string;
  /** La imagen de la nota. Va al sitemap: sin eso, Google no indexa nuestras fotos. */
  image_url: string | null;
};

export async function listForSitemap(db: D1Database, limit = 5000): Promise<SitemapRow[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.section_id, t.lang, t.slug, a.published_at, a.updated_at, a.image_url
       FROM articles a JOIN article_i18n t ON t.article_id = a.id
       WHERE a.status = 'published' AND a.published_at IS NOT NULL AND a.published_at <= ?1
       ORDER BY a.published_at DESC LIMIT ?2`,
    )
    .bind(nowIso(), limit)
    .all<SitemapRow>();
  return results;
}

export type NewsSitemapRow = SitemapRow & { title: string };

export async function listRecentForNews(
  db: D1Database,
  sinceIso: string,
  limit = 1000,
): Promise<NewsSitemapRow[]> {
  const { results } = await db
    .prepare(
      `SELECT a.id, a.section_id, t.lang, t.slug, t.title, a.published_at, a.updated_at
       FROM articles a JOIN article_i18n t ON t.article_id = a.id
       WHERE a.status = 'published' AND a.published_at IS NOT NULL
         AND a.published_at <= ?1 AND a.published_at >= ?2
       ORDER BY a.published_at DESC LIMIT ?3`,
    )
    .bind(nowIso(), sinceIso, limit)
    .all<NewsSitemapRow>();
  return results;
}
