const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
};

/** Decodifica las entidades HTML más comunes (texto plano, no HTML). */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body.toLowerCase()] ?? match;
  });
}

/** Quita etiquetas y deja texto plano con espacios normalizados. */
export function stripHtml(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|div|h[1-6]|li|blockquote|tr)>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Limpieza mínima de HTML confiable (nuestro propio contenido): fuera scripts, iframes,
 * objetos, manejadores on* y URLs javascript:/data: en enlaces e imágenes.
 */
export function sanitizeHtml(html: string): string {
  let out = html
    .replace(/<(script|style|iframe|object|embed|form|input|textarea|button)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed|form|input|textarea|button)[^>]*\/?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  // Atributos on* (onclick, onerror, ...)
  out = out.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // Enlaces con javascript:
  out = out.replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*("|')/gi, '$1="#"');
  // Imágenes incrustadas en base64 (pesan demasiado y no se indexan)
  out = out.replace(/<img[^>]+src\s*=\s*("|')data:[^"']*("|')[^>]*>/gi, "");
  // Un solo h1 por página (el título): los h1 del cuerpo bajan a h2.
  out = out.replace(/<h1\b([^>]*)>/gi, "<h2$1>").replace(/<\/h1>/gi, "</h2>");
  return out;
}

export function wordCount(textOrHtml: string): number {
  const text = stripHtml(textOrHtml);
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/** Minutos de lectura a ~200 palabras por minuto (mínimo 1). */
export function readingMinutes(textOrHtml: string): number {
  return Math.max(1, Math.round(wordCount(textOrHtml) / 200));
}

/** Resumen de texto plano, cortado en una palabra completa, con elipsis. */
export function excerptFrom(textOrHtml: string, maxLength = 160): string {
  const text = stripHtml(textOrHtml);
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, "")}…`;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
