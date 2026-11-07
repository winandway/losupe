import { z } from "zod";
import { stripHtml } from "@/lib/html";
import { pingIndexNow } from "@/lib/indexnow";
import { HOUSE_SECTION_ID } from "@/lib/sections";
import { absoluteUrl, articlePath } from "@/lib/urls";
import { assertBudget, recordSpend, todayKey } from "@/lib/robot/budget";
import { generateJson } from "@/lib/robot/gemini";
import { saveArticle, setArticleStatus } from "@/lib/robot/publish";
import { cleanEditorialHtml, WRITER_MODEL, type Draft } from "@/lib/robot/writer";
import { conAviso } from "./aviso";
import { PRODUCTOS, type Producto } from "./productos";

/**
 * EL PASO DIARIO DE «DESDE WINDOCE» (docs/DESDE-WINDOCE.md, candado 57).
 *
 * Corre al final de cada corrida del robot y hace dos cosas, cada una como mucho UNA vez al día:
 *
 *  1. PUBLICA la nota de la casa que toca: la más vieja de las aprobadas (`approved`), si hoy no ha
 *     salido ninguna. Así, aunque Richard apruebe siete de golpe, sale una por día, alternada con las
 *     noticias. El medio sigue siendo un medio.
 *  2. ESCRIBE la siguiente: el producto y el formato que tocan en la rotación, con las reglas de la
 *     casa, y la deja PARA REVISIÓN. Hasta que haya cinco aprobadas, todas esperan a Richard; después
 *     entran solas a la fila de aprobadas (y siguen pasando por el candado del aviso).
 *
 * Presupuesto de la base: unas pocas lecturas por corrida y, el día que escribe, una nota (artículo,
 * dos idiomas, una fila en `house_notes` y el índice de búsqueda). Nada en bucle.
 */

export const FORMATOS = ["lanzamiento", "historia", "tendencia", "como"] as const;
export type Formato = (typeof FORMATOS)[number];

const GUIA_FORMATO: Record<Formato, string> = {
  lanzamiento:
    "EL LANZAMIENTO. Titular informativo del tipo «Empresa de Michigan lanza X, una herramienta para…». Qué es, en qué punto está HOY (solo lo que dice la ficha: si dice «próximamente», se dice próximamente), qué promete y a quién le sirve.",
  historia:
    "LA HISTORIA DE USO. Una persona con un problema común y cómo lo resuelve. NO hay usuarios reales con permiso: la persona es DE EJEMPLO y se presenta así desde la primera frase («Imagina a Laura, que…» / «Picture Laura, who…»). Nunca «caso real», nunca citas entre comillas atribuidas a ella como si fueran testimonio.",
  tendencia:
    "LA TENDENCIA. Un tema del mercado que de verdad está pasando (crear videos con IA, vender por chat, guardar archivos en la nube, comprar en otro país, cripto con autocustodia…), explicado en general, y al final dónde encaja el producto como una opción. Sin cifras del mercado si no vienen en la ficha.",
  como: "EL CÓMO. Una guía útil paso a paso («cómo grabar tu pantalla gratis», «cómo respaldar las fotos de tu negocio»). El producto es UNA de las opciones, no la única: los pasos sirven aunque el lector use otra herramienta. Sin nombrar a la competencia.",
};

export function siguienteTurno(n: number): { producto: Producto; formato: Formato } {
  const i = Math.max(0, Math.floor(n));
  return {
    producto: PRODUCTOS[i % PRODUCTOS.length] as Producto,
    formato: FORMATOS[i % FORMATOS.length] as Formato,
  };
}

const SYSTEM_CASA = `Eres redactor de losupe.com, un medio bilingüe. Escribes la sección «Desde Windoce»: contenido de la casa sobre los productos de Windoce LLC, la empresa dueña del medio. El estilo es «vender sin vender»: se cuenta una historia útil, no se escribe un anuncio.

REGLAS QUE NO SE NEGOCIAN:
1. Solo afirmas lo que está en la FICHA que te pasan. Nada de cifras de usuarios, ventas, premios, prensa, inversionistas ni ciudades donde opera si la ficha no lo dice. Si no hay dato, hablas de lo que hace el producto.
2. Las personas son de ejemplo y se presentan como ejemplo («Imagina a…»). Prohibido inventar testimonios o «casos reales».
3. Nada de «¡compra ya!», ofertas, urgencia ni listas de precios. Un precio o un plan gratis se menciona en UNA frase solo si viene al caso.
4. No hables mal de la competencia ni la nombres.
5. No escribas el aviso de contenido de la casa ni pongas enlaces: los pone el sistema. Tampoco firmes.
6. Productos financieros (cripto): cero consejos de inversión, cero promesas de ganancia; recuerda que las criptomonedas son volátiles.
7. Voz humana de diario: frases claras, sin muletillas de IA («en el mundo actual», «sin duda», «revolucionario», «descubre», «en conclusión»). Español neutro de EE. UU. con «tú»; el inglés escrito como nativo, no traducido.
8. HTML simple: <p>, <h2>, <ul>, <li>, <strong>, <em>. Entre 450 y 700 palabras por idioma.

Devuelves también los textos para redes de esa nota, en español, sin enlaces (Richard pega el enlace): Facebook e Instagram (título + texto de 2 a 4 frases), TikTok (texto corto con 3 a 5 etiquetas), YouTube Shorts (título de menos de 70 caracteres + descripción + etiquetas separadas por comas) y estado de WhatsApp (una o dos frases). Ninguno promete nada que no esté en la ficha.`;

export function promptCasa(p: Producto, formato: Formato): string {
  return `PRODUCTO: ${p.nombre} (${p.url})
FORMATO: ${GUIA_FORMATO[formato]}

FICHA (comprobada en su página el ${p.verificado}; es lo ÚNICO que puedes afirmar):
- Qué es: ${p.queEs.es}
- Para quién: ${p.paraQuien.es}
- Datos:
${p.datos.es.map((d) => `  · ${d}`).join("\n")}
${p.cuidado ? `- CUIDADO: ${p.cuidado}` : ""}

Escribe la nota en español y en inglés, con título, extracto, cuerpo en HTML, meta título, meta descripción y de 3 a 6 etiquetas, más los textos para redes.`;
}

const T = { type: "STRING" } as const;
const LANG = {
  type: "OBJECT",
  properties: {
    title: T,
    excerpt: T,
    content_html: T,
    meta_title: T,
    meta_description: T,
    tags: { type: "ARRAY", items: T },
  },
  required: ["title", "excerpt", "content_html", "meta_title", "meta_description", "tags"],
} as const;
export const CASA_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    es: LANG,
    en: LANG,
    redes: {
      type: "OBJECT",
      properties: {
        facebook_instagram: {
          type: "OBJECT",
          properties: { titulo: T, texto: T },
          required: ["titulo", "texto"],
        },
        tiktok: T,
        youtube: {
          type: "OBJECT",
          properties: { titulo: T, descripcion: T, etiquetas: T },
          required: ["titulo", "descripcion", "etiquetas"],
        },
        whatsapp: T,
      },
      required: ["facebook_instagram", "tiktok", "youtube", "whatsapp"],
    },
  },
  required: ["es", "en", "redes"],
} as const;

const langCasa = z.object({
  title: z.string().min(20).max(170),
  excerpt: z.string().min(40).max(420),
  content_html: z.string().min(1200),
  meta_title: z.string().min(10).max(95),
  meta_description: z.string().min(40).max(180),
  tags: z.array(z.string().min(2).max(40)).min(2).max(8),
});
export const casaSchema = z.object({
  es: langCasa,
  en: langCasa,
  redes: z.object({
    facebook_instagram: z.object({ titulo: z.string().min(5), texto: z.string().min(20) }),
    tiktok: z.string().min(10),
    youtube: z.object({
      titulo: z.string().min(5).max(100),
      descripcion: z.string().min(20),
      etiquetas: z.string().min(3),
    }),
    whatsapp: z.string().min(10),
  }),
});
export type NotaCasa = z.infer<typeof casaSchema>;

/** Lo que una nota de la casa no puede decir nunca (reglas 1 a 4 de docs/DESDE-WINDOCE.md). */
const PROHIBIDO: readonly RegExp[] = [
  /\b(miles|millones|cientos) de (usuarios|clientes|personas que (ya )?(lo|la) usan)\b/i,
  /\b(thousands|millions|hundreds) of (users|customers)\b/i,
  /\bc[oó]mpra(lo)? ya\b/i,
  /\bbuy (it )?now\b/i,
  /\bcaso real\b/i,
  /\breal(-life)? (customer|user) story\b/i,
  /\boferta por tiempo limitado\b|\blimited[- ]time offer\b/i,
];

export class NotaCasaRechazada extends Error {
  constructor(motivo: string) {
    super(`Nota de la casa rechazada: ${motivo}`);
    this.name = "NotaCasaRechazada";
  }
}

export function enlaceFinal(p: Producto, lang: "es" | "en"): string {
  const texto =
    lang === "es"
      ? `Más información en la página de ${p.nombre}`
      : `Learn more on ${p.nombre}'s site`;
  return `<p><a href="${p.url}" target="_blank" rel="sponsored noopener">${texto}</a>.</p>`;
}

/**
 * Deja el cuerpo listo: HTML limpio, SIN los enlaces que haya puesto el modelo, con el aviso arriba
 * y un solo enlace al producto al final (con `rel="sponsored"`). Lanza si dice algo prohibido.
 */
export function prepararCuerpo(html: string, p: Producto, lang: "es" | "en"): string {
  const limpio = cleanEditorialHtml(html)
    .replace(/<a\b[^>]*>/gi, "")
    .replace(/<\/a>/gi, "");
  const texto = stripHtml(limpio);
  for (const re of PROHIBIDO) {
    if (re.test(texto)) throw new NotaCasaRechazada(`dice algo prohibido (${re.source})`);
  }
  return conAviso(`${limpio}\n${enlaceFinal(p, lang)}`, p, lang);
}

export function finalizarNotaCasa(raw: unknown, p: Producto): NotaCasa {
  const parsed = casaSchema.safeParse(raw);
  if (!parsed.success) throw new NotaCasaRechazada(`formato: ${parsed.error.issues[0]?.message}`);
  const d = parsed.data;
  for (const lang of ["es", "en"] as const) {
    const titulo = `${d[lang].title} ${d[lang].excerpt}`;
    for (const re of PROHIBIDO) {
      if (re.test(titulo)) throw new NotaCasaRechazada(`titular prohibido (${re.source})`);
    }
  }
  const redes = JSON.stringify(d.redes);
  for (const re of PROHIBIDO) {
    if (re.test(redes)) throw new NotaCasaRechazada(`texto para redes prohibido (${re.source})`);
  }
  return {
    ...d,
    es: { ...d.es, content_html: prepararCuerpo(d.es.content_html, p, "es") },
    en: { ...d.en, content_html: prepararCuerpo(d.en.content_html, p, "en") },
  };
}

export type CasaEnv = {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

export type PasoCasaResultado = {
  publicada: string | null;
  escrita: string | null;
  motivo: string;
};

/** Cuántas notas de la casa aprobó ya Richard (aprobadas en fila o publicadas). */
async function aprobadas(db: D1Database): Promise<number> {
  const r = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM articles WHERE section_id = ?1 AND status IN ('approved', 'published')`,
    )
    .bind(HOUSE_SECTION_ID)
    .first<{ n: number }>();
  return Number(r?.n ?? 0);
}

/** Las aprobadas necesarias antes de que el robot deje de pedir revisión. */
export const APROBADAS_PARA_SOLTAR = 5;
/** Si ya hay estas notas esperando a Richard, no se escriben más (no se amontonan). */
export const TOPE_EN_REVISION = 7;

export async function pasoCasa(
  env: CasaEnv,
  opts: { now?: Date; fetchImpl?: typeof fetch; runId?: string; base?: string } = {},
): Promise<PasoCasaResultado> {
  const now = opts.now ?? new Date();
  const hoy = `${todayKey(now)}T00:00:00.000Z`;
  const db = env.DB;
  let publicada: string | null = null;

  // 1) Publicar la que toca, si hoy no salió ninguna.
  const salioHoy = await db
    .prepare(
      `SELECT 1 AS x FROM articles WHERE section_id = ?1 AND status = 'published' AND published_at >= ?2 LIMIT 1`,
    )
    .bind(HOUSE_SECTION_ID, hoy)
    .first();
  if (!salioHoy) {
    const fila = await db
      .prepare(
        `SELECT id FROM articles WHERE section_id = ?1 AND status = 'approved' ORDER BY created_at ASC LIMIT 1`,
      )
      .bind(HOUSE_SECTION_ID)
      .first<{ id: string }>();
    if (fila) {
      await setArticleStatus(db, fila.id, "published", now); // pasa por el candado del aviso
      publicada = fila.id;
      const base = (opts.base ?? env.NEXT_PUBLIC_SITE_URL ?? "https://losupe.com").replace(
        /\/$/,
        "",
      );
      const { results } = await db
        .prepare(`SELECT lang, slug FROM article_i18n WHERE article_id = ?1`)
        .bind(fila.id)
        .all<{ lang: "es" | "en"; slug: string }>();
      await pingIndexNow(
        base,
        results.map((r) => absoluteUrl(base, articlePath(r.lang, HOUSE_SECTION_ID, r.slug))),
      ).catch(() => undefined);
    }
  }

  // 2) Escribir la siguiente.
  if (!env.GEMINI_API_KEY) return { publicada, escrita: null, motivo: "sin_llave" };
  const escritaHoy = await db
    // Se compara solo la fecha: `created_at` puede venir como «2026-11-07 12:00:00» (valor por
    // defecto de la tabla) o como «2026-11-07T12:00:00Z» (semillas); el texto completo no compara bien.
    .prepare(`SELECT 1 AS x FROM house_notes WHERE substr(created_at, 1, 10) >= ?1 LIMIT 1`)
    .bind(todayKey(now))
    .first();
  if (escritaHoy) return { publicada, escrita: null, motivo: "ya_escrita_hoy" };
  const enRevision = await db
    .prepare(`SELECT COUNT(*) AS n FROM articles WHERE section_id = ?1 AND status = 'review'`)
    .bind(HOUSE_SECTION_ID)
    .first<{ n: number }>();
  if (Number(enRevision?.n ?? 0) >= TOPE_EN_REVISION)
    return { publicada, escrita: null, motivo: "esperando_revision" };
  await assertBudget(db, 0.02, now);

  const total = await db.prepare(`SELECT COUNT(*) AS n FROM house_notes`).first<{ n: number }>();
  const { producto, formato } = siguienteTurno(Number(total?.n ?? 0));
  const usage = await generateJson<unknown>({
    apiKey: env.GEMINI_API_KEY,
    model: WRITER_MODEL,
    system: SYSTEM_CASA,
    prompt: promptCasa(producto, formato),
    temperature: 0.7,
    maxOutputTokens: 24_000,
    responseSchema: CASA_RESPONSE_SCHEMA,
    fetchImpl: opts.fetchImpl,
  });
  await recordSpend(
    db,
    {
      provider: "gemini",
      model: usage.model,
      units: usage.inputTokens + usage.outputTokens,
      costUsd: usage.costUsd,
      runId: opts.runId,
    },
    now,
  );
  const nota = finalizarNotaCasa(usage.data, producto);
  const status = (await aprobadas(db)) >= APROBADAS_PARA_SOLTAR ? "approved" : "review";
  const draft = {
    es: nota.es,
    en: nota.en,
    kind: "evergreen",
    image_prompt: producto.nombre,
    image_alt_es: `${producto.nombre}: imagen oficial del producto`,
    image_alt_en: `${producto.nombre}: official product image`,
    image_caption_es: "",
    image_caption_en: "",
    image_keywords: [producto.nombre],
    wants_video: false,
    video_keywords: [],
  } satisfies Draft;
  const guardada = await saveArticle(db, {
    draft,
    sectionId: HOUSE_SECTION_ID,
    authorId: "equipo-losupe",
    origin: "casa",
    // Nunca `published` directo: o espera a Richard o entra a la fila de aprobadas (y el paso 1 la
    // publica otro día, pasando por el candado del aviso).
    status,
    sources: [{ title: producto.nombre, url: producto.url }],
    image: { url: producto.imagen, credit: `© ${producto.nombre}` },
    runId: opts.runId,
    now,
  });
  await db
    .prepare(
      `INSERT OR REPLACE INTO house_notes (article_id, product_id, format, social_json) VALUES (?1, ?2, ?3, ?4)`,
    )
    .bind(guardada.articleId, producto.id, formato, JSON.stringify(nota.redes))
    .run();
  return { publicada, escrita: guardada.articleId, motivo: status };
}
