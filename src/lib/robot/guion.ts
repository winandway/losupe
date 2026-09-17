import { stripHtml } from "@/lib/html";
import { SQL_NOW } from "@/lib/sql-time";
import { assertBudget, BudgetExceededError, recordSpend } from "./budget";
import { filtrarSabiasQue } from "@/lib/sabias-que";
import { generateJson } from "./gemini";

export { filtrarSabiasQue } from "@/lib/sabias-que";

/**
 * EL GUION PARA CREADORES Y EL «¿SABÍAS QUÉ?».
 *
 * Idea de Richard (17 sep 2026): mucha gente hace videos cortos —Reels, Shorts, TikTok— leyendo un
 * guion en el teleprompter del celular. Si cada nota trae ese guion ya escrito y listo para copiar,
 * los creadores entran a losupe a buscar material, graban con nuestras noticias y dicen dónde lo
 * leyeron. Material para ellos, visitas y marca para el diario.
 *
 * Y el «¿Sabías qué?»: uno o dos datos curiosos de la nota, de los que se quedan en la cabeza y se
 * cuentan en un video. **Solo cuando la nota los tiene.** Una noticia de aranceles no siempre trae
 * un dato curioso, y forzarlo es inventarlo.
 *
 * TRES REGLAS, y las tres protegen al diario:
 *  1. **No se inventa nada.** El guion y los datos salen SOLO del texto de la nota. Un creador va a
 *     repetir esto delante de miles de personas: un dato inventado ahí es una mentira multiplicada,
 *     con nuestro nombre al final. Por eso las cifras del «¿Sabías qué?» se comprueban contra el
 *     cuerpo, y el dato que traiga una cifra que no está en la nota se tira.
 *  2. **Nunca frena una publicación.** Se genera DESPUÉS, en una llamada aparte. Si falla, la nota
 *     sale igual, solo que sin el bloque.
 *  3. **Nombra la fuente original** y cierra con losupe. Quien lo grabe cita bien sin pensarlo.
 */

/** Ritmo de lectura en voz alta para video: unas 150 palabras por minuto. */
export const PALABRAS_POR_MINUTO = 150;
/** Un guion de un minuto a unos tres. Por debajo no da para video; por encima nadie lo termina. */
export const PALABRAS_MIN = 110;
export const PALABRAS_MAX = 480;

export type Guion = {
  guion_es: string;
  guion_en: string;
  sabias_que_es: string[];
  sabias_que_en: string[];
};

export const ESQUEMA_GUION = {
  type: "object",
  properties: {
    guion_es: { type: "string" },
    guion_en: { type: "string" },
    sabias_que_es: { type: "array", items: { type: "string" } },
    sabias_que_en: { type: "array", items: { type: "string" } },
  },
  required: ["guion_es", "guion_en", "sabias_que_es", "sabias_que_en"],
} as const;

export const SISTEMA_GUION = `Eres guionista de videos cortos de noticias (Reels, Shorts, TikTok). Te dan una nota ya publicada y escribes:

1) UN GUION para leer en voz alta en un teleprompter, en español y en inglés.
2) HASTA DOS datos para una sección «¿Sabías qué?», en español y en inglés. O NINGUNO.

EL GUION:
- Entre 150 y 400 palabras: de un minuto a dos minutos y medio leído con calma.
- La primera frase es el gancho: lo más sorprendente o útil de la nota, dicho en una línea. Nada de «hola a todos» ni «hoy te traigo».
- Frases cortas, para respirar. Una idea por frase. Se escribe como se habla.
- Nada de enlaces, paréntesis, viñetas, asteriscos, emojis ni símbolos. Solo texto que se lee.
- Las cifras, como se dicen: «casi el cuarenta por ciento», no «39,7 %».
- Nombra la fuente original que cita la nota («según Reuters», «de acuerdo con la Reserva Federal»).
- Termina con una frase de cierre y, en línea aparte, exactamente: «Lo leí en losupe.com» (en inglés: «I read it on losupe.com»).
- El inglés no es una traducción literal: es el mismo guion escrito como lo diría un presentador de Estados Unidos.

EL «¿SABÍAS QUÉ?»:
- Solo datos curiosos, sorprendentes o poco conocidos QUE ESTÉN EN LA NOTA.
- Cada uno empieza con «¿Sabías que…» (en inglés «Did you know…») y cabe en una o dos frases.
- Aquí las cifras van CON NÚMEROS («en 2017», «el 40 %»), NO en letras: este bloque se lee en la pantalla, no en voz alta.
- Si la nota no tiene un dato así, devuelve las listas VACÍAS. Es mejor ninguno que uno forzado.

LA REGLA QUE NO SE ROMPE:
- NO INVENTES NADA. Ni una cifra, ni un nombre, ni una fecha, ni un hecho que no esté en el texto de la nota. Un creador va a repetir esto delante de miles de personas.`;

/** Cuántas palabras tiene un texto. */
export function contarPalabras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

/** Lo que dura leído en voz alta, en segundos. */
export function duracionSegundos(texto: string): number {
  return Math.round((contarPalabras(texto) / PALABRAS_POR_MINUTO) * 60);
}

/** «1 min 40 s» / «1 min 40 sec». */
export function duracionLegible(texto: string, lang: "es" | "en" = "es"): string {
  const total = duracionSegundos(texto);
  const min = Math.floor(total / 60);
  const seg = total % 60;
  const s = lang === "en" ? "sec" : "s";
  if (min === 0) return `${seg} ${s}`;
  return seg === 0 ? `${min} min` : `${min} min ${seg} ${s}`;
}

const CIERRE = { es: "Lo leí en losupe.com", en: "I read it on losupe.com" } as const;

/**
 * Deja el guion listo para un teleprompter: sin enlaces ni símbolos de formato, con los párrafos
 * separados, y con el cierre de losupe aunque el modelo se lo haya saltado.
 */
export function limpiarGuion(texto: string, lang: "es" | "en"): string {
  const limpio = texto
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[*_#`>|]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[ \t]+/g, " ")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
  const cierre = CIERRE[lang];
  return limpio.toLowerCase().includes(cierre.toLowerCase()) ? limpio : `${limpio}\n\n${cierre}`;
}

export type ResultadoGuion = { guion: Guion; costUsd: number } | null;

/**
 * Pide el guion al modelo y lo valida. Devuelve `null` si no hay llave, si falla, o si el guion no
 * sirve (demasiado corto o largo): un guion malo es peor que ninguno.
 */
export async function generarGuion(opts: {
  apiKey?: string;
  titulo: string;
  entradilla?: string | null;
  cuerpoHtml: string;
  fuentes?: readonly string[];
  fetchImpl?: typeof fetch;
}): Promise<ResultadoGuion> {
  if (!opts.apiKey) return null;
  const cuerpo = stripHtml(opts.cuerpoHtml).slice(0, 9000);
  if (contarPalabras(cuerpo) < 80) return null;
  try {
    const r = await generateJson<Guion>({
      apiKey: opts.apiKey,
      model: "gemini-2.5-flash",
      system: SISTEMA_GUION,
      prompt: `TITULAR: ${opts.titulo}
${opts.entradilla ? `ENTRADILLA: ${opts.entradilla}\n` : ""}${opts.fuentes?.length ? `FUENTES QUE CITA LA NOTA: ${opts.fuentes.join(", ")}\n` : ""}
TEXTO DE LA NOTA:
${cuerpo}`,
      responseSchema: ESQUEMA_GUION,
      temperature: 0.6,
      maxOutputTokens: 4096,
      timeoutMs: 60_000,
      fetchImpl: opts.fetchImpl,
    });
    const es = limpiarGuion(r.data.guion_es ?? "", "es");
    const en = limpiarGuion(r.data.guion_en ?? "", "en");
    const valido = (t: string) =>
      contarPalabras(t) >= PALABRAS_MIN && contarPalabras(t) <= PALABRAS_MAX;
    if (!valido(es) || !valido(en)) return null;
    return {
      guion: {
        guion_es: es,
        guion_en: en,
        sabias_que_es: filtrarSabiasQue(r.data.sabias_que_es ?? [], cuerpo),
        sabias_que_en: filtrarSabiasQue(r.data.sabias_que_en ?? [], cuerpo),
      },
      costUsd: r.costUsd,
    };
  } catch {
    return null;
  }
}

export type ResultadoRescateGuiones = { encontradas: number; hechas: number; errores: string[] };

/**
 * Les escribe el guion a las notas publicadas que no lo tienen: las que salen nuevas y las que ya
 * estaban. Pocas por corrida, las más recientes primero, dentro del tope de gasto diario.
 *
 * Nunca lanza: esto corre por detrás de la publicación.
 */
export async function rescatarGuiones(
  db: D1Database,
  env: { GEMINI_API_KEY?: string },
  opts: { limite?: number; fetchImpl?: typeof fetch; runId?: string } = {},
): Promise<ResultadoRescateGuiones> {
  const out: ResultadoRescateGuiones = { encontradas: 0, hechas: 0, errores: [] };
  if (!env.GEMINI_API_KEY) return out;
  try {
    const { results } = await db
      .prepare(
        `SELECT a.id, a.sources_json,
                es.title AS title, es.excerpt AS excerpt, es.content_html AS content_html,
                (SELECT 1 FROM article_i18n WHERE article_id = a.id AND lang = 'en') AS tiene_en
           FROM articles a
           JOIN article_i18n es ON es.article_id = a.id AND es.lang = 'es'
          WHERE a.status = 'published' AND (es.guion IS NULL OR es.guion = '')
          ORDER BY a.published_at DESC
          LIMIT ?1`,
      )
      .bind(opts.limite ?? 4)
      .all<{
        id: string;
        sources_json: string | null;
        title: string;
        excerpt: string | null;
        content_html: string;
        tiene_en: number | null;
      }>();
    out.encontradas = results?.length ?? 0;

    for (const nota of results ?? []) {
      try {
        // Cada guion cuesta menos de un centavo, pero el tope diario manda sobre todo.
        await assertBudget(db, 0.01);
        const fuentes = leerFuentes(nota.sources_json);
        const r = await generarGuion({
          apiKey: env.GEMINI_API_KEY,
          titulo: nota.title,
          entradilla: nota.excerpt,
          cuerpoHtml: nota.content_html,
          fuentes,
          fetchImpl: opts.fetchImpl,
        });
        if (!r) {
          out.errores.push(`${nota.id}: guion no válido o sin respuesta`);
          continue;
        }
        await recordSpend(db, {
          provider: "gemini",
          model: "gemini-2.5-flash",
          units: 1,
          costUsd: r.costUsd,
          runId: opts.runId,
        });
        const guardar = (lang: "es" | "en", guion: string, sabias: string[]) =>
          db
            .prepare(
              `UPDATE article_i18n SET guion = ?3, sabias_que_json = ?4 WHERE article_id = ?1 AND lang = ?2`,
            )
            .bind(nota.id, lang, guion, JSON.stringify(sabias))
            .run();
        await guardar("es", r.guion.guion_es, r.guion.sabias_que_es);
        if (nota.tiene_en) await guardar("en", r.guion.guion_en, r.guion.sabias_que_en);
        await db
          .prepare(`UPDATE articles SET updated_at = ${SQL_NOW} WHERE id = ?1`)
          .bind(nota.id)
          .run();
        out.hechas += 1;
      } catch (error) {
        out.errores.push(`${nota.id}: ${error instanceof Error ? error.message : String(error)}`);
        // Sin presupuesto no tiene sentido seguir probando con las demás.
        if (error instanceof BudgetExceededError) break;
      }
    }
  } catch (error) {
    out.errores.push(error instanceof Error ? error.message : String(error));
  }
  return out;
}

function leerFuentes(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json) as unknown;
    return Array.isArray(v)
      ? v
          .map((s) =>
            s && typeof s === "object" ? String((s as { title?: string }).title ?? "") : "",
          )
          .filter(Boolean)
          .slice(0, 5)
      : [];
  } catch {
    return [];
  }
}
