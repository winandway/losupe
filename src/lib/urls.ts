import { isLang, type Lang } from "@/i18n/config";
import { sectionByAnySlug, sectionSlug, type SectionId } from "./sections";

export const ROUTE_WORDS = {
  author: { es: "autor", en: "author" },
  search: { es: "buscar", en: "search" },
  about: { es: "acerca", en: "about" },
} as const;

type RouteKey = keyof typeof ROUTE_WORDS;

export function homePath(lang: Lang): string {
  return `/${lang}`;
}

export function sectionPath(lang: Lang, sectionId: SectionId): string {
  return `/${lang}/${sectionSlug(sectionId, lang)}`;
}

export function articlePath(lang: Lang, sectionId: SectionId, slug: string): string {
  return `/${lang}/${sectionSlug(sectionId, lang)}/${encodeURIComponent(slug)}`;
}

export function authorPath(lang: Lang, authorId: string): string {
  return `/${lang}/${ROUTE_WORDS.author[lang]}/${encodeURIComponent(authorId)}`;
}

export function searchPath(lang: Lang, q?: string): string {
  const base = `/${lang}/${ROUTE_WORDS.search[lang]}`;
  return q ? `${base}?q=${encodeURIComponent(q)}` : base;
}

export function aboutPath(lang: Lang): string {
  return `/${lang}/${ROUTE_WORDS.about[lang]}`;
}

export function rssPath(lang: Lang): string {
  return `/${lang}/rss.xml`;
}

function routeKeyForWord(word: string): RouteKey | undefined {
  for (const key of Object.keys(ROUTE_WORDS) as RouteKey[]) {
    const words = ROUTE_WORDS[key];
    if (words.es === word || words.en === word) return key;
  }
  return undefined;
}

/**
 * Devuelve la misma ruta en el otro idioma: cambia el prefijo y traduce
 * el segmento de sección o de ruta (autor/author, buscar/search, acerca/about).
 * Los slugs de artículos se conservan: la página del artículo redirige al slug correcto.
 */
export function swapLangPath(pathname: string, to: Lang): string {
  const clean = pathname.split("?")[0] ?? "/";
  const segments = clean.split("/").filter(Boolean);
  const first = segments[0];
  if (!first || !isLang(first)) {
    return `/${to}${clean === "/" ? "" : clean}`;
  }
  const rest = segments.slice(1);
  const second = rest[0];
  if (second) {
    const bySection = sectionByAnySlug(second);
    if (bySection) {
      rest[0] = bySection.section.slug[to];
    } else {
      const key = routeKeyForWord(second);
      if (key) rest[0] = ROUTE_WORDS[key][to];
    }
  }
  return `/${[to, ...rest].join("/")}`;
}

export function absoluteUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
