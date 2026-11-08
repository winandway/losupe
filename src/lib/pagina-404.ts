import type { Lang } from "@/i18n/config";

/**
 * Candado 59 — la página 404 viene hecha desde el servidor.
 *
 * Next 16 (16.4) responde a `notFound()` con un cascarón vacío (`<html id="__next_error__">`) y la
 * página se pinta después con JavaScript. Un lector sin JavaScript, un buscador apurado o una vista
 * previa veían una página en blanco. El worker detecta ese caso y sirve en su lugar
 * `/<idioma>/error-404`, una página normal que sí trae el HTML, conservando el estado 404.
 */
export const SEGMENTO_404 = "error-404";

export function ruta404(lang: Lang): string {
  return `/${lang}/${SEGMENTO_404}`;
}

/** ¿Es esta la petición directa a la página 404 interna? (también responde 404, nunca 200). */
export function esRuta404(pathname: string, lang: Lang | null): boolean {
  return lang !== null && pathname === ruta404(lang);
}

/**
 * ¿Hay que cambiar esta respuesta por la 404 hecha desde el servidor? Solo documentos HTML de una
 * visita (no la navegación interna de Next, que pide datos `rsc` y sabe pintar su propia 404).
 */
export function debeServir404Propia(
  request: Request,
  response: Response,
  lang: Lang | null,
): lang is Lang {
  if (!lang) return false;
  if (response.status !== 404) return false;
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  if (request.headers.has("rsc") || request.headers.has("next-router-state-tree")) return false;
  return (response.headers.get("content-type") ?? "").includes("text/html");
}
