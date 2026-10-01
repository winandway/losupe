import { stripHtml } from "@/lib/html";
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

/**
 * LAS DOS MEDIDAS, pedidas por Richard el 1 de octubre de 2026.
 *
 * Grababa un Short con el guion de una nota y le salía de 2 minutos 45: para un Short hace falta
 * UNO. Ahora cada nota trae las dos versiones y él elige según dónde la publique.
 */
export const MEDIDAS = {
  "1m": { min: 115, max: 140, etiqueta: { es: "1 minuto", en: "1 minute" } },
  "2m": { min: 225, max: 270, etiqueta: { es: "2 minutos", en: "2 minutes" } },
} as const;

export type Medida = keyof typeof MEDIDAS;

/** El título que se pone al video. Más largo no cabe en la miniatura de YouTube. */
export const TITULO_VIDEO_MAX = 60;

export type Guion = {
  titulo_video_es: string;
  titulo_video_en: string;
  guion_1m_es: string;
  guion_1m_en: string;
  guion_2m_es: string;
  guion_2m_en: string;
  sabias_que_es: string[];
  sabias_que_en: string[];
};

export const ESQUEMA_GUION = {
  type: "object",
  properties: {
    titulo_video_es: { type: "string" },
    titulo_video_en: { type: "string" },
    guion_1m_es: { type: "string" },
    guion_1m_en: { type: "string" },
    guion_2m_es: { type: "string" },
    guion_2m_en: { type: "string" },
    sabias_que_es: { type: "array", items: { type: "string" } },
    sabias_que_en: { type: "array", items: { type: "string" } },
  },
  required: [
    "titulo_video_es",
    "titulo_video_en",
    "guion_1m_es",
    "guion_1m_en",
    "guion_2m_es",
    "guion_2m_en",
    "sabias_que_es",
    "sabias_que_en",
  ],
} as const;

export const SISTEMA_GUION = `Eres guionista de videos cortos de noticias (Reels, Shorts, TikTok). Te dan una nota ya publicada y escribes, en español y en inglés:

1) UN TÍTULO PARA EL VIDEO de 60 letras como mucho, con el gancho.
2) UN GUION DE 1 MINUTO: entre 120 y 135 palabras. Es el principal.
3) UN GUION DE 2 MINUTOS: entre 235 y 265 palabras.
4) HASTA DOS datos para una sección «¿Sabías qué?». O NINGUNO.

EL GUION DE 1 MINUTO, EN ESTE ORDEN Y NADA MÁS:
a) GANCHO: la primera frase es el dato más sorprendente de la noticia, en 15 palabras o menos. Sin saludo, sin «hoy te cuento», sin presentarte.
b) LOS HECHOS: tres como mucho, los que sostienen el titular.
c) POR QUÉ IMPORTA: una frase que diga qué cambia para quien escucha.
d) CIERRE: en su propia línea, exactamente «La nota completa está en losupe.com» (en inglés: «The full story is on losupe.com»).

EL GUION DE 2 MINUTOS es el mismo, con UN BLOQUE MÁS de contexto entre los hechos y el «por qué importa». Mismo gancho y mismo cierre.

CÓMO SE ESCRIBE (es para el OÍDO, no para leer):
- Frases de 18 palabras o menos. Una idea por frase.
- Cada párrafo separado por una línea en blanco. Después de cada punto, un espacio.
- Nada de paréntesis, enlaces, viñetas, asteriscos, emojis ni símbolos.
- Siglas, explicadas la primera vez o fuera.
- Español neutro, sin regionalismos.
- Las cifras van EN NÚMEROS y REDONDEADAS: «45 megabits», no «cuarenta y cinco punto veinticinco». En el guion de 1 minuto, 4 cifras como mucho sin contar el año.
- La fuente se nombra UNA sola vez cada una, y es la fuente ORIGINAL del dato (Ookla, el regulador, la Unión Internacional de Telecomunicaciones, Reuters, la empresa que lo anunció).
- PROHIBIDO nombrar a Wikipedia. Nunca se dice «según Wikipedia» ni nada parecido: se nombra de dónde salió el dato de verdad.

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

export const CIERRE = {
  es: "La nota completa está en losupe.com",
  en: "The full story is on losupe.com",
} as const;

/** Cierres viejos que hay que cambiar por el nuevo si el modelo los repite de memoria. */
const CIERRES_VIEJOS = [/Lo le[ií] en losupe\.com/gi, /I read it on losupe\.com/gi];

/** Las menciones a Wikipedia que se pueden quitar sin romper la frase. */
const WIKIPEDIA_SOBRA =
  /[,;]?\s*(seg[uú]n|de acuerdo con|como (?:lo )?(?:explica|cuenta|recoge)|esto lo explica|lo explica|datos de|informaci[oó]n de)\s+wikipedia/gi;

/**
 * Deja el guion listo para un teleprompter.
 *
 * Los cuatro defectos que trajo la primera versión (Richard, 1 oct 2026) se arreglan aquí:
 * párrafos pegados sin espacio después del punto, menciones a Wikipedia, símbolos de formato, y el
 * cierre que faltaba o era el viejo.
 */
export function limpiarGuion(texto: string, lang: "es" | "en"): string {
  let limpio = texto
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[*_#`>|]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(WIKIPEDIA_SOBRA, "")
    // «por segundo.Este avance» → «por segundo. Este avance». Un teleprompter lo lee todo seguido.
    .replace(/([.!?])(?=[A-ZÁÉÍÓÚÑ¿¡])/g, "$1 ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1");
  for (const viejo of CIERRES_VIEJOS) limpio = limpio.replace(viejo, "");
  limpio = limpio
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
  const cierre = CIERRE[lang];
  if (limpio.toLowerCase().endsWith(cierre.toLowerCase())) return limpio;
  // Si el cierre quedó en medio del texto, se quita de ahí y se pone donde va: al final y solo.
  // (Sin construir una expresión regular con texto variable: eso es justo lo que prohíbe el lint
  // de seguridad, y aquí no hace ninguna falta.)
  // Ojo: se juntan los espacios, NO los saltos de línea. Aplanar aquí los párrafos dejaría el
  // guion en un solo bloque, que es justo lo contrario de lo que pide un teleprompter.
  const sinCierre = limpio
    .split(cierre)
    .join(" ")
    .replace(/[ \t]+/g, " ")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
  return `${sinCierre}\n\n${cierre}`;
}

/**
 * Recorta un guion que se pasó de largo quitando frases del final del cuerpo, nunca del gancho ni
 * del cierre. Más vale un guion un poco más corto que uno que no cabe en el video.
 */
export function recortarGuion(texto: string, max: number, lang: "es" | "en"): string {
  if (contarPalabras(texto) <= max) return texto;
  const cierre = CIERRE[lang];
  const cuerpo = texto.replace(cierre, "").trim();
  const parrafos = cuerpo.split(/\n\n+/);
  while (parrafos.length > 1 && contarPalabras(`${parrafos.join(" ")} ${cierre}`) > max) {
    const ultimo = parrafos[parrafos.length - 1]!;
    const frases = ultimo.match(/[^.!?]+[.!?]+/g);
    if (frases && frases.length > 1) {
      frases.pop();
      parrafos[parrafos.length - 1] = frases.join(" ").trim();
    } else {
      parrafos.pop();
    }
  }
  return `${parrafos.join("\n\n").trim()}\n\n${cierre}`;
}

/**
 * Qué le pasa a un guion, si es que le pasa algo. Lista vacía = se puede publicar.
 *
 * Es el candado del bloque: lo mismo que comprueba la prueba automática.
 */
export function problemasDelGuion(
  texto: string,
  medida: Medida,
  lang: "es" | "en" = "es",
): string[] {
  const problemas: string[] = [];
  const palabras = contarPalabras(texto);
  const { min, max } = MEDIDAS[medida];
  if (palabras > max) problemas.push(`se pasa de largo: ${palabras} palabras (máximo ${max})`);
  if (palabras < min) problemas.push(`demasiado corto: ${palabras} palabras (mínimo ${min})`);
  if (/wikipedia/i.test(texto)) problemas.push("nombra a Wikipedia en voz alta");
  if (!texto.trim().endsWith(CIERRE[lang])) problemas.push("no termina con el cierre de losupe");
  // Un punto pegado a la letra siguiente: el teleprompter lo lee sin respirar.
  // Mayúscula pegada al punto: «por segundo.Este avance». (En «losupe.com» la letra va en
  // minúscula y es parte de la dirección, no una frase nueva.)
  if (/[.!?][A-ZÁÉÍÓÚÑ]/.test(texto)) problemas.push("hay un punto pegado a la palabra");
  if (/https?:\/\/|[*_#`]/.test(texto)) problemas.push("lleva enlaces o símbolos de formato");
  return problemas;
}

/** El título del video: con gancho y corto, para que no se corte en la miniatura. */
export function limpiarTituloVideo(texto: string): string {
  const limpio = texto.replace(/["«»]/g, "").replace(/\s+/g, " ").trim();
  if (limpio.length <= TITULO_VIDEO_MAX) return limpio;
  const corte = limpio.slice(0, TITULO_VIDEO_MAX);
  return corte.slice(0, corte.lastIndexOf(" ")).replace(/[\s,;:.]+$/, "");
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
      maxOutputTokens: 6144,
      timeoutMs: 60_000,
      fetchImpl: opts.fetchImpl,
    });
    // Se limpia, se recorta lo que se pasó de largo y se comprueba. Un guion con un defecto no se
    // guarda: el creador lo lee delante de miles de personas.
    const preparar = (texto: string, medida: Medida, lang: "es" | "en") =>
      recortarGuion(limpiarGuion(texto ?? "", lang), MEDIDAS[medida].max, lang);
    const guiones = {
      guion_1m_es: preparar(r.data.guion_1m_es, "1m", "es"),
      guion_1m_en: preparar(r.data.guion_1m_en, "1m", "en"),
      guion_2m_es: preparar(r.data.guion_2m_es, "2m", "es"),
      guion_2m_en: preparar(r.data.guion_2m_en, "2m", "en"),
    };
    const problemas = [
      ...problemasDelGuion(guiones.guion_1m_es, "1m", "es"),
      ...problemasDelGuion(guiones.guion_1m_en, "1m", "en"),
      ...problemasDelGuion(guiones.guion_2m_es, "2m", "es"),
      ...problemasDelGuion(guiones.guion_2m_en, "2m", "en"),
    ];
    if (problemas.length > 0) return null;
    const titulo_video_es = limpiarTituloVideo(r.data.titulo_video_es ?? opts.titulo);
    const titulo_video_en = limpiarTituloVideo(r.data.titulo_video_en ?? opts.titulo);
    if (!titulo_video_es || !titulo_video_en) return null;
    return {
      guion: {
        ...guiones,
        titulo_video_es,
        titulo_video_en,
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
  opts: { limite?: number; fetchImpl?: typeof fetch; runId?: string; ahora?: Date } = {},
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
          WHERE a.status = 'published' AND (es.guion_1m IS NULL OR es.guion_1m = '')
          ORDER BY
            -- Primero las dos secciones de las que salen los videos, y de ellas las de los últimos
            -- 14 días: es el material que Richard graba hoy (1 oct 2026).
            CASE
              WHEN a.section_id IN ('tecnologia', 'artistas')
               AND a.published_at >= ?2 THEN 0
              ELSE 1
            END,
            a.published_at DESC
          LIMIT ?1`,
      )
      .bind(
        opts.limite ?? 6,
        new Date((opts.ahora ?? new Date()).getTime() - 14 * 86_400_000).toISOString(),
      )
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
        const guardar = (
          lang: "es" | "en",
          un: string,
          dos: string,
          titulo: string,
          sabias: string[],
        ) =>
          db
            .prepare(
              `UPDATE article_i18n
                  SET guion = ?3, guion_1m = ?3, guion_2m = ?4, titulo_video = ?5, sabias_que_json = ?6
                WHERE article_id = ?1 AND lang = ?2`,
            )
            .bind(nota.id, lang, un, dos, titulo, JSON.stringify(sabias))
            .run();
        await guardar(
          "es",
          r.guion.guion_1m_es,
          r.guion.guion_2m_es,
          r.guion.titulo_video_es,
          r.guion.sabias_que_es,
        );
        if (nota.tiene_en)
          await guardar(
            "en",
            r.guion.guion_1m_en,
            r.guion.guion_2m_en,
            r.guion.titulo_video_en,
            r.guion.sabias_que_en,
          );
        // NO se toca `updated_at`: añadir el guion no cambia la noticia. Moverlo hacía que Google
        // viera la nota «actualizada» horas después sin que cambiara una palabra, y al lector le
        // salía «Actualizado» sin motivo (auditoría SEO, 17 sep 2026).
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
