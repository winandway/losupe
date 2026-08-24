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

/**
 * Parte el cuerpo de una nota después del N-ésimo párrafo, para poder meter en medio un enlace
 * interno («Sigue leyendo»). Los enlaces internos dentro del texto son de lo que más pesa para
 * posicionar: reparten autoridad entre nuestras propias notas y retienen al lector.
 * Si la nota es corta, devuelve todo en `before` y no se inserta nada.
 */
export function splitAfterParagraph(
  html: string,
  afterParagraph = 2,
): { before: string; after: string } {
  const positions: number[] = [];
  const re = /<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) positions.push(m.index + m[0].length);
  // Hace falta al menos un párrafo más después del corte para que valga la pena partir.
  if (positions.length < afterParagraph + 2) return { before: html, after: "" };
  const at = positions[afterParagraph - 1]!;
  return { before: html.slice(0, at), after: html.slice(at) };
}

/**
 * ¿Este párrafo es solo una firma («Por Ana López», «By John Smith»)? Con lógica simple, no con una
 * expresión regular anidada (que con textos raros puede colgarse).
 */
export function isBylineParagraph(texto: string): boolean {
  const limpio = texto
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*\.$/, "")
    .trim();
  const partes = limpio.split(" ").filter(Boolean);
  if (partes.length < 2 || partes.length > 5) return false;
  const primera = partes[0]!.toLowerCase();
  if (primera !== "por" && primera !== "by") return false;
  return partes.slice(1).every((w) => /^[A-ZÁÉÍÓÚÑ][\p{L}'.-]*$/u.test(w));
}

/**
 * Quita del cuerpo las líneas de firma («Por Nombre Apellido»). El sitio ya pone la firma con nombre
 * y foto al pie de cada nota, así que dentro del texto solo duplica —y en el peor caso deja el
 * nombre de alguien que ya no escribe aquí. Se aplica al LEER, así que también limpia lo ya
 * publicado, en el sitio, en el RSS y en el markdown para agentes.
 */
export function stripInlineBylines(html: string): string {
  if (!/<p>\s*(?:Por|By)\s/i.test(html)) return html;
  return html.replace(/<p>([^<]{0,60})<\/p>/g, (m, dentro: string) =>
    isBylineParagraph(dentro) ? "" : m,
  );
}
