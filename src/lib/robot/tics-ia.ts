/**
 * QUE NO SUENE A MÁQUINA.
 *
 * Dictado por Richard el 24 ago 2026, después de leer un titular nuestro que decía «La resiliencia
 * de la economía de EE. UU.». Sus palabras: *«que cuando estén escribiendo no parezca una IA, que
 * no busque ni ponga palabras de IA… eso no quiere decir que van a vetar esa palabra, si tiene que
 * saber agregarla en un lugar que sea más humano»*.
 *
 * Esa es exactamente la regla, y es más fina que una lista negra: **ninguna palabra está prohibida**.
 * «Resiliencia» es la palabra correcta en un informe del Fondo Monetario. Lo que delata a una
 * máquina no es usarla una vez: es usarla junto a «robusto», «panorama», «clave» y «cabe destacar»
 * en la misma nota, porque son las palabras que el modelo alcanza primero cuando no tiene nada
 * concreto que decir.
 *
 * Por eso aquí se mide **densidad**, no presencia. Una muletilla cada tantas palabras es cómo
 * escribe la gente; cinco en un párrafo es cómo escribe un modelo. Si se pasa del umbral, el
 * borrador se devuelve para que lo reescriba con palabras de la vida real — no para tachar términos.
 *
 * El prompt solo no bastaba: se le pedía «humano» y volvía con «resiliencia» en el titular. Un
 * candado en código lo mide y lo hace volver.
 */

/**
 * Muletillas que un modelo de lenguaje usa mucho más que una persona. No son palabras malas: son
 * palabras que, amontonadas, suenan a relleno. Salen del texto en minúsculas y sin tildes.
 */
export const TICS_ES = [
  "resiliencia",
  "resiliente",
  "robusto",
  "robusta",
  "panorama actual",
  "en el panorama",
  "en la era digital",
  "en un mundo cada vez mas",
  "cada vez mas complejo",
  "cabe destacar",
  "cabe senalar",
  "vale la pena senalar",
  "es importante senalar",
  "es fundamental",
  "es crucial",
  "juega un papel",
  "desempena un papel",
  "piedra angular",
  "punto de inflexion",
  "sinergia",
  "holistico",
  "holistica",
  "transformador",
  "transformadora",
  "revolucionar",
  "revolucionario",
  "desbloquear",
  "aprovechar el potencial",
  "todo un testimonio",
  "un testimonio de",
  "profundizar en",
  "adentrarse en",
  "sumergirse en",
  "navegar por",
  "el auge de",
  "en resumen",
  "en conclusion",
  "en definitiva",
  "no es solo",
  "no solo eso",
  "por otro lado",
  "sin embargo, es",
  "en ultima instancia",
  "de gran envergadura",
  "un antes y un despues",
  "abanico de posibilidades",
  "hoja de ruta",
  "ecosistema digital",
] as const;

/** Lo mismo en inglés: las muletillas clásicas del inglés generado. */
export const TICS_EN = [
  "delve",
  "delving",
  "leverage",
  "leveraging",
  "robust",
  "seamless",
  "seamlessly",
  "landscape of",
  "in the realm",
  "tapestry",
  "a testament to",
  "navigate the",
  "navigating the",
  "unlock the",
  "harness the",
  "foster a",
  "pivotal",
  "crucial",
  "underscore",
  "underscores",
  "showcase",
  "elevate",
  "embark",
  "myriad",
  "plethora",
  "it is worth noting",
  "it's worth noting",
  "in today's fast-paced",
  "in an increasingly",
  "ever-evolving",
  "game-changer",
  "game changer",
  "cornerstone",
  "paradigm shift",
  "resilience",
  "resilient",
  "in conclusion",
  "in summary",
  "not just a",
  "not only that",
  "ultimately",
  "furthermore",
  "moreover",
] as const;

/**
 * Cuántas muletillas se admiten por cada 1000 palabras. Tres es holgado: una nota de 900 palabras
 * puede llevar dos o tres sin que nadie note nada raro. Es el punto donde deja de leerse como una
 * persona con vocabulario y empieza a leerse como relleno.
 */
export const MAX_TICS_POR_MIL = 3;

/** Quita tildes y baja a minúsculas, para que «señalar» y «senalar» cuenten igual. */
export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export type ConteoTics = {
  /** Las muletillas encontradas, sin repetir, en el orden en que aparecen en la lista. */
  encontrados: string[];
  /** Cuántas veces aparecen en total (una misma muletilla repetida suma). */
  total: number;
  palabras: number;
  /** Muletillas por cada 1000 palabras. */
  densidad: number;
  /** ¿Se pasa del umbral? */
  excede: boolean;
};

/** Cuenta las muletillas de un texto ya sin etiquetas HTML. */
export function contarTics(
  texto: string,
  lista: readonly string[],
  maxPorMil = MAX_TICS_POR_MIL,
): ConteoTics {
  const plano = normalizar(texto);
  const palabras = plano.split(/\s+/).filter(Boolean).length;
  const encontrados: string[] = [];
  let total = 0;
  for (const tic of lista) {
    let desde = 0;
    let veces = 0;
    for (;;) {
      const i = plano.indexOf(tic, desde);
      if (i < 0) break;
      veces += 1;
      desde = i + tic.length;
    }
    if (veces > 0) {
      encontrados.push(tic);
      total += veces;
    }
  }
  const densidad = palabras > 0 ? (total * 1000) / palabras : 0;
  return { encontrados, total, palabras, densidad, excede: densidad > maxPorMil };
}

/**
 * EL TITULAR SE MIDE APARTE, Y CON MÁS RIGOR.
 *
 * En el cuerpo, una muletilla entre novecientas palabras no la nota nadie. En un titular de doce
 * palabras, sí: es lo único que mucha gente llega a leer, es lo que sale en Google y en WhatsApp, y
 * es exactamente donde Richard la vio («La resiliencia de la economía de EE. UU.»). Por eso aquí no
 * se mide densidad: una sola basta para devolver el borrador.
 *
 * Sigue sin ser una lista negra: no se prohíbe la palabra en la nota, se le pide que la ponga donde
 * de verdad viene a cuento, que es dentro del texto y no en la portada.
 */
export function ticsEnTitular(titulo: string, lista: readonly string[]): string[] {
  return contarTics(titulo, lista, Number.POSITIVE_INFINITY).encontrados;
}

/**
 * Revisa los dos idiomas de un borrador: el titular con rigor y el cuerpo por densidad. Devuelve
 * `null` si suena bien, o el aviso que se le manda al redactor para que lo reescriba, diciéndole
 * exactamente qué palabras lo delataron.
 */
export function revisarSonidoHumano(
  es: string,
  en: string,
  maxPorMil = MAX_TICS_POR_MIL,
  titulares?: { es: string; en: string },
): string | null {
  if (titulares) {
    const tEs = ticsEnTitular(titulares.es, TICS_ES);
    const tEn = ticsEnTitular(titulares.en, TICS_EN);
    if (tEs.length > 0 || tEn.length > 0) {
      const cuales = [...tEs, ...tEn].join(", ");
      return (
        `El titular delata que lo escribió una máquina: usa ${cuales}. El titular es lo único que ` +
        `mucha gente llega a leer. Escríbelo con palabras de la vida real, diciendo qué pasó y a ` +
        `quién le importa. Si esa palabra es de verdad la exacta, va DENTRO del texto, no en el titular.`
      );
    }
  }
  const rEs = contarTics(es, TICS_ES, maxPorMil);
  const rEn = contarTics(en, TICS_EN, maxPorMil);
  if (!rEs.excede && !rEn.excede) return null;
  const partes: string[] = [];
  if (rEs.excede) partes.push(`en español: ${rEs.encontrados.slice(0, 8).join(", ")}`);
  if (rEn.excede) partes.push(`en inglés: ${rEn.encontrados.slice(0, 8).join(", ")}`);
  return (
    `El texto suena a máquina. Aparecen demasiadas muletillas de las que usa la inteligencia ` +
    `artificial (${partes.join("; ")}). No están prohibidas: el problema es la cantidad. ` +
    `Reescribe esas frases con las palabras que usaría una persona contando esto en voz alta, y ` +
    `deja como mucho una si de verdad es la palabra exacta en ese sitio.`
  );
}
