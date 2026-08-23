/**
 * Versión Markdown de las páginas para agentes (Accept: text/markdown). Corre en el worker,
 * con acceso directo a D1, antes de Next.
 */
import { isLang, type Lang } from "../i18n/config";
import { articleToMarkdown, listToMarkdown } from "./markdown";
import { getArticleBySlug, listLatest, searchArticles, type ArticleCard } from "./queries";
import { getSection, sectionByAnySlug } from "./sections";
import { absoluteUrl, articlePath, ROUTE_WORDS } from "./urls";

const BRAND = {
  es: "losupe — Lo que pasa, explicado.",
  en: "losupe — What's happening, explained.",
};
const INTRO = {
  es: "Noticias y guías de economía, ventas, tecnología e IA, cripto y tendencias, explicadas en claro cada mañana.",
  en: "News and guides on the economy, sales, tech and AI, crypto, and trends, explained clearly every morning.",
};

/** true si el cliente prefiere Markdown (Accept: text/markdown antes que text/html). */
export function wantsMarkdown(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  if (!/text\/markdown/i.test(accept)) return false;
  const types = accept.split(",").map((part) => {
    const [type, ...params] = part.trim().split(";");
    const qParam = params.find((p) => p.trim().startsWith("q="));
    const q = qParam ? Number(qParam.trim().slice(2)) : 1;
    return { type: (type ?? "").trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 };
  });
  const md = types.find((t) => t.type === "text/markdown")?.q ?? 0;
  const html = types.find((t) => t.type === "text/html")?.q ?? 0;
  return md > 0 && md >= html;
}

function cardsToItems(base: string, lang: Lang, cards: ArticleCard[]) {
  return cards.map((a) => ({
    title: a.title,
    url: absoluteUrl(base, articlePath(lang, a.sectionId, a.slug)),
    excerpt: a.excerpt,
    date: a.publishedAt,
  }));
}

/** Devuelve el Markdown de la ruta, o null si la ruta no tiene versión Markdown. */
export async function renderMarkdown(
  db: D1Database,
  base: string,
  pathname: string,
  searchParams?: URLSearchParams,
): Promise<string | null> {
  const segments = pathname.split("/").filter(Boolean);
  const [first, second, third] = segments;
  if (!first || !isLang(first)) return null;
  const lang: Lang = first;

  if (segments.length === 1) {
    const latest = await listLatest(db, lang, { limit: 30 });
    return listToMarkdown(BRAND[lang], INTRO[lang], cardsToItems(base, lang, latest));
  }

  if (segments.length === 2 && second === ROUTE_WORDS.search[lang]) {
    const q = (searchParams?.get("q") ?? "").trim();
    if (q.length < 2)
      return listToMarkdown(
        `${lang === "es" ? "Buscar" : "Search"} · losupe`,
        lang === "es"
          ? "Usa ?q=término (mínimo 2 letras)."
          : "Use ?q=term (at least 2 characters).",
        [],
      );
    const results = await searchArticles(db, lang, q.slice(0, 80));
    return listToMarkdown(
      `${lang === "es" ? "Resultados para" : "Results for"} “${q}” · losupe`,
      `${results.length} ${lang === "es" ? "resultados" : "results"}`,
      cardsToItems(base, lang, results),
    );
  }

  const sectionMatch = second ? sectionByAnySlug(second) : undefined;
  if (segments.length === 2 && sectionMatch) {
    const s = sectionMatch.section;
    const items = await listLatest(db, lang, { limit: 50, sectionId: s.id });
    return listToMarkdown(
      `${s.name[lang]} · losupe`,
      s.description[lang],
      cardsToItems(base, lang, items),
    );
  }

  if (segments.length === 3 && sectionMatch && third) {
    const article = await getArticleBySlug(db, lang, decodeURIComponent(third));
    if (!article) return null;
    const section = getSection(article.sectionId);
    return articleToMarkdown({
      title: article.title,
      excerpt: article.excerpt,
      contentHtml: article.contentHtml,
      authorName: article.authorName,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
      sectionName: section?.name[lang] ?? article.sectionId,
      url: absoluteUrl(base, articlePath(lang, article.sectionId, article.slug)),
      imageUrl: article.imageUrl ? absoluteUrl(base, article.imageUrl) : null,
      sources: article.sources,
      tags: article.tags,
      aiAssisted: article.aiAssisted,
      lang,
    });
  }

  return null;
}
