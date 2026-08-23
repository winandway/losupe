import { isLang, pickLangFromAcceptLanguage } from "@/i18n/config";

// Rutas que no llevan prefijo de idioma y nunca se redirigen.
const SKIP_PREFIXES = [
  "/.well-known/",
  "/_next/",
  "/img/",
  "/brand/",
  "/media/",
  "/datos/",
  "/__scheduled",
  "/__health",
  "/noticia/",
];
const SKIP_EXACT = new Set([
  "/robots.txt",
  "/sitemap.xml",
  "/news-sitemap.xml",
  "/favicon.ico",
  "/manifest.webmanifest",
  "/llms.txt",
  "/icon.png",
  "/apple-icon.png",
  "/opengraph-image.png",
  "/twitter-image.png",
]);

/**
 * Si la ruta no trae idioma (/es o /en), devuelve a dónde redirigir según Accept-Language.
 * Devuelve null cuando la ruta ya tiene idioma o es un archivo/ruta especial.
 */
export function langRedirectTarget(url: URL, acceptLanguage: string | null): string | null {
  const path = url.pathname;
  const lang = pickLangFromAcceptLanguage(acceptLanguage);
  if (path === "/") return `/${lang}${url.search}`;
  const first = path.split("/")[1] ?? "";
  if (isLang(first)) return null;
  if (SKIP_EXACT.has(path)) return null;
  if (SKIP_PREFIXES.some((prefix) => path.startsWith(prefix))) return null;
  // Archivos con extensión (imágenes, css, js…) se sirven tal cual.
  const last = path.split("/").pop() ?? "";
  if (/\.[a-z0-9]{1,8}$/i.test(last)) return null;
  return `/${lang}${path}${url.search}`;
}
