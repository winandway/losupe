import { z } from "zod";
import { sanitizeHtml, stripHtml } from "@/lib/html";
import { getSection, type SectionId } from "@/lib/sections";
import { generateJson, type GeminiJsonResult } from "./gemini";
import type { TextModel } from "./model-guard";
import type { FetchedPage } from "./research";
import { SOURCE_NAMES } from "./trusted-sources";

/**
 * El redactor: arma el encargo para Gemini, valida la respuesta (zod), limpia el HTML y comprueba
 * que no copió frases de las fuentes. Devuelve un borrador bilingüe listo para ilustrar y publicar.
 */

const langOut = z.object({
  title: z.string().min(20).max(170),
  excerpt: z.string().min(60).max(420),
  content_html: z.string().min(1200),
  meta_title: z.string().min(15).max(95),
  meta_description: z.string().min(50).max(180),
  tags: z.array(z.string().min(2).max(40)).min(3).max(8),
});

export const draftSchema = z.object({
  es: langOut,
  en: langOut,
  kind: z.enum(["news", "evergreen"]),
  image_prompt: z.string().min(10).max(500),
  image_alt_es: z.string().min(5).max(200),
  image_alt_en: z.string().min(5).max(200),
  image_keywords: z.array(z.string().min(2).max(30)).min(1).max(5),
  wants_video: z.boolean().optional().default(false),
  video_keywords: z.array(z.string().min(2).max(30)).max(4).optional().default([]),
});
export type Draft = z.infer<typeof draftSchema>;

export type SourceDoc = { title: string; url: string; text: string };

export const WRITER_MODEL: TextModel = "gemini-2.5-flash";

const ALLOWED_TAGS = /^(p|h2|h3|h4|ul|ol|li|strong|em|a|blockquote|br|figure|figcaption)$/i;

/** Deja solo etiquetas editoriales (sin img ni scripts) y enlaces http(s) con rel/target seguros. */
export function cleanEditorialHtml(html: string): string {
  let out = sanitizeHtml(html);
  let droppedAnchors = 0; // enlaces inválidos: se quita la apertura y también su cierre
  out = out.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (m, tag: string, attrs: string) => {
    const name = tag.toLowerCase();
    if (!ALLOWED_TAGS.test(name)) return "";
    if (m.startsWith("</")) {
      if (name === "a" && droppedAnchors > 0) {
        droppedAnchors -= 1;
        return "";
      }
      return `</${name}>`;
    }
    if (name === "a") {
      const href = attrs?.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? "";
      // Enlaces internos (/es/... o /en/...): se quedan en el sitio, sin nofollow ni pestaña nueva.
      if (/^\/(es|en)\//.test(href)) return `<a href="${href}">`;
      if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) {
        droppedAnchors += 1;
        return "";
      }
      return `<a href="${href}" target="_blank" rel="noopener noreferrer nofollow">`;
    }
    return `<${name}>`;
  });
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

/** Fragmentos de N palabras (sin acentos ni signos) para comparar textos. */
export function shingles(text: string, n = 8): Set<string> {
  const words = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(" "));
  return out;
}

/** Proporción de fragmentos del borrador que aparecen tal cual en las fuentes (0 = nada copiado). */
export function copyRatio(draftText: string, sources: readonly string[], n = 8): number {
  const mine = shingles(draftText, n);
  if (mine.size === 0) return 0;
  const theirs = new Set<string>();
  for (const s of sources) for (const sh of shingles(s, n)) theirs.add(sh);
  let hits = 0;
  for (const sh of mine) if (theirs.has(sh)) hits++;
  return hits / mine.size;
}

export const MAX_COPY_RATIO = 0.08;

export const SYSTEM_PROMPT = `Eres la redacción de losupe.com, un medio de noticias bilingüe (español e inglés) para lectores de Estados Unidos y América Latina. Escribes notas propias, claras y humanas, como una periodista experimentada. Cada nota sale firmada por Magaly Molina, nuestra editora: tiene que estar a la altura de su firma —bien hecha, verificable y sin descuidos—, porque queremos ser una fuente seria para las personas, para Google y para las IA que leen la web.

VOZ (lo que nunca se pierde)
- Escribe con calidez y humanidad: cercana, relajada, amable, como quien le explica algo importante a un amigo que confía en ti. Sin frialdad corporativa, sin grandilocuencia, sin sermones. Se permite una pizca de emoción y de empatía cuando la historia la tiene; nunca sensacionalismo.
- Español neutro de Estados Unidos (tú, nada de voseo ni regionalismos). El inglés es inglés nativo de EE. UU., no traducción literal: escribe la versión en inglés de nuevo, con naturalidad y la misma calidez.
- Tono "pensar en grande, con los pies en la tierra": ambicioso pero medido. Prohibido exagerar, prohibidos los superlativos sin fuente ("el mejor", "el primero", "revoluciona") y las comparaciones con gigantes para inflar ("compite con Amazon"). Di lo mismo con elegancia: qué hace, para quién, con qué respaldo, qué viene.

FUENTES (lo más importante)
1. Texto 100 % original: NO copies frases de las fuentes. Reformula con tus palabras y tu estructura. Inventamos el titular y el enfoque; la información viene de donde la leímos y eso se dice.
2. Nada inventado: cada cifra, nombre o dato tiene que salir de las fuentes que te doy. Si una cifra la da la propia empresa, dilo ("según la compañía"). Si no tienes un dato, no lo pongas.
3. Nombra la fuente en la misma frase en que usas su dato, con su nombre propio y un enlace <a href="URL">: "según The New York Times", "como reportó Reuters", "de acuerdo con la Reserva Federal". Si una noticia aparece en muchos medios, apóyate en la fuente MÁS confiable (medio grande, agencia, organismo oficial, la empresa o persona protagonista) y dilo. Una o dos menciones por fuente; sin listas de enlaces al final.
3.b Si te doy NOTAS NUESTRAS relacionadas, enlaza UNA o DOS dentro del texto, de forma natural, donde de verdad venga a cuento («como contamos en <a href="/es/...">esta nota</a>»). Son enlaces internos: usa la ruta tal cual te la doy, sin dominio.
4. Cuando la nota es un encargo de una empresa (contenido patrocinado), la información sale de la propia empresa y de su sitio: ahí la fuente somos nosotros y la empresa ("según Mercatren", "la compañía explica en su sitio"). Nunca la presentes como cobertura de terceros que no existe.

FORMA
5. Estructura de cada idioma: un primer párrafo que cuenta la noticia completa (qué, quién, dónde, cuánto), contexto, 3 a 5 secciones con <h2> o <h3>, listas <ul> cuando ayuden, y un cierre "Por qué importa" / "Why it matters" en 3-5 líneas. Entre 700 y 1.100 palabras por idioma. Si el tipo es GUÍA DURADERA, escribe para que siga sirviendo dentro de un año: pasos, consejos numerados, errores comunes, preguntas frecuentes.
6. HTML permitido: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <blockquote>. Nada de imágenes, videos, scripts ni estilos (los medios los pone el sistema). No repitas el título dentro del cuerpo.
7. El título: concreto, con el dato más fuerte, sin clickbait, sin nombres de personas salvo que sean figuras públicas conocidas; máximo 150 caracteres. El extracto: 2-3 frases que resumen la nota. meta_title ≤ 60 caracteres si es posible (máximo 90). meta_description entre 120 y 160 caracteres. Etiquetas: 4-6, cortas.
8. image_prompt: descripción en inglés, concreta y fotográfica, de una imagen 16:9 que ilustre la nota SIN texto, logos, marcas ni rostros reconocibles. image_keywords: 2-4 palabras en inglés para buscar una foto de archivo en Pexels.
9. Video: Pexels también tiene videos cortos de archivo (paisajes, ciudades, manos trabajando, pantallas, música, comida…). Pide uno SOLO cuando de verdad sume a la nota (guías, lugares, productos, música, ambiente) poniendo wants_video en true y video_keywords con 2-3 palabras en inglés; si no suma, wants_video en false. Nunca en notas delicadas (muertes, tragedias).

RESPONDE SOLO con un JSON válido con esta forma exacta:
{"es":{"title":"","excerpt":"","content_html":"","meta_title":"","meta_description":"","tags":[]},"en":{"title":"","excerpt":"","content_html":"","meta_title":"","meta_description":"","tags":[]},"kind":"news|evergreen","image_prompt":"","image_alt_es":"","image_alt_en":"","image_keywords":[],"wants_video":false,"video_keywords":[]}`;

/** Nombre legible de un medio a partir de su URL (para citarlo bien: "según The New York Times"). */
export function sourceDisplayName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const known = SOURCE_NAMES[host];
    if (known) return known;
    const parts = host.split(".");
    const core = parts.length > 2 ? parts[parts.length - 2] : parts[0];
    return (core ?? host).replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return url;
  }
}

function sourcesBlock(sources: readonly SourceDoc[], maxTotal = 24_000): string {
  let used = 0;
  const parts: string[] = [];
  for (const s of sources) {
    if (used >= maxTotal) break;
    const room = Math.max(0, maxTotal - used);
    const text = s.text.slice(0, Math.min(room, 9_000));
    used += text.length;
    parts.push(
      `### FUENTE: ${sourceDisplayName(s.url)}${s.title ? ` — ${s.title}` : ""}\nURL: ${s.url}\n${text}`,
    );
  }
  return parts.join("\n\n");
}

export type SponsoredBrief = {
  internalLinks?: readonly InternalLink[];
  sponsorName: string;
  website: string;
  sponsorBrief?: string | null;
  titleIdea: string;
  brief?: string | null;
  sectionId: SectionId;
  pages: readonly FetchedPage[];
  extraSources?: readonly SourceDoc[];
};

/** Encargo de una nota patrocinada (la empresa compró la nota; el sitio la marcará como patrocinada). */
export function buildSponsoredPrompt(b: SponsoredBrief): string {
  const section = getSection(b.sectionId);
  const docs: SourceDoc[] = [
    ...b.pages.map((p) => ({ title: p.title || p.url, url: p.url, text: p.text })),
    ...(b.extraSources ?? []),
  ];
  return `ENCARGO: nota sobre la empresa "${b.sponsorName}" (${b.website}) para la sección "${section?.name.es ?? b.sectionId}".

IDEA DE TITULAR (guía, puedes mejorarla manteniendo el enfoque): ${b.titleIdea}
${b.brief ? `INDICACIONES DE ESTA NOTA: ${b.brief}` : ""}
${b.sponsorBrief ? `QUIÉN ES LA EMPRESA (brief interno): ${b.sponsorBrief}` : ""}

CONTEXTO: la empresa contrató esta nota con el medio. El sitio la marcará como contenido patrocinado; tú NO escribas "publicidad" ni "patrocinado" dentro del texto. Escríbela como una nota informativa útil para el lector (qué es, cómo funciona, para quién sirve, qué la diferencia, qué viene), con los datos de su propio sitio web como fuente principal y citándolo. Enlaza el sitio de la empresa una o dos veces. Sin adjetivos vacíos ni promesas que no salgan de las fuentes. Si hay cifras, atribúyelas a la empresa.

MATERIAL DE INVESTIGACIÓN (páginas del sitio de la empresa y fuentes extra):
${sourcesBlock(docs)}${internalLinksBlock(b.internalLinks ?? [])}`;
}

export type InternalLink = { title: string; path: string };

export type UniversalBrief = {
  sectionId: SectionId;
  topicTitle: string;
  topicSummary?: string | null;
  kind: "news" | "evergreen";
  sources: readonly SourceDoc[];
  /** Notas nuestras que el redactor puede enlazar dentro del texto (SEO interno). */
  internalLinks?: readonly InternalLink[];
};

/** Bloque de notas nuestras para enlazar (rutas relativas, sin dominio). */
export function internalLinksBlock(links: readonly InternalLink[]): string {
  if (links.length === 0) return "";
  return `\n\nNOTAS NUESTRAS QUE PUEDES ENLAZAR (usa la ruta tal cual, sin dominio):\n${links
    .map((l) => `- ${l.title} → ${l.path}`)
    .join("\n")}`;
}

/** Nota universal: una noticia o guía duradera a partir de fuentes públicas. */
export function buildUniversalPrompt(b: UniversalBrief): string {
  const section = getSection(b.sectionId);
  const kindText =
    b.kind === "evergreen"
      ? "Escribe una GUÍA DURADERA (cómo hacer, qué saber, lista o comparativa) que siga sirviendo dentro de un año, usando la noticia solo como punto de partida."
      : "Escribe la NOTICIA DEL DÍA: qué pasó, a quién afecta, qué sigue.";
  return `ENCARGO: nota para la sección "${section?.name.es ?? b.sectionId}".
TEMA: ${b.topicTitle}
${b.topicSummary ? `RESUMEN DEL TEMA: ${b.topicSummary}` : ""}
TIPO: ${kindText}

Usa SOLO el material de abajo. Si las fuentes se contradicen, dilo. Cita cada fuente con enlace donde uses su dato.

MATERIAL:
${sourcesBlock(b.sources)}${internalLinksBlock(b.internalLinks ?? [])}`;
}

export class DraftRejectedError extends Error {
  constructor(
    message: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = "DraftRejectedError";
  }
}

/** Valida y limpia lo que devolvió el modelo; rechaza si copió fuentes. */
export function finalizeDraft(raw: unknown, sourceTexts: readonly string[]): Draft {
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) {
    // El detalle va en el mensaje: sin él, en el panel solo se ve «no cumple el formato» y no hay
    // forma de saber qué campo vino mal (pasó en producción el 24 ago 2026).
    const detalle = parsed.error.issues
      .slice(0, 4)
      .map((i) => `${i.path.join(".") || "raíz"}: ${i.message}`)
      .join("; ");
    throw new DraftRejectedError(
      `El borrador no cumple el formato (${detalle})`,
      parsed.error.flatten(),
    );
  }
  const d = parsed.data;
  const es = { ...d.es, content_html: cleanEditorialHtml(d.es.content_html) };
  const en = { ...d.en, content_html: cleanEditorialHtml(d.en.content_html) };
  for (const [lang, part] of [
    ["es", es],
    ["en", en],
  ] as const) {
    const words = stripHtml(part.content_html).split(/\s+/).filter(Boolean).length;
    if (words < 450)
      throw new DraftRejectedError(`El borrador en ${lang} es muy corto (${words} palabras)`);
    const ratio = copyRatio(stripHtml(part.content_html), sourceTexts);
    if (ratio > MAX_COPY_RATIO) {
      throw new DraftRejectedError(
        `El borrador en ${lang} copia fuentes (${(ratio * 100).toFixed(1)} % de fragmentos)`,
      );
    }
  }
  return { ...d, es, en };
}

export type WriteOptions = {
  apiKey: string;
  model?: TextModel;
  fetchImpl?: typeof fetch;
  /** Cuántas veces se vuelve a pedir la nota si sale copiada o mal formada (por defecto, una). */
  retries?: number;
};

/**
 * Llama al modelo y devuelve el borrador final + costo.
 *
 * Si el borrador se cae por copiar frases de las fuentes o por venir mal formado, se pide **otra
 * vez** con una advertencia concreta encima. Pasa sobre todo en inglés, cuando la fuente ya está en
 * inglés: reformular sin repetir cuesta más. Sin este reintento, un solo tropiezo dejaba la corrida
 * entera sin nota (y el diario sin publicar ese turno). El listón NO se baja: si el segundo intento
 * también copia, la nota se descarta.
 */
export async function writeDraft(
  prompt: string,
  sourceTexts: readonly string[],
  opts: WriteOptions,
): Promise<{ draft: Draft; usage: GeminiJsonResult<unknown>; attempts: number }> {
  const maxAttempts = Math.max(1, (opts.retries ?? 1) + 1);
  let last: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const motivo = last instanceof Error ? last.message : "";
    const copiaba = /copia fuentes/.test(motivo);
    const aviso =
      attempt === 1
        ? ""
        : copiaba
          ? `\n\nAVISO IMPORTANTE: el intento anterior fue rechazado porque repetía frases de las fuentes (${motivo}). Vuelve a escribirla DESDE CERO con tus propias palabras y tu propia estructura: cambia el orden de las ideas, parte y une las frases, y no copies ni una expresión de más de siete palabras seguidas. Los nombres propios y las cifras sí se mantienen.`
          : `\n\nAVISO IMPORTANTE: el intento anterior se rechazó por formato (${motivo}). Devuelve EXACTAMENTE el JSON pedido, con todos los campos y respetando los largos: título entre 20 y 170 caracteres, extracto entre 60 y 420, cuerpo de 700 a 1.100 palabras, meta_title entre 15 y 95, meta_description entre 50 y 180, y entre 3 y 8 etiquetas de 2 a 40 caracteres cada una. No cortes el JSON.`;
    const usage = await generateJson<unknown>({
      apiKey: opts.apiKey,
      model: opts.model ?? WRITER_MODEL,
      system: SYSTEM_PROMPT,
      prompt: prompt + aviso,
      temperature: attempt === 1 ? 0.7 : 0.9,
      maxOutputTokens: 16_000,
      fetchImpl: opts.fetchImpl,
    });
    try {
      return { draft: finalizeDraft(usage.data, sourceTexts), usage, attempts: attempt };
    } catch (error) {
      last = error;
      if (attempt === maxAttempts) throw error;
    }
  }
  /* istanbul ignore next: el bucle sale por return o por throw */
  throw last;
}
