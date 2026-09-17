/**
 * UN SOLO DOMINIO: https://losupe.com.
 *
 * Lo encontró la auditoría SEO del 17 sep 2026, y era el error más grave del sitio: el diario
 * respondía completo en CUATRO direcciones —`https://losupe.com`, `http://losupe.com`,
 * `https://www.losupe.com` y `https://losupe.sitios.dev`— y en cada una la etiqueta canónica
 * apuntaba a sí misma. Para Google eso son cuatro diarios idénticos compitiendo entre ellos, con la
 * autoridad repartida en cuatro, en vez de uno solo que se la lleva toda.
 *
 * La causa: la dirección pública se armaba con el dominio por el que había entrado la visita (y la
 * variable `NEXT_PUBLIC_SITE_URL` no está puesta en producción). Dos arreglos, y hacen falta los dos:
 *  1. Toda dirección que el sitio escribe de sí mismo —canónica, hreflang, mapa, datos
 *     estructurados, feeds— usa SIEMPRE `https://losupe.com` cuando la visita llega por un dominio
 *     nuestro (`origenCanonico`).
 *  2. `http://` y `www.` redirigen con 301 a `https://losupe.com` (`redireccionCanonica`), que es la
 *     señal más fuerte y la que Google recomienda. `losupe.sitios.dev` NO se redirige: es el dominio
 *     de la plataforma y puede usarse para comprobaciones internas; ahí basta la canónica.
 */

export const DOMINIO_CANONICO = "https://losupe.com";

/** Los dominios por los que se sirve este mismo diario. */
const HOSTS_PROPIOS = /^(?:www\.)?losupe\.com$|^losupe\.sitios\.dev$/i;

export function esHostPropio(host: string): boolean {
  return HOSTS_PROPIOS.test(host.split(":")[0] ?? "");
}

/**
 * El origen con el que el sitio se nombra a sí mismo. Si la visita entró por un dominio nuestro,
 * siempre el canónico; si no (localhost en desarrollo y pruebas), el que llegó.
 */
export function origenCanonico(host: string, proto: string): string {
  return esHostPropio(host) ? DOMINIO_CANONICO : `${proto}://${host}`;
}

/** El esquema con el que llegó la visita, aunque haya proxies delante. */
export function esquemaDe(url: URL, headers: Headers): string {
  const reenviado = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (reenviado) return reenviado;
  try {
    const visitante = JSON.parse(headers.get("cf-visitor") ?? "{}") as { scheme?: string };
    if (visitante.scheme) return visitante.scheme;
  } catch {
    // cabecera mal formada: se usa la de la propia dirección
  }
  return url.protocol.replace(":", "");
}

/**
 * Si esta visita debe irse a `https://losupe.com`, a qué dirección exacta. `null` si no.
 *
 * Nunca toca las rutas internas (`/__scheduled`, `/__health`): el reloj y los chequeos no deben
 * depender de seguir una redirección.
 */
export function redireccionCanonica(url: URL, headers: Headers): string | null {
  const host = url.hostname.toLowerCase();
  if (host !== "losupe.com" && host !== "www.losupe.com") return null;
  if (url.pathname.startsWith("/__")) return null;
  const esWww = host === "www.losupe.com";
  const esHttp = esquemaDe(url, headers) === "http";
  if (!esWww && !esHttp) return null;
  return `${DOMINIO_CANONICO}${url.pathname}${url.search}`;
}
