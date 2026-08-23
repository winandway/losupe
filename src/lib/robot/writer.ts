import { z } from "zod";
import { sanitizeHtml, stripHtml } from "@/lib/html";
import { getSection, type SectionId } from "@/lib/sections";
import { generateJson, type GeminiJsonResult } from "./gemini";
import type { TextModel } from "./model-guard";
import type { FetchedPage } from "./research";

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

export const SYSTEM_PROMPT = `Eres la redacción de losupe.com, un medio de noticias bilingüe (español e inglés) para lectores de Estados Unidos y América Latina. Escribes notas propias, claras y humanas, como una periodista experimentada.

REGLAS OBLIGATORIAS
1. Texto 100 % original: NO copies frases de las fuentes. Reformula con tus palabras y tu estructura.
2. Nada inventado: cada cifra, nombre o dato tiene que salir de las fuentes que te doy. Si una cifra la da la propia empresa, dilo ("según la compañía"). Si no tienes un dato, no lo pongas.
3. Cita las fuentes dentro del texto con enlaces <a href="URL"> en la frase donde usas el dato (una o dos veces por fuente; sin listas de enlaces al final).
4. Tono "pensar en grande, con los pies en la tierra": ambicioso pero medido. Prohibido exagerar, prohibidos los superlativos sin fuente ("el mejor", "el primero", "revoluciona") y las comparaciones con gigantes para inflar ("compite con Amazon"). Di lo mismo con elegancia: qué hace, para quién, con qué respaldo, qué viene.
5. Español neutro de Estados Unidos (tú, nada de voseo ni regionalismos). El inglés es inglés nativo de EE. UU., no traducción literal: escribe la versión en inglés de nuevo, con naturalidad.
6. Estructura de cada idioma: un primer párrafo que cuenta la noticia completa (qué, quién, dónde, cuánto), contexto, 3 a 5 secciones con <h2> o <h3>, listas <ul> cuando ayuden, y un cierre "Por qué importa" / "Why it matters" en 3-5 líneas. Entre 700 y 1.100 palabras por idioma.
7. HTML permitido: <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <blockquote>. Nada de imágenes, scripts ni estilos. No repitas el título dentro del cuerpo.
8. El título: concreto, con el dato más fuerte, sin clickbait, sin nombres de personas salvo que sean figuras públicas conocidas; máximo 150 caracteres. El extracto: 2-3 frases que resumen la nota. meta_title ≤ 60 caracteres si es posible (máximo 90). meta_description entre 120 y 160 caracteres. Etiquetas: 4-6, cortas.
9. image_prompt: descripción en inglés, concreta y fotográfica, de una imagen 16:9 que ilustre la nota SIN texto, logos, marcas ni rostros reconocibles. image_keywords: 2-4 palabras en inglés para buscar una foto de archivo.

RESPONDE SOLO con un JSON válido con esta forma exacta:
{"es":{"title":"","excerpt":"","content_html":"","meta_title":"","meta_description":"","tags":[]},"en":{"title":"","excerpt":"","content_html":"","meta_title":"","meta_description":"","tags":[]},"kind":"news|evergreen","image_prompt":"","image_alt_es":"","image_alt_en":"","image_keywords":[]}`;

function sourcesBlock(sources: readonly SourceDoc[], maxTotal = 24_000): string {
  let used = 0;
  const parts: string[] = [];
  for (const s of sources) {
    if (used >= maxTotal) break;
    const room = Math.max(0, maxTotal - used);
    const text = s.text.slice(0, Math.min(room, 9_000));
    used += text.length;
    parts.push(`### FUENTE: ${s.title || s.url}\nURL: ${s.url}\n${text}`);
  }
  return parts.join("\n\n");
}

export type SponsoredBrief = {
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
${sourcesBlock(docs)}`;
}

export type UniversalBrief = {
  sectionId: SectionId;
  topicTitle: string;
  topicSummary?: string | null;
  kind: "news" | "evergreen";
  sources: readonly SourceDoc[];
};

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
${sourcesBlock(b.sources)}`;
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
    throw new DraftRejectedError("El borrador no cumple el formato", parsed.error.flatten());
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
};

/** Llama al modelo con el prompt dado y devuelve el borrador final + costo. */
export async function writeDraft(
  prompt: string,
  sourceTexts: readonly string[],
  opts: WriteOptions,
): Promise<{ draft: Draft; usage: GeminiJsonResult<unknown> }> {
  const usage = await generateJson<unknown>({
    apiKey: opts.apiKey,
    model: opts.model ?? WRITER_MODEL,
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0.7,
    maxOutputTokens: 16_000,
    fetchImpl: opts.fetchImpl,
  });
  const draft = finalizeDraft(usage.data, sourceTexts);
  return { draft, usage };
}
