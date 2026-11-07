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

/**
 * Adónde lleva el selector de idioma (candado 58).
 *
 * En una nota NO se puede armar la dirección del otro idioma cambiando el prefijo: el slug cambia de
 * idioma a idioma. `swapLangPath` daba `/en/economy/<slug-en-español>`, que respondía con una
 * redirección (si la nota estaba traducida) o con una copia en español marcada `noindex` (si no lo
 * estaba). Google seguía ese enlace en cada nota: el 7 nov 2026 Search Console contaba 45 de esas
 * redirecciones y 24 copias con noindex, todas nacidas del selector.
 *
 * Regla: en una nota se usa la versión que la propia página declara en su `hreflang` (`alternativa`).
 * Si no la hay —la nota no está traducida—, se va a la sección en el otro idioma, que siempre existe
 * y se indexa. Fuera de las notas, `swapLangPath` sigue sirviendo.
 */
export function destinoOtroIdioma(pathname: string, to: Lang, alternativa?: string | null): string {
  const segments = (pathname.split("?")[0] ?? "/").split("/").filter(Boolean);
  const [lang, seccion, slug] = segments;
  const encontrada = seccion ? sectionByAnySlug(seccion) : undefined;
  if (segments.length !== 3 || !lang || !isLang(lang) || !encontrada || !slug) {
    return swapLangPath(pathname, to);
  }
  if (alternativa) {
    try {
      const destino = new URL(alternativa, "https://losupe.com");
      if (destino.pathname.startsWith(`/${to}/`)) return destino.pathname;
    } catch {
      // Una alternativa rota no puede tumbar el selector: se cae a la sección, que siempre existe.
    }
  }
  return `/${to}/${encontrada.section.slug[to]}`;
}
