import { stripHtml } from "@/lib/html";
import { indexArticle } from "@/lib/search";
import type { SectionId } from "@/lib/sections";
import { slugify } from "@/lib/slug";
import { articlePath } from "@/lib/urls";
import type { Draft } from "./writer";

/**
 * Guardar una nota del robot en la base: artículo + dos idiomas + índice de búsqueda.
 * `status` = "published" (sale de una) o "review" (espera aprobación en el panel).
 */

export type PublishInput = {
  draft: Draft;
  sectionId: SectionId;
  authorId: string;
  origin: "robot" | "sponsored";
  status: "published" | "review";
  sources: { title: string; url: string }[];
  image: { url: string; credit: string | null } | null;
  runId?: string;
  now?: Date;
};

export type PublishResult = {
  articleId: string;
  slugEs: string;
  slugEn: string;
  pathEs: string;
  pathEn: string;
  status: "published" | "review";
};

export function wordCount(html: string): number {
  return stripHtml(html).split(/\s+/).filter(Boolean).length;
}

/** Slug único por idioma: si ya existe, agrega -2, -3… */
export async function uniqueSlug(db: D1Database, lang: "es" | "en", base: string): Promise<string> {
  const root = slugify(base) || `nota-${Date.now()}`;
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const row = await db
      .prepare(`SELECT 1 AS x FROM article_i18n WHERE lang = ?1 AND slug = ?2 LIMIT 1`)
      .bind(lang, candidate)
      .first();
    if (!row) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export async function saveArticle(db: D1Database, input: PublishInput): Promise<PublishResult> {
  const now = (input.now ?? new Date()).toISOString();
  const id = crypto.randomUUID();
  const slugEs = await uniqueSlug(db, "es", input.draft.es.title);
  const slugEn = await uniqueSlug(db, "en", input.draft.en.title);
  const minutes = Math.max(1, Math.round(wordCount(input.draft.es.content_html) / 200));
  const publishedAt = input.status === "published" ? now : null;

  await db.batch([
    db
      .prepare(
        `INSERT INTO articles (id, section_id, author_id, status, kind, origin, image_url, image_alt_es, image_alt_en, image_credit, sources_json, ai_assisted, reading_minutes, published_at, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 1, ?12, ?13, ?14, ?14)`,
      )
      .bind(
        id,
        input.sectionId,
        input.authorId,
        input.status,
        input.draft.kind,
        input.origin,
        input.image?.url ?? null,
        input.draft.image_alt_es,
        input.draft.image_alt_en,
        input.image?.credit ?? null,
        JSON.stringify(input.sources),
        minutes,
        publishedAt,
        now,
      ),
    ...(["es", "en"] as const).map((lang) =>
      db
        .prepare(
          `INSERT INTO article_i18n (article_id, lang, slug, title, excerpt, content_html, meta_title, meta_description, tags_json, machine_translated)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 0)`,
        )
        .bind(
          id,
          lang,
          lang === "es" ? slugEs : slugEn,
          input.draft[lang].title,
          input.draft[lang].excerpt,
          input.draft[lang].content_html,
          input.draft[lang].meta_title,
          input.draft[lang].meta_description,
          JSON.stringify(input.draft[lang].tags),
        ),
    ),
  ]);
  await indexArticle(db, id).catch(() => undefined);
  return {
    articleId: id,
    slugEs,
    slugEn,
    pathEs: articlePath("es", input.sectionId, slugEs),
    pathEn: articlePath("en", input.sectionId, slugEn),
    status: input.status,
  };
}

/** Publica (o despublica) una nota ya guardada. */
export async function setArticleStatus(
  db: D1Database,
  articleId: string,
  status: "published" | "review" | "draft" | "archived",
  now = new Date(),
): Promise<void> {
  const iso = now.toISOString();
  await db
    .prepare(
      `UPDATE articles SET status = ?2, published_at = CASE WHEN ?2 = 'published' THEN COALESCE(published_at, ?3) ELSE published_at END, updated_at = ?3 WHERE id = ?1`,
    )
    .bind(articleId, status, iso)
    .run();
}

export type SponsorTag = { id: string; name: string; website: string };

/** Si la nota salió de un encargo, devuelve el patrocinador (para la etiqueta «Contenido patrocinado»). */
export async function getSponsorForArticle(
  db: D1Database,
  articleId: string,
): Promise<SponsorTag | null> {
  const row = await db
    .prepare(
      `SELECT s.id, s.name, s.website FROM assignments a JOIN sponsors s ON s.id = a.sponsor_id WHERE a.article_id = ?1 LIMIT 1`,
    )
    .bind(articleId)
    .first<SponsorTag>();
  return row ?? null;
}
