import { headers } from "next/headers";
import { env } from "@/env";

const FALLBACK = "https://losupe.com";

/** Origen público del sitio: variable de entorno o, si falta, el host de la petición. */
export async function getBaseUrl(): Promise<string> {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL;
  const h = await headers();
  return baseUrlFromHeaders(h);
}

export function baseUrlFromHeaders(h: Headers): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return FALLBACK;
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export function baseUrlFromRequest(request: Request): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL;
  const fromHeaders = baseUrlFromHeaders(request.headers);
  if (fromHeaders !== FALLBACK) return fromHeaders;
  return new URL(request.url).origin;
}
