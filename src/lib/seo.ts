import type { Lang } from "@/i18n/config";
import type { ArticleFull, Author } from "./queries";
import { stripHtml } from "./html";
import { getSection } from "./sections";
import { absoluteUrl, articlePath, authorPath, homePath, sectionPath, staticPath } from "./urls";

/** Palabras del cuerpo de la nota (Google lo usa como señal de profundidad). */
function countWords(html: string): number {
  return stripHtml(html).split(/\s+/).filter(Boolean).length;
}

/** JSON.stringify seguro para incrustar en <script type="application/ld+json">. */
export function safeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * Ficha del medio. Google News y las IA miran estas señales para decidir si somos una fuente seria:
 * quién publica, dónde, con qué política editorial y cómo se corrige un error.
 */
export function organizationJsonLd(
  base: string,
  name: string,
  description: string,
  lang: Lang = "es",
  extra: { sameAs?: string[]; email?: string } = {},
) {
  return {
    "@context": "https://schema.org",
    "@type": "NewsMediaOrganization",
    "@id": `${base}#organizacion`,
    name,
    alternateName: "losupe.com",
    url: base,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl(base, "/brand/logo-512.png"),
      width: 512,
      height: 512,
    },
    image: absoluteUrl(base, "/brand/og.png"),
    description,
    foundingDate: "2026",
    knowsLanguage: ["es", "en"],
    publishingPrinciples: absoluteUrl(base, staticPath("editorial", lang)),
    ethicsPolicy: absoluteUrl(base, staticPath("editorial", lang)),
    diversityPolicy: absoluteUrl(base, staticPath("editorial", lang)),
    correctionsPolicy: absoluteUrl(base, staticPath("editorial", lang)),
    ...(extra.email ? { email: extra.email } : {}),
    ...(extra.sameAs && extra.sameAs.length > 0 ? { sameAs: extra.sameAs } : {}),
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
  // Google recorta los titulares de más de 110 caracteres en `headline`.
  const headline = article.title.length > 110 ? `${article.title.slice(0, 107)}…` : article.title;
  return {
    "@context": "https://schema.org",
    "@type": article.kind === "news" ? "NewsArticle" : "Article",
    headline,
    description: article.metaDescription ?? article.excerpt,
    image: article.imageUrl ? [absoluteUrl(base, article.imageUrl)] : undefined,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: article.lang,
    articleSection: section?.name[lang],
    keywords: article.tags.length ? article.tags.join(", ") : undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    wordCount: countWords(article.contentHtml),
    timeRequired: article.readingMinutes ? `PT${article.readingMinutes}M` : undefined,
    author: {
      "@type": "Person",
      name: article.authorName,
      url: absoluteUrl(base, authorPath(lang, article.authorId)),
    },
    publisher: {
      "@type": "NewsMediaOrganization",
      "@id": `${base}#organizacion`,
      name: brand,
      url: base,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(base, "/brand/logo-512.png"),
        width: 512,
        height: 512,
      },
    },
    isAccessibleForFree: true,
    // Lo que un asistente de voz debe leer si le preguntan por esta nota.
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", ".prose > p:first-of-type"],
    },
    // De dónde salió la información (el robot cita sus fuentes).
    citation:
      article.sources.length > 0
        ? article.sources.map((s) => ({
            "@type": "CreativeWork",
            name: s.title,
            url: s.url,
          }))
        : undefined,
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

/** Página de perfil de autor (E-E-A-T): quién firma, con su bio y su página. */
export function personJsonLd(base: string, lang: Lang, author: Author, brand: string) {
  const url = absoluteUrl(base, authorPath(lang, author.id));
  const person = {
    "@type": author.kind === "newsroom" ? "Organization" : "Person",
    name: author.name,
    url,
    description: author.bio ?? undefined,
    jobTitle: author.kind === "person" ? (author.role ?? undefined) : undefined,
    image: author.avatarUrl ? absoluteUrl(base, author.avatarUrl) : undefined,
    worksFor: {
      "@type": "NewsMediaOrganization",
      "@id": `${base}#organizacion`,
      name: brand,
      url: base,
    },
    knowsAbout: ["economía", "ventas", "tecnología", "inteligencia artificial", "criptomonedas"],
    knowsLanguage: ["es", "en"],
  };
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: person,
    url,
    inLanguage: lang,
  };
}

/** Portada o sección: lista ordenada de notas, para que Google entienda qué es lo más importante. */
export function itemListJsonLd(
  base: string,
  lang: Lang,
  name: string,
  items: { title: string; sectionId: ArticleFull["sectionId"]; slug: string }[],
  path: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url: absoluteUrl(base, path),
    inLanguage: lang,
    isPartOf: { "@id": `${base}#organizacion` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(base, articlePath(lang, a.sectionId, a.slug)),
        name: a.title,
      })),
    },
  };
}
