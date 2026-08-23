export const LANGS = ["es", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "es";

export function isLang(value: string | undefined | null): value is Lang {
  return value === "es" || value === "en";
}

export function toLang(value: string | undefined | null): Lang {
  return isLang(value) ? value : DEFAULT_LANG;
}

export function otherLang(lang: Lang): Lang {
  return lang === "es" ? "en" : "es";
}

/** Elige idioma a partir de la cabecera Accept-Language. Español por defecto. */
export function pickLangFromAcceptLanguage(header: string | null | undefined): Lang {
  if (!header) return DEFAULT_LANG;
  const prefs = header
    .split(",")
    .map((part, index) => {
      const [tagRaw, ...params] = part.trim().split(";");
      const tag = (tagRaw ?? "").trim().toLowerCase();
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return { tag, q: Number.isFinite(q) ? q : 0, index };
    })
    .filter((p) => p.tag.length > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const p of prefs) {
    if (p.tag.startsWith("es")) return "es";
    if (p.tag.startsWith("en")) return "en";
  }
  return DEFAULT_LANG;
}
