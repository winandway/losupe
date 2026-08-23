import type { Lang } from "@/i18n/config";
import type { ArticleFull } from "./queries";
import { getSection } from "./sections";
import { absoluteUrl, articlePath, authorPath, homePath, sectionPath } from "./urls";

/** JSON.stringify seguro para incrustar en <script type="application/ld+json">. */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function organizationJsonLd(base: string, name: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    name,
    url: base,
    logo: absoluteUrl(base, "/brand/logo-512.png"),
    description,
  };
}

export function websiteJsonLd(base: string, lang: Lang, name: string, searchPath: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url: absoluteUrl(base, homePath(lang)),
    inLanguage: lang,
    potentialAction: {
      "@type": "SearchAction",
      target: `${absoluteUrl(base, searchPath)}?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

export function articleJsonLd(base: string, lang: Lang, article: ArticleFull, brand: string) {
  const url = absoluteUrl(base, articlePath(lang, article.sectionId, article.slug));
  const section = getSection(article.sectionId);
  return {
    "@context": "https://schema.org",
    "@type": article.kind === "news" ? "NewsArticle" : "Article",
    headline: article.title,
    description: article.metaDescription ?? article.excerpt,
    image: article.imageUrl ? [absoluteUrl(base, article.imageUrl)] : undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: article.lang,
    articleSection: section?.name[lang],
    keywords: article.tags.length ? article.tags.join(", ") : undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: {
      "@type": "Person",
      name: article.authorName,
      url: absoluteUrl(base, authorPath(lang, article.authorId)),
    },
    publisher: {
      "@type": "Organization",
      name: brand,
      logo: { "@type": "ImageObject", url: absoluteUrl(base, "/brand/logo-512.png") },
    },
    isAccessibleForFree: true,
  };
}

export function breadcrumbJsonLd(
  base: string,
  lang: Lang,
  items: { name: string; path: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(base, item.path),
    })),
  };
}

/** Rutas alternativas (hreflang) de una sección. */
export function sectionAlternates(sectionId: ArticleFull["sectionId"]) {
  return {
    es: sectionPath("es", sectionId),
    en: sectionPath("en", sectionId),
    "x-default": sectionPath("es", sectionId),
  };
}
