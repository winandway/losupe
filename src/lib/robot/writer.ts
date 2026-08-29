import { z } from "zod";
import { sanitizeHtml, stripHtml, stripInlineBylines } from "@/lib/html";
import { getSection, type SectionId } from "@/lib/sections";
import { generateJson, type GeminiJsonResult } from "./gemini";
import type { TextModel } from "./model-guard";
import type { FetchedPage } from "./research";
import { revisarSonidoHumano } from "./tics-ia";
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
  // El pie de foto: lo que se lee DEBAJO de la imagen. Es distinto del texto alternativo (ese lo
  // lee un lector de pantalla y describe la imagen); el pie cuenta algo, sitúa la escena y es una
  // de las cosas más leídas de una página. Sin él, una foto se ve suelta y amateur.
  image_caption_es: z.string().min(15).max(220).optional().default(""),
  image_caption_en: z.string().min(15).max(220).optional().default(""),
  image_keywords: z.array(z.string().min(2).max(30)).min(1).max(5),
  wants_video: z.boolean().optional().default(false),
  video_keywords: z.array(z.string().min(2).max(30)).max(4).optional().default([]),
});
export type Draft = z.infer<typeof draftSchema>;

export type SourceDoc = { title: string; url: string; text: string };

export const WRITER_MODEL: TextModel = "gemini-2.5-flash";

/**
 * El esquema que se le pasa a la API para que GARANTICE la forma de la respuesta.
 *
 * El 25 ago 2026 el diario estuvo dos días sin publicar porque el modelo devolvía un JSON completo
 * pero mal formado, y no hay forma de pedirle por escrito que no lo haga. Con `responseSchema` deja
 * de ser una petición y pasa a ser una garantía: la propia API se encarga de que salga válido.
 *
 * Se escribe a mano y no desde zod porque la API acepta un subconjunto de OpenAPI, no JSON Schema
 * completo. Si se añade un campo al borrador, hay que añadirlo AQUÍ también — la prueba lo vigila.
 */
const TEXTO = { type: "STRING" } as const;
const LANG_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: TEXTO,
    excerpt: TEXTO,
    content_html: TEXTO,
    meta_title: TEXTO,
    meta_description: TEXTO,
    tags: { type: "ARRAY", items: TEXTO },
  },
  required: ["title", "excerpt", "content_html", "meta_title", "meta_description", "tags"],
} as const;

export const DRAFT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    es: LANG_SCHEMA,
    en: LANG_SCHEMA,
    kind: { type: "STRING", enum: ["news", "evergreen"] },
    image_prompt: TEXTO,
    image_alt_es: TEXTO,
    image_alt_en: TEXTO,
    image_caption_es: TEXTO,
    image_caption_en: TEXTO,
    image_keywords: { type: "ARRAY", items: TEXTO },
    wants_video: { type: "BOOLEAN" },
    video_keywords: { type: "ARRAY", items: TEXTO },
  },
  required: ["es", "en", "kind", "image_prompt", "image_alt_es", "image_alt_en", "image_keywords"],
} as const;

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
  // El modelo a veces firma el texto («Por Nombre Apellido»). El sitio ya pone la firma con foto, así
  // que esa línea duplica —y en el peor caso deja el nombre de alguien que ya no escribe aquí.
  out = stripInlineBylines(out);
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

/**
 * Índice de fragmentos de las fuentes. Se calcula UNA vez por corrida y se reutiliza.
 *
 * Antes se rehacía dentro de cada comprobación: dos idiomas por intento, y con un reintento son
 * cuatro veces el mismo trabajo sobre decenas de miles de palabras. El 24 ago 2026 dos corridas
 * seguidas murieron a media escritura sin dejar rastro; el worker tiene un presupuesto de CPU y
 * esto se lo comía. Calcularlo una vez cuesta lo mismo que calcularlo cuatro, dividido entre cuatro.
 */
export function sourceShingles(sources: readonly string[], n = 8): Set<string> {
  const theirs = new Set<string>();
  for (const s of sources) for (const sh of shingles(s, n)) theirs.add(sh);
  return theirs;
}

/** Proporción de fragmentos del borrador que ya están en el índice de las fuentes. */
export function copyRatioContra(draftText: string, theirs: ReadonlySet<string>, n = 8): number {
  const mine = shingles(draftText, n);
  if (mine.size === 0) return 0;
  let hits = 0;
  for (const sh of mine) if (theirs.has(sh)) hits++;
  return hits / mine.size;
}

/** Proporción de fragmentos del borrador que aparecen tal cual en las fuentes (0 = nada copiado). */
export function copyRatio(draftText: string, sources: readonly string[], n = 8): number {
  return copyRatioContra(draftText, sourceShingles(sources, n), n);
}

export const MAX_COPY_RATIO = 0.08;

export const SYSTEM_PROMPT = `Eres la redacción de losupe.com, un medio de noticias bilingüe (español e inglés) para lectores de Estados Unidos y América Latina. Escribes notas propias, claras y humanas, como una periodista experimentada. Cada nota sale firmada por la persona del equipo a la que le toque el turno, y el sitio pone su nombre y su foto solo: **NUNCA escribas la firma dentro del texto** (nada de «Por Nombre Apellido», ni al principio ni al final) y no menciones a ningún miembro del equipo. Aun así, la nota tiene que estar a la altura de una firma con nombre y cara —bien hecha, verificable y sin descuidos—, porque queremos ser una fuente seria para las personas, para Google y para las IA que leen la web.

VOZ (lo que nunca se pierde)
- Escribe con calidez y humanidad: cercana, relajada, amable, como quien le explica algo importante a un amigo que confía en ti. Sin frialdad corporativa, sin grandilocuencia, sin sermones. Se permite una pizca de emoción y de empatía cuando la historia la tiene; nunca sensacionalismo.
- Español neutro de Estados Unidos (tú, nada de voseo ni regionalismos). El inglés es inglés nativo de EE. UU., no traducción literal: escribe la versión en inglés de nuevo, con naturalidad y la misma calidez.
- Tono "pensar en grande, con los pies en la tierra": ambicioso pero medido. Prohibido exagerar, prohibidos los superlativos sin fuente ("el mejor", "el primero", "revoluciona") y las comparaciones con gigantes para inflar ("compite con Amazon"). Di lo mismo con elegancia: qué hace, para quién, con qué respaldo, qué viene.

LA IMAGEN Y SU PIE
- El campo image_prompt: describe una FOTOGRAFÍA de prensa, no una ilustración. Escena concreta, con
  personas o lugares reales de la historia, luz natural, profundidad de campo de cámara réflex, sin
  texto ni logotipos dentro de la imagen. Piensa qué foto abriría esta nota en un diario.
- Los campos image_caption_es / image_caption_en: el pie de foto, lo que se lee DEBAJO de la imagen. No
  repitas el titular ni describas lo obvio («un hombre en una oficina»): sitúa la escena y aporta un
  dato que no esté en el titular. Una o dos frases, como en cualquier diario.

QUE NO SE NOTE QUE ESCRIBE UNA MÁQUINA (esto es lo que más se nota y lo que más nos cuesta)
- Escribe como habla una persona que sabe del tema y te lo está contando. Frases de largos distintos: algunas cortas de verdad. Una idea por frase. Si una frase no se puede leer en voz alta de un tirón, pártela.
- HAY PALABRAS QUE DELATAN A UNA IA. Las más típicas: "resiliencia", "robusto", "panorama actual", "en la era digital", "cabe destacar", "es crucial", "es fundamental", "juega un papel clave", "punto de inflexión", "hoja de ruta", "desbloquear", "profundizar en", "un testimonio de", "en resumen", "en un mundo cada vez más…". En inglés: "delve", "leverage", "robust", "seamless", "landscape", "tapestry", "a testament to", "navigate", "unlock", "harness", "pivotal", "crucial", "underscores", "myriad", "in today's fast-paced world", "it's worth noting", "game-changer".
- NO están prohibidas. "Resiliencia" es la palabra exacta si el informe del Fondo Monetario habla de resiliencia. Lo que delata no es usarla una vez: es amontonarlas. Úsala si es LA palabra, en el sitio donde de verdad pega, y ninguna más. Si estás poniendo dos o tres de esas en la misma nota, es que no tienes nada concreto que decir en esa frase: dilo con las palabras de todos los días o quita la frase.
- Prefiere siempre lo concreto a lo abstracto: en vez de "impulsar el crecimiento", "vender más"; en vez de "optimizar recursos", "gastar menos"; en vez de "un ecosistema robusto", di qué tiene y para qué sirve.
- Nada de párrafos que empiezan todos igual ("Además,", "Sin embargo,", "Por otro lado,"), nada de listas donde cada punto arranca con una palabra en negrita y dos puntos, y nada de cerrar con "En resumen" o "En conclusión": la nota termina cuando termina lo que hay que contar.
- Un detalle humano vale más que un adjetivo: una cifra, una fecha, un nombre, algo que se pueda comprobar. Si un párrafo no aporta un dato nuevo, sobra.

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
{"es":{"title":"","excerpt":"","content_html":"","meta_title":"","meta_description":"","tags":[]},"en":{"title":"","excerpt":"","content_html":"","meta_title":"","meta_description":"","tags":[]},"kind":"news|evergreen","image_prompt":"","image_alt_es":"","image_alt_en":"","image_caption_es":"","image_caption_en":"","image_keywords":[],"wants_video":false,"video_keywords":[]}`;

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
  /**
   * Cuando esta nota es un capítulo más de algo que ya contamos (un terremoto del que ya dimos el
   * primer balance, una crisis que sigue). Lleva de qué nota es continuación y qué hay de nuevo.
   */
  seguimiento?: { de: string; novedades: readonly string[] };
  /** Titulares publicados estos días: para no titular parecido a algo que ya está en la portada. */
  yaPublicado?: readonly string[];
};

/** Bloque de notas nuestras para enlazar (rutas relativas, sin dominio). */
export function internalLinksBlock(links: readonly InternalLink[]): string {
  if (links.length === 0) return "";
  return `\n\nNOTAS NUESTRAS QUE PUEDES ENLAZAR (usa la ruta tal cual, sin dominio):\n${links
    .map((l) => `- ${l.title} → ${l.path}`)
    .join("\n")}`;
}

/** Nota universal: una noticia o guía duradera a partir de fuentes públicas. */
/**
 * El encargo de una pieza propia: curiosidades, errores o guía (ver `mesa.ts` e `ideas.ts`).
 *
 * Una lista de diez curiosidades NO se escribe como una noticia, y ese es justo el género donde una
 * IA se pone a inventar datos que suenan bien. Por eso este encargo insiste en lo mismo que el
 * resto —cada dato con su fuente— y añade una salida honesta: si con el material no se llega a diez,
 * se escriben las que haya. Mejor siete comprobadas que diez inventadas.
 */
export function buildPiezaPropiaPrompt(b: {
  titularPropuesto: string;
  genero: "curiosidades" | "errores" | "guia" | "ranking";
  sectionId: SectionId;
  sources: readonly SourceDoc[];
  internalLinks?: readonly InternalLink[];
}): string {
  const section = getSection(b.sectionId);
  const forma = {
    curiosidades:
      "Es una LISTA DE CURIOSIDADES. Cada punto va con su <h3> y dos o tres párrafos que cuenten el dato, de dónde sale y por qué sorprende. Que se lea como quien cuenta algo bueno en una sobremesa, no como una ficha de enciclopedia. El primer punto tiene que ser el más fuerte: es el que decide si siguen leyendo.",
    errores:
      "Es una LISTA DE ERRORES. Cada punto va con su <h3>: el error, por qué se comete, qué pasa cuando se comete y qué hacer en su lugar. Concreto y sin sermones: quien lee está cometiendo alguno de esos errores ahora mismo.",
    guia: "Es una GUÍA que sigue sirviendo dentro de un año. Pasos claros, con ejemplos y cifras reales.",
    ranking:
      "Es un RANKING con datos: responde la pregunta del titular con una lista ordenada, y **cada puesto lleva su cifra y de dónde sale**. Empieza contestando la pregunta en la primera frase, sin rodeos ni suspense — quien entra quiere el dato, no que se lo escondan. Después explica POR QUÉ es así, que es lo que hace que la nota valga la pena: qué hay detrás de ese número, desde cuándo, y qué está cambiando. Si el dato tiene matices (una cosa es lo más vendido en unidades y otra en dinero), dilo: ahí está la parte interesante.",
  }[b.genero];
  return `ENCARGO: pieza propia para la sección "${section?.name.es ?? b.sectionId}".
TITULAR PROPUESTO: ${b.titularPropuesto}
FORMA: ${forma}

LARGO: entre 700 y 1.100 palabras en CADA idioma, igual que cualquier nota del diario. Una lista de
diez puntos con dos líneas cada uno no es una nota, es un tuit largo: cada punto necesita su párrafo
o dos, con el dato, de dónde sale y por qué importa.

REGLAS DE ESTE GÉNERO (van en serio):
- Cada dato, cifra o fecha sale del material de abajo y se cita con su enlace. NADA de memoria propia.
- Si el material no da para diez puntos, escribe los que sí puedas documentar y ajusta el titular al
  número real. Siete comprobadas valen más que diez inventadas.
- Puedes mejorar el titular propuesto si se te ocurre uno mejor, pero mantén el tema y el número.
- TITULARES: el gancho está en el TEMA, no en el adjetivo. «El producto más vendido del mundo lleva
  2.000 años ganando» engancha; «la respuesta te sorprenderá» hace que no te lean nunca más. Si sabes
  el dato, puedes ponerlo en el titular: quien lo lea entrará igual, y quien no, tampoco iba a entrar.
  Prohibido el suspense vacío, las mayúsculas de más y los signos de admiración.
- Nada de rellenar con obviedades para llegar a la cuenta.

MATERIAL:
${sourcesBlock(b.sources)}${internalLinksBlock(b.internalLinks ?? [])}`;
}

export function buildUniversalPrompt(b: UniversalBrief): string {
  const section = getSection(b.sectionId);
  const kindText =
    b.kind === "evergreen"
      ? "Escribe una GUÍA DURADERA (cómo hacer, qué saber, lista o comparativa) que siga sirviendo dentro de un año, usando la noticia solo como punto de partida."
      : "Escribe la NOTICIA DEL DÍA: qué pasó, a quién afecta, qué sigue. El titular dice QUÉ PASÓ, con el dato más fuerte. No lo titules como una guía («una guía para entender…», «todo lo que hay que saber sobre…»): eso es otro género y confunde a quien lo ve en la portada.";
  return `ENCARGO: nota para la sección "${section?.name.es ?? b.sectionId}".
TEMA: ${b.topicTitle}
${b.topicSummary ? `RESUMEN DEL TEMA: ${b.topicSummary}` : ""}
TIPO: ${kindText}
${bloqueSeguimiento(b.seguimiento)}${bloqueYaPublicado(b.yaPublicado ?? [])}
Usa SOLO el material de abajo. Si las fuentes se contradicen, dilo. Cita cada fuente con enlace donde uses su dato.

MATERIAL:
${sourcesBlock(b.sources)}${internalLinksBlock(b.internalLinks ?? [])}`;
}

/**
 * Cuando la noticia sigue viva y esto es un capítulo más.
 *
 * Un diario cuenta un terremoto muchos días seguidos, y está bien: hoy son las víctimas, mañana la
 * ayuda que llega, pasado lo que dijo el gobierno. Lo que NO vale es volver a contar lo de ayer con
 * otras palabras. Por eso aquí se le dice al redactor **qué es lo nuevo** y se le exige empezar por
 * ahí, en vez de repetir el contexto desde el principio como si nadie hubiera leído nada.
 */
export function bloqueSeguimiento(s: UniversalBrief["seguimiento"]): string {
  if (!s) return "";
  const nuevo = s.novedades.slice(0, 8).join(", ");
  return `
ESTO ES UN CAPÍTULO MÁS, NO UNA NOTA NUEVA.
Ya publicamos: «${s.de}».
Lo que ha cambiado desde entonces: ${nuevo || "hay datos nuevos en el material"}.
- **Empieza por lo nuevo**, en la primera frase. Quien nos lee a diario ya sabe lo de ayer.
- El contexto de lo anterior va DESPUÉS y en dos frases como mucho, para quien llega ahora.
- El titular tiene que dejar claro qué avanzó (la cifra nueva, la decisión nueva), no repetir el de la nota anterior.
`;
}

/**
 * Los titulares que ya están en la portada. No es para prohibir temas —de eso se encarga el archivo
 * antes de llegar aquí—, sino para que dos notas seguidas no se titulen igual.
 */
export function bloqueYaPublicado(titulares: readonly string[]): string {
  if (titulares.length === 0) return "";
  return `
YA ESTÁ EN LA PORTADA (no repitas su titular ni su enfoque):
${titulares
  .slice(0, 12)
  .map((t) => `- ${t}`)
  .join("\n")}
`;
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
/** Corta un texto en el último espacio antes del límite, para no partir una palabra por la mitad. */
export function recortar(texto: string, max: number): string {
  const t = texto.trim();
  if (t.length <= max) return t;
  const corte = t.slice(0, max);
  const espacio = corte.lastIndexOf(" ");
  return (espacio > max * 0.6 ? corte.slice(0, espacio) : corte).replace(/[\s,;:.\-–—]+$/, "");
}

/**
 * Ajusta lo que se puede ajustar antes de validar.
 *
 * El 24 ago 2026 una nota entera —dos idiomas, 1.100 palabras, bien escrita y ya pagada— se tiró a
 * la basura porque la descripción para Google traía 183 caracteres en vez de 180. Eso es absurdo:
 * un campo de metadatos se recorta y ya está.
 *
 * La regla es la que tiene sentido para un diario: **lo que el lector lee se respeta; lo que solo
 * ven los buscadores se ajusta**. El titular y el cuerpo siguen siendo estrictos —si vienen mal, la
 * nota se rehace—, pero la meta descripción, el meta título, la entradilla, los textos de la imagen
 * y el número de etiquetas se recortan sin preguntar.
 */
export function ajustarMetadatos(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const d = { ...(raw as Record<string, unknown>) };
  for (const lang of ["es", "en"] as const) {
    const parte = d[lang];
    if (typeof parte !== "object" || parte === null) continue;
    const p = { ...(parte as Record<string, unknown>) };
    if (typeof p.meta_description === "string")
      p.meta_description = recortar(p.meta_description, 180);
    if (typeof p.meta_title === "string") p.meta_title = recortar(p.meta_title, 95);
    if (typeof p.excerpt === "string") p.excerpt = recortar(p.excerpt, 420);
    if (Array.isArray(p.tags)) {
      p.tags = p.tags
        .filter((t): t is string => typeof t === "string" && t.trim().length >= 2)
        .map((t) => recortar(t, 40))
        .slice(0, 8);
    }
    d[lang] = p;
  }
  for (const campo of ["image_alt_es", "image_alt_en"] as const) {
    if (typeof d[campo] === "string") d[campo] = recortar(d[campo] as string, 200);
  }
  for (const campo of ["image_caption_es", "image_caption_en"] as const) {
    if (typeof d[campo] === "string") d[campo] = recortar(d[campo] as string, 220);
  }
  if (typeof d.image_prompt === "string") d.image_prompt = recortar(d.image_prompt, 500);
  if (Array.isArray(d.image_keywords)) d.image_keywords = d.image_keywords.slice(0, 5);
  if (Array.isArray(d.video_keywords)) d.video_keywords = d.video_keywords.slice(0, 4);
  return d;
}

export function finalizeDraft(
  raw: unknown,
  // Acepta las fuentes en crudo (cómodo para las pruebas y para `manual.ts`) o el índice ya
  // calculado, que es lo que usa el redactor para no rehacerlo en cada reintento.
  fuentesOIndice: readonly string[] | ReadonlySet<string>,
): Draft {
  const fuentes =
    fuentesOIndice instanceof Set ? fuentesOIndice : sourceShingles(fuentesOIndice as string[]);
  const parsed = draftSchema.safeParse(ajustarMetadatos(raw));
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
    const ratio = copyRatioContra(stripHtml(part.content_html), fuentes);
    if (ratio > MAX_COPY_RATIO) {
      throw new DraftRejectedError(
        `El borrador en ${lang} copia fuentes (${(ratio * 100).toFixed(1)} % de fragmentos)`,
      );
    }
  }
  // ¿Suena a máquina? Se mira el titular, la entradilla y el cuerpo juntos: el tic más caro es el
  // del titular, que es lo único que mucha gente llega a leer.
  const sonido = revisarSonidoHumano(
    `${es.title}. ${es.excerpt} ${stripHtml(es.content_html)}`,
    `${en.title}. ${en.excerpt} ${stripHtml(en.content_html)}`,
    undefined,
    { es: es.title, en: en.title },
  );
  if (sonido) throw new DraftRejectedError(`suena a IA — ${sonido}`);
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
  // Un reintento. Se quitó por la tarde del 24 ago 2026 creyendo que la corrida moría por tardar
  // demasiado; resultó que moría por otra cosa (candado 21) y, ya arreglada, una corrida entera
  // tarda 33 segundos: caben dos llamadas de sobra. Y hace falta, porque el modelo a veces devuelve
  // un campo fuera de medida y sin reintento eso tira la nota entera.
  const maxAttempts = Math.max(1, (opts.retries ?? 1) + 1);
  // Una sola vez para toda la corrida, pase lo que pase con los reintentos.
  const fuentes = sourceShingles(sourceTexts);
  let last: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const motivo = last instanceof Error ? last.message : "";
    const copiaba = motivo.includes("copia fuentes");
    const sonabaAMaquina = motivo.includes("suena a IA");
    const aviso =
      attempt === 1
        ? ""
        : sonabaAMaquina
          ? `\n\nAVISO IMPORTANTE: ${motivo.replace("suena a IA — ", "")}`
          : copiaba
            ? `\n\nAVISO IMPORTANTE: el intento anterior fue rechazado porque repetía frases de las fuentes (${motivo}). Vuelve a escribirla DESDE CERO con tus propias palabras y tu propia estructura: cambia el orden de las ideas, parte y une las frases, y no copies ni una expresión de más de siete palabras seguidas. Los nombres propios y las cifras sí se mantienen.`
            : motivo.includes("muy corto")
              ? `\n\nAVISO IMPORTANTE: el intento anterior se rechazó porque el cuerpo era DEMASIADO CORTO (${motivo}). El mínimo son 450 palabras por idioma y lo normal son entre 700 y 1.100. Desarrolla cada punto: el dato, de dónde sale, un ejemplo y por qué le importa a quien lee. No es un resumen, es una nota de diario.`
              : `\n\nAVISO IMPORTANTE: el intento anterior se rechazó por formato (${motivo}). Devuelve EXACTAMENTE el JSON pedido, con todos los campos y respetando los largos: título entre 20 y 170 caracteres, extracto entre 60 y 420, cuerpo de 700 a 1.100 palabras, meta_title entre 15 y 95, meta_description entre 50 y 180, y entre 3 y 8 etiquetas de 2 a 40 caracteres cada una. No cortes el JSON.`;
    const usage = await generateJson<unknown>({
      apiKey: opts.apiKey,
      model: opts.model ?? WRITER_MODEL,
      system: SYSTEM_PROMPT,
      prompt: prompt + aviso,
      temperature: attempt === 1 ? 0.7 : 0.9,
      // Dos idiomas de 700-1.100 palabras con HTML no caben en 16.000 tokens con holgura, y si la
      // respuesta se corta el JSON queda roto y la nota se pierde entera. Gemini 2.5 Flash admite
      // mucho más; el costo va por tokens usados, no por el límite, así que subirlo no cuesta nada
      // salvo cuando de verdad hace falta.
      maxOutputTokens: 32_000,
      responseSchema: DRAFT_RESPONSE_SCHEMA,
      fetchImpl: opts.fetchImpl,
    });
    try {
      return { draft: finalizeDraft(usage.data, fuentes), usage, attempts: attempt };
    } catch (error) {
      last = error;
      if (attempt === maxAttempts) throw error;
    }
  }
  /* istanbul ignore next: el bucle sale por return o por throw */
  throw last;
}
