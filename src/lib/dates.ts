import type { Lang } from "@/i18n/config";

export const SITE_TIMEZONE = "America/New_York";

const LOCALES: Record<Lang, string> = { es: "es-US", en: "en-US" };

/** Normaliza fechas tipo "2025-09-30 20:56:30.456035+00" (Postgres) a ISO 8601. */
export function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  const normalized = trimmed
    .replace(" ", "T")
    .replace(/\.(\d{3})\d{0,9}/, ".$1")
    .replace(/\+00:00$/, "Z")
    .replace(/\+0000$/, "Z")
    .replace(/\+00$/, "Z");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function formatDate(iso: string, lang: Lang, withTime = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const options: Intl.DateTimeFormatOptions = withTime
    ? {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: SITE_TIMEZONE,
      }
    : { day: "numeric", month: "long", year: "numeric", timeZone: SITE_TIMEZONE };
  return new Intl.DateTimeFormat(LOCALES[lang], options).format(date);
}

export function toRfc822(iso: string): string {
  return new Date(iso).toUTCString();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Día en formato YYYY-MM-DD en la zona del sitio (para topes diarios del robot). */
export function todayKey(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
