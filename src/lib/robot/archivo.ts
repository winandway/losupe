import { normalizeTerm, SYNONYM_GROUPS } from "@/lib/search-synonyms";
import { generateJson } from "./gemini";

/**
 * EL ARCHIVO DEL DIARIO: lo que ya contamos.
 *
 * Nace de un fallo que vio Richard el 29 ago 2026: el diario publicó «Sanciones económicas y el
 * Estrecho de Ormuz» y, cinco días después, «Medidas económicas y rutas comerciales». Dos notas
 * distintas contando lo mismo. Sus palabras: *«hay de tantas cosas que hablar en el mundo que
 * pudimos haber hecho sobre otra»*.
 *
 * Y tenía razón por partida doble, porque el fallo era estructural: la comprobación de «esto ya lo
 * escribimos» **solo existía dentro del banco de ideas propias**. Una nota de actualidad venida del
 * RSS jamás se comparaba con nada. Podía repetir una guía de la semana pasada sin que saltara nada.
 *
 * LA EXCEPCIÓN, que es tan importante como la regla: hay temas que **se cuentan varios días
 * seguidos y está bien** — un terremoto, una crisis, una elección. Ahí cada nota es un capítulo
 * distinto: cuántas víctimas van, qué países mandaron ayuda, qué dijo el gobierno. Eso NO es
 * repetir: es seguir una noticia, que es lo que hace un diario. Lo que no vale es contar otra vez
 * lo mismo con otras palabras.
 *
 * La diferencia entre las dos cosas es **si hay hechos nuevos**. Un seguimiento trae cifras,
 * nombres o fechas que la nota anterior no tenía. Una repetición trae sinónimos.
 */

/** Palabras que no dicen nada del tema y solo inflan el parecido. */
const VACIAS = new Set([
  // español
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "de",
  "del",
  "al",
  "a",
  "ante",
  "bajo",
  "con",
  "contra",
  "desde",
  "en",
  "entre",
  "hacia",
  "hasta",
  "para",
  "por",
  "segun",
  "sin",
  "sobre",
  "tras",
  "y",
  "o",
  "u",
  "e",
  "que",
  "como",
  "cuando",
  "donde",
  "mas",
  "muy",
  "ya",
  "su",
  "sus",
  "este",
  "esta",
  "estos",
  "estas",
  "ese",
  "esa",
  "lo",
  "le",
  "les",
  "se",
  "es",
  "son",
  "fue",
  "ser",
  "han",
  "hay",
  "no",
  "si",
  "tambien",
  "asi",
  "todo",
  "todos",
  "toda",
  "todas",
  "otro",
  "otra",
  "cada",
  "puede",
  "pueden",
  "hacer",
  "tiene",
  "tienen",
  // inglés
  "the",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "for",
  "with",
  "from",
  "by",
  "at",
  "as",
  "and",
  "or",
  "but",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "what",
  "which",
  "how",
  "when",
  "where",
  "not",
  "no",
  "yes",
  "all",
  "any",
  "can",
  "could",
  "will",
  "would",
  "has",
  "have",
  "had",
  "about",
  "into",
  "over",
  "after",
  "before",
  "more",
  "most",
  "new",
]);

/**
 * Palabras de PLANTILLA: las que ponemos nosotros en el molde del titular, no el tema. Cuentan
 * aparte porque dos guías comparten «una guía para entender su impacto global» sin hablar de lo
 * mismo — y al revés, ese trozo repetido hacía que dos notas parecieran gemelas cuando no lo eran.
 */
const PLANTILLA = new Set([
  "guia",
  "guias",
  "guide",
  "entender",
  "understand",
  "understanding",
  "impacto",
  "impact",
  "global",
  "curiosidades",
  "curiosities",
  "facts",
  "errores",
  "mistakes",
  "cometen",
  "claves",
  "keys",
  "sorprendentes",
  "surprising",
  "conocen",
  "conoce",
  "saber",
  "know",
  "nadie",
  "casi",
  "mejores",
  "best",
  "peores",
  "worst",
  "ranking",
  "rankings",
  "lista",
  "list",
  "top",
  "sabias",
  "did",
  "explicado",
  "explained",
  "significa",
  "means",
  "paso",
  "step",
  "hechos",
  "cosas",
  "things",
  "things",
]);

/**
 * Cada término lleva al PRIMERO de su grupo, siempre el mismo. Tiene que ser estable en los dos
 * sentidos: si «btc» apuntara a «bitcoin» y «bitcoin» a «btc», dos textos idénticos saldrían
 * distintos.
 */
const CANONICO: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const grupo of SYNONYM_GROUPS) {
    const jefe = normalizeTerm(grupo[0] ?? "");
    for (const t of grupo) m.set(normalizeTerm(t), jefe);
  }
  return m;
})();

/**
 * Los sinónimos de VARIAS palabras («estados unidos», «inteligencia artificial», «comercio
 * electronico»). Se cambian ANTES de trocear el texto: si se trocea primero, «estados unidos» se
 * parte en dos palabras sueltas y deja de ser el mismo concepto que «eeuu». Van de la más larga a
 * la más corta para que la expresión larga gane.
 */
const FRASES: readonly [string, string][] = SYNONYM_GROUPS.flatMap((grupo) => {
  const jefe = normalizeTerm(grupo[0] ?? "");
  return grupo
    .map((t) => normalizeTerm(t))
    .filter((t) => t.includes(" "))
    .map((t) => [t, jefe.replace(/ /g, "-")] as [string, string]);
}).sort((a, b) => b[0].length - a[0].length);

/** Un concepto: palabra significativa ya normalizada y llevada a su forma canónica. */
export function conceptos(texto: string): Set<string> {
  const fuera = new Set<string>();
  let plano = normalizeTerm(texto);
  for (const [frase, canon] of FRASES) {
    if (plano.includes(frase)) plano = plano.split(frase).join(canon);
  }
  for (const bruto of plano.split(" ")) {
    const p = bruto.replace(/^-+|-+$/g, "");
    if (p.length < 3) continue;
    if (VACIAS.has(p) || PLANTILLA.has(p)) continue;
    // Se lleva a la forma canónica del grupo de sinónimos: «btc» y «bitcoin» son el mismo concepto,
    // y «eeuu» y «estados unidos» también. Sin esto, el mismo tema con otro nombre se cuela.
    fuera.add(CANONICO.get(p) ?? p);
  }
  return fuera;
}

/**
 * Cuánto se parecen dos temas, de 0 a 1.
 *
 * Se usa el coeficiente de solapamiento (lo compartido sobre el más corto de los dos) y no el de
 * Jaccard, por un motivo práctico: un titular corto y una entradilla larga sobre el mismo hecho dan
 * un Jaccard bajísimo aunque hablen exactamente de lo mismo. Lo que importa aquí es si **todo** lo
 * que dice uno ya está en el otro.
 */
export function parecido(a: string, b: string): number {
  const ca = conceptos(a);
  const cb = conceptos(b);
  if (ca.size === 0 || cb.size === 0) return 0;
  let comunes = 0;
  for (const c of ca) if (cb.has(c)) comunes += 1;
  return comunes / Math.min(ca.size, cb.size);
}

/**
 * Los hechos que trae el candidato y NO estaban en lo ya publicado: cifras, cantidades de dinero,
 * fechas y nombres propios. Es la señal que separa un seguimiento de una repetición.
 *
 * Un terremoto del que ya escribimos vuelve con «ya son 300 los fallecidos» o «doce países
 * mandaron ayuda»: eso son hechos nuevos. Una repetición vuelve con «el impacto global de las
 * medidas»: cero hechos, solo sinónimos.
 */
export function hechosNuevos(candidato: string, yaPublicado: string): string[] {
  const viejos = new Set(
    [
      ...(yaPublicado.match(/\d[\d.,]*\s*(?:%|mil|millones|billones|million|billion)?/gi) ?? []),
    ].map((n) => n.toLowerCase().replace(/\s+/g, " ").trim()),
  );
  const nombresViejos = new Set(nombresPropios(yaPublicado));
  const nuevos: string[] = [];
  for (const n of candidato.match(/\d[\d.,]*\s*(?:%|mil|millones|billones|million|billion)?/gi) ??
    []) {
    const clave = n.toLowerCase().replace(/\s+/g, " ").trim();
    if (!viejos.has(clave)) nuevos.push(clave);
  }
  for (const n of nombresPropios(candidato)) if (!nombresViejos.has(n)) nuevos.push(n);
  return [...new Set(nuevos)];
}

/** Nombres propios: palabras con mayúscula que no abren la frase. Basto, pero suficiente y gratis. */
export function nombresPropios(texto: string): string[] {
  const fuera: string[] = [];
  for (const frase of texto.split(/[.!?¿¡\n]+/)) {
    const palabras = frase.trim().split(/\s+/);
    for (let i = 1; i < palabras.length; i++) {
      const p = (palabras[i] ?? "").replace(/[^\p{L}\p{N}ÁÉÍÓÚÑáéíóúñ-]/gu, "");
      if (p.length < 3) continue;
      if (!/^\p{Lu}/u.test(p)) continue;
      const bajo = normalizeTerm(p);
      if (VACIAS.has(bajo) || PLANTILLA.has(bajo)) continue;
      fuera.push(bajo);
    }
  }
  return [...new Set(fuera)];
}

export type NotaDelArchivo = {
  titulo: string;
  entradilla?: string | null;
  publicadaEn: string;
  /** Las URL que citó. Dos notas con la misma fuente cuentan el mismo hecho. */
  fuentes?: readonly string[];
};

export type Veredicto =
  | { repite: false }
  | {
      repite: true;
      /** ¿Es un capítulo nuevo de una noticia que sigue viva? Entonces sí se escribe. */
      seguimiento: boolean;
      parecidoCon: string;
      parecido: number;
      novedades: string[];
      motivo: string;
    };

/** A partir de aquí es el MISMO TEMA contado otra vez. Calibrado con casos reales. */
export const UMBRAL_PARECIDO = 0.6;
/**
 * Zona de «la misma historia, otro ángulo»: se parecen a medias pero hablan del mismo suceso. Solo
 * cuenta si además comparten un nombre propio — el terremoto de Filipinas del lunes y el del jueves
 * comparten «Filipinas», aunque uno hable de víctimas y el otro de la ayuda internacional.
 */
export const UMBRAL_MISMA_HISTORIA = 0.25;
/** Pasada esta ventana, volver sobre un tema es legítimo: el mundo cambió. */
export const DIAS_DE_MEMORIA = 12;
/** Hechos nuevos que hay que traer para que cuente como seguimiento y no como repetición. */
export const MINIMO_HECHOS_NUEVOS = 2;

/**
 * ¿Deberíamos escribir esto, o ya lo contamos?
 *
 * No lanza nunca: ante la duda deja pasar. Un filtro que se cae y bloquea el diario es peor que una
 * nota repetida.
 */
export function revisarArchivo(
  candidato: { titulo: string; resumen?: string | null; fuentes?: readonly string[] },
  archivo: readonly NotaDelArchivo[],
  ahora = new Date(),
): Veredicto {
  try {
    const textoCandidato = `${candidato.titulo} ${candidato.resumen ?? ""}`.trim();
    const urls = new Set((candidato.fuentes ?? []).map(limpiarUrl).filter(Boolean));

    let peor: { nota: NotaDelArchivo; p: number; mismaFuente: boolean } | null = null;
    for (const nota of archivo) {
      const dias = (ahora.getTime() - Date.parse(nota.publicadaEn)) / 86_400_000;
      if (!Number.isFinite(dias) || dias > DIAS_DE_MEMORIA || dias < 0) continue;

      // La señal más fuerte y la más barata: si citamos la MISMA fuente, es el mismo hecho.
      const mismaFuente = (nota.fuentes ?? []).some((f) => urls.has(limpiarUrl(f)));
      const textoNota = `${nota.titulo} ${nota.entradilla ?? ""}`;
      const p = parecido(textoCandidato, textoNota);
      // La misma historia seguida por otro lado: se parecen a medias Y nombran lo mismo.
      const mismaHistoria =
        p >= UMBRAL_MISMA_HISTORIA && compartenNombre(textoCandidato, textoNota);
      if (!mismaFuente && p < UMBRAL_PARECIDO && !mismaHistoria) continue;
      if (!peor || (mismaFuente && !peor.mismaFuente) || p > peor.p) {
        peor = { nota, p, mismaFuente };
      }
    }
    if (!peor) return { repite: false };

    const novedades = hechosNuevos(
      textoCandidato,
      `${peor.nota.titulo} ${peor.nota.entradilla ?? ""}`,
    );
    const seguimiento = novedades.length >= MINIMO_HECHOS_NUEVOS && !peor.mismaFuente;
    return {
      repite: true,
      seguimiento,
      parecidoCon: peor.nota.titulo,
      parecido: Math.round(peor.p * 100) / 100,
      novedades,
      motivo: peor.mismaFuente
        ? "cita la misma fuente que una nota reciente"
        : seguimiento
          ? "mismo tema, pero trae hechos nuevos: es un capítulo más"
          : "mismo tema contado otra vez, sin nada nuevo",
    };
  } catch {
    return { repite: false };
  }
}

/** ¿Hablan de la misma gente, el mismo país, el mismo sitio? */
function compartenNombre(a: string, b: string): boolean {
  const na = new Set(nombresPropios(a));
  return nombresPropios(b).some((n) => na.has(n));
}

function limpiarUrl(u: string): string {
  try {
    const url = new URL(u);
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return u.trim().toLowerCase();
  }
}

/* ─────────────────────────────── El jefe de redacción decide ─────────────────────────────── */

/**
 * EL FILTRO DE ARRIBA ES BARATO PERO CORTO DE VISTA, y conviene decirlo claro.
 *
 * Compara palabras. Y con los cuatro titulares reales del caso —«Sanciones económicas y el Estrecho
 * de Ormuz», «Sanciones económicas: cómo afectan a un país», «Cómo Estados Unidos redefine sus
 * objetivos en conflictos internacionales» y «Medidas económicas y rutas comerciales»— el parecido
 * léxico entre pares baja hasta 0,25. Para cualquier lector son la misma nota cuatro veces. Para un
 * algoritmo que cuenta palabras compartidas, no.
 *
 * Así que después del filtro barato hay un segundo paso con criterio de verdad: se le pregunta al
 * modelo, en una consulta corta, si el tema propuesto ya está contado. Cuesta unas milésimas de
 * centavo (modelo `flash-lite`, ~400 palabras de entrada y una respuesta de dos líneas) y se hace
 * **una vez por corrida**, no por candidato.
 *
 * Sigue mandando la misma excepción: una noticia que sigue viva se cuenta varios días. Al modelo se
 * le explica esa diferencia con las mismas palabras que usó Richard.
 */

export type DecisionMesa = {
  /** ¿Está contado ya? */
  repetido: boolean;
  /** Si lo está: ¿es un capítulo nuevo con hechos nuevos, o volver a contar lo mismo? */
  seguimiento: boolean;
  /** El titular nuestro con el que choca, tal cual se le pasó. */
  choca_con: string;
  /** En una frase, para que quede escrito en el panel. */
  motivo: string;
};

export const ESQUEMA_DECISION = {
  type: "object",
  properties: {
    repetido: { type: "boolean" },
    seguimiento: { type: "boolean" },
    choca_con: { type: "string" },
    motivo: { type: "string" },
  },
  required: ["repetido", "seguimiento", "choca_con", "motivo"],
} as const;

export const SISTEMA_MESA = `Eres el jefe de redacción de un diario. Tu única tarea ahora es decidir si un tema propuesto YA LO CONTAMOS.

Piensa como un lector, no como un buscador de palabras: dos titulares con palabras distintas pueden ser exactamente la misma nota. «Sanciones económicas y el Estrecho de Ormuz» y «Medidas económicas y rutas comerciales» son LA MISMA NOTA, aunque no compartan casi ninguna palabra.

Hay una excepción que importa tanto como la regla: una noticia que sigue viva se cuenta varios días seguidos, y eso está bien. De un terremoto se publica el primer balance, luego cuántas víctimas van, luego qué países mandaron ayuda, luego qué decidió el gobierno. Cada una es un capítulo distinto y todas se publican.

La diferencia entre un capítulo y una repetición son los HECHOS NUEVOS: cifras, nombres, decisiones o fechas que la nota anterior no tenía. Si el tema propuesto solo trae las mismas ideas con otras palabras, es una repetición.

Responde:
- repetido: true si el tema ya está contado en alguno de nuestros titulares.
- seguimiento: true SOLO si es repetido y además aporta hechos nuevos que la nota anterior no tenía.
- choca_con: el titular nuestro con el que choca, copiado tal cual. Cadena vacía si no choca con ninguno.
- motivo: una frase corta y en palabras normales.

Ante la duda, di que NO es repetido: perder una nota buena es peor que publicar una parecida.`;

export function promptDecision(
  candidato: { titulo: string; resumen?: string | null },
  yaPublicado: readonly string[],
): string {
  return `TEMA PROPUESTO: ${candidato.titulo}
${candidato.resumen ? `RESUMEN: ${candidato.resumen}` : ""}

LO QUE YA PUBLICAMOS ESTOS DÍAS:
${yaPublicado.map((t, i) => `${i + 1}. ${t}`).join("\n")}`;
}

/**
 * Le pregunta al jefe de redacción si el tema ya está contado.
 *
 * **Nunca frena el diario.** Si no hay llave, si el modelo falla o si tarda, devuelve `null` y se
 * publica igual: el filtro barato ya quitó lo evidente. Un guardia de calidad que tumba la
 * publicación es peor que una nota parecida.
 */
export async function preguntarALaMesa(opts: {
  apiKey?: string;
  candidato: { titulo: string; resumen?: string | null };
  yaPublicado: readonly string[];
  fetchImpl?: typeof fetch;
}): Promise<{ decision: DecisionMesa; costUsd: number } | null> {
  if (!opts.apiKey || opts.yaPublicado.length === 0) return null;
  try {
    const r = await generateJson<DecisionMesa>({
      apiKey: opts.apiKey,
      // El modelo más barato del catálogo: esto es una decisión de dos líneas, no una redacción.
      model: "gemini-2.5-flash-lite",
      system: SISTEMA_MESA,
      prompt: promptDecision(opts.candidato, opts.yaPublicado.slice(0, 25)),
      responseSchema: ESQUEMA_DECISION,
      temperature: 0,
      maxOutputTokens: 300,
      timeoutMs: 20_000,
      fetchImpl: opts.fetchImpl,
    });
    return { decision: r.data, costUsd: r.costUsd };
  } catch {
    return null;
  }
}
