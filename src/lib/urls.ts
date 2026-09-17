import { isLang, type Lang } from "../i18n/config";
import { sectionByAnySlug, sectionSlug, type SectionId } from "./sections";

export const ROUTE_WORDS = {
  author: { es: "autor", en: "author" },
  search: { es: "buscar", en: "search" },
  about: { es: "acerca", en: "about" },
  editorial: { es: "politica-editorial", en: "editorial-policy" },
  privacy: { es: "privacidad", en: "privacy" },
  terms: { es: "terminos", en: "terms" },
  publish: { es: "publica", en: "publish" },
  contact: { es: "contacto", en: "contact" },
  widget: { es: "widget", en: "widget" },
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

/** Página de contacto: es lo primero que mira Google Noticias para saber quién está detrás. */
export function contactPath(lang: Lang): string {
  return staticPath("contact", lang);
}

export function staticPath(key: RouteKey, lang: Lang): string {
  return `/${lang}/${ROUTE_WORDS[key][lang]}`;
}

/**
 * `/es/about` → `/es/acerca`, `/en/autor/x` → `/en/author/x`. `null` si la ruta ya está bien.
 *
 * La auditoría SEO del 17 sep 2026 encontró que cada página fija respondía en DOS direcciones —con
 * la palabra de su idioma y con la del otro— y las dos con código 200. La canónica ya apuntaba a la
 * buena, pero una redirección permanente es la señal clara: una sola dirección por página.
 */
export function rutaConPalabraDelIdioma(pathname: string): string | null {
  const partes = pathname.split("/");
  const lang = partes[1];
  const palabra = partes[2];
  if (!lang || !isLang(lang) || !palabra) return null;
  const key = routeKeyForWord(palabra);
  if (!key) return null;
  const correcta = ROUTE_WORDS[key][lang];
  if (correcta === palabra) return null;
  partes[2] = correcta;
  return partes.join("/");
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
