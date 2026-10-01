/**
 * A QUÉ HORA SE PUBLICA.
 *
 * El 24 de agosto de 2026 Richard entró al mediodía y no había nada nuevo. Las tres notas del día
 * habían salido a las 11:35 PM, 12:49 AM y 1:08 AM — de madrugada, cuando no hay nadie leyendo.
 * Causas, las dos juntas:
 *   1. El día se contaba en UTC, y el día UTC cambia a las 8 de la noche hora del Este. En cuanto
 *      cambiaba, la cuota se abría y el robot disparaba las tres seguidas.
 *   2. El latido solo miraba «¿pasó una hora desde la última corrida?». Nunca miraba el reloj.
 *
 * Ahora el robot publica en CUATRO FRANJAS fijas, en hora del Este de Estados Unidos, elegidas con
 * los picos de lectura de los medios, y **cada una con su género asignado** (ver `FRANJAS`):
 *
 *   07:00  mañana    · actualidad. La gente revisa noticias antes de las 8 y otra vez a las 9
 *   12:00  mediodía  · curiosidades. Pico del almuerzo, se lee con calma
 *   17:00  tarde     · actualidad. Salida del trabajo: «qué ha pasado hoy»
 *   21:00  noche     · rankings («¿cuál es el producto más vendido del mundo?»). El rato de más
 *                       tráfico de internet (7–9 PM), cuando se lee lo que se comparte
 *
 * Fuentes de los horarios: Pew Research (66 % consume noticias entre 5 y 9 PM; 56 % antes de las
 * 8 AM), Public Radio Biz Lab (picos a primera hora, 9 AM, mediodía y 5 PM) y Sprout Social 2026
 * (pico general 11 AM–6 PM hora local). Los medios grandes actualizan tres o cuatro veces al día
 * justo para pegarle a esos picos.
 *
 * Zona: `America/New_York`. Es la hora de Michigan (donde está Richard) y la del grueso del público
 * hispano de EE. UU. El horario de verano lo resuelve el propio sistema, no una cuenta a mano.
 */

/** La zona que manda. Todo el ritmo del diario se piensa en esta hora, no en UTC. */
export const ZONA = "America/New_York";

import type { SectionId } from "@/lib/sections";

export type Franja = {
  /** Identificador interno; se guarda en la base para saber qué turno ya salió. */
  key:
    | "manana"
    | "manana-2"
    | "manana-3"
    | "mediodia"
    | "tarde"
    | "tarde-2"
    | "tarde-3"
    | "noche"
    | "noche-2"
    | "noche-3";
  /** Hora local de la zona (0-23). */
  hour: number;
  /**
   * QUÉ SE ESCRIBE EN ESTA FRANJA. Esto es la escaleta del diario.
   *
   * Antes había un porcentaje («que el 40 % sean piezas propias») y salió mal: el cálculo se hacía
   * sobre un contador que se reinicia cada día, así que con tres notas nunca llegaba al umbral y
   * **todas** salían de curiosidades. Siete seguidas, cero de actualidad (25-28 ago 2026).
   *
   * Una redacción no trabaja con porcentajes: trabaja con una escaleta. Cada franja tiene su género
   * asignado de antemano, y así el reparto es exacto y se puede comprobar de un vistazo.
   */
  genero: "actualidad" | "propia";
  /**
   * Si la franja es de pieza propia, qué CLASE de pieza. Sirve para que las dos franjas propias del
   * día no sean lo mismo: al mediodía curiosidades y listas de errores, y por la noche rankings
   * («cuál es el producto más vendido del mundo», «qué país bebe más»), que es lo que Richard pidió
   * el 28 ago 2026 al ver que las dos se repetían.
   */
  subgenero?: "curiosidades" | "ranking";
  /**
   * LA SECCIÓN QUE TIENE QUE SALIR EN ESTE TURNO.
   *
   * Richard saca de losupe el texto de los videos de sus dos canales: Full Código (tecnología e
   * inteligencia artificial) y Caprichoso TV (artistas y música latina). Si esas dos secciones no
   * traen noticias nuevas cada día, no hay qué grabar. El 1 de octubre de 2026 la portada de
   * Tecnología mostraba notas del 24, del 9 y del 8 de septiembre, y dos eran efemérides.
   *
   * Antes la sección la elegía el cupo libre, y como Economía tenía el doble de cupo y los feeds de
   * las otras dos estaban secos, casi todo salía de Economía. Ahora seis turnos del día tienen la
   * sección puesta de antemano: tres de tecnología y tres de artistas. Los turnos sin sección
   * (`undefined`) siguen funcionando como siempre y son los de Economía, Ventas y Cripto.
   */
  seccion?: SectionId;
};

/**
 * LA ESCALETA DEL DÍA: diez notas, ocho de actualidad y dos piezas propias.
 *
 * Tres turnos son de Tecnología e IA (7:00, 14:00 y 19:00) y tres de Artistas y tendencias (9:00,
 * 16:00 y 20:00): son las dos secciones de las que salen los videos, y por contrato interno tienen
 * que traer tres noticias NUEVAS cada día. Dos turnos quedan libres (10:00 y 17:00) para Economía,
 * Ventas y Cripto, que siguen funcionando igual que antes. Y las dos piezas propias se quedan donde
 * estaban: curiosidades al mediodía y rankings a las nueve de la noche.
 *
 * Una franja = una nota = una firma distinta.
 */
export const FRANJAS: readonly Franja[] = [
  { key: "manana", hour: 7, genero: "actualidad", seccion: "tecnologia" },
  { key: "manana-2", hour: 9, genero: "actualidad", seccion: "artistas" },
  { key: "manana-3", hour: 10, genero: "actualidad" },
  { key: "mediodia", hour: 12, genero: "propia", subgenero: "curiosidades" },
  { key: "tarde", hour: 14, genero: "actualidad", seccion: "tecnologia" },
  { key: "tarde-2", hour: 16, genero: "actualidad", seccion: "artistas" },
  { key: "tarde-3", hour: 17, genero: "actualidad" },
  { key: "noche", hour: 19, genero: "actualidad", seccion: "tecnologia" },
  { key: "noche-2", hour: 20, genero: "actualidad", seccion: "artistas" },
  { key: "noche-3", hour: 21, genero: "propia", subgenero: "ranking" },
];

/**
 * Cuánto se admite llegar tarde a una franja. El robot no tiene un reloj propio: se despierta con
 * el reloj de la plataforma y con las visitas al sitio. Si a las 7:00 en punto no entró nadie, la
 * nota sale cuando entre alguien, dentro de esta ventana. Pasada la ventana, ese turno se pierde —
 * es a propósito: acumular turnos es exactamente lo que hacía que salieran tres notas juntas de
 * madrugada.
 *
 * Era de tres horas cuando había cuatro turnos muy separados. Con diez turnos, dos de ellos a una
 * hora de distancia, una ventana larga hacía que el turno de más tarde tapara al de antes (se elige
 * siempre el más reciente) y la sección de ese hueco se quedaba sin nota. Una hora exacta: cada
 * turno tiene la suya y no pisa al siguiente.
 */
export const VENTANA_HORAS = 1;

type Partes = { y: number; m: number; d: number; hh: number; mm: number };

const FORMATO = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** La fecha y la hora tal como se ven en un reloj del Este de EE. UU. */
export function partesEnZona(date: Date): Partes {
  const p: Record<string, string> = {};
  for (const part of FORMATO.formatToParts(date)) {
    if (part.type !== "literal") p[part.type] = part.value;
  }
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    // A medianoche, `hour12: false` puede devolver «24» en vez de «00» en algunos motores.
    hh: Number(p.hour) % 24,
    mm: Number(p.minute),
  };
}

/** El día del calendario en la zona: «2026-08-24». Es el día que cuenta para la cuota diaria. */
export function diaLocal(date: Date): string {
  const { y, m, d } = partesEnZona(date);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * El instante UTC en que empezó (y en que termina) el día local. Sirve para preguntarle a la base
 * «cuántas notas van hoy», porque las fechas se guardan en UTC y comparar solo el texto del día
 * daría el día equivocado durante las últimas cuatro horas de cada jornada.
 */
export function rangoDelDiaLocal(date: Date): { desde: string; hasta: string } {
  const { y, m, d } = partesEnZona(date);
  // El desfase se mide al mediodía local, que nunca cae en el salto del horario de verano.
  const mediodiaUtcAprox = Date.UTC(y, m - 1, d, 12, 0, 0);
  const vistoEnZona = partesEnZona(new Date(mediodiaUtcAprox));
  const desfase =
    Date.UTC(vistoEnZona.y, vistoEnZona.m - 1, vistoEnZona.d, vistoEnZona.hh, vistoEnZona.mm) -
    mediodiaUtcAprox;
  const inicio = Date.UTC(y, m - 1, d, 0, 0, 0) - desfase;
  return {
    desde: new Date(inicio).toISOString(),
    hasta: new Date(inicio + 24 * 3_600_000).toISOString(),
  };
}

/**
 * ¿Toca publicar ahora? Devuelve la franja abierta en este momento, o `null` si estamos fuera de
 * horario (de madrugada, por ejemplo, que es justo lo que había que cortar).
 */
export function franjaActiva(
  now: Date,
  franjas: readonly Franja[] = FRANJAS,
  ventanaHoras = VENTANA_HORAS,
): Franja | null {
  const { hh, mm } = partesEnZona(now);
  const minutosAhora = hh * 60 + mm;
  // De atrás hacia delante: si dos ventanas se solaparan, manda la más reciente.
  for (let i = franjas.length - 1; i >= 0; i--) {
    const f = franjas[i];
    if (!f) continue;
    const inicio = f.hour * 60;
    // UN TURNO SIGUE PENDIENTE HASTA QUE EMPIEZA EL SIGUIENTE.
    //
    // Con la ventana fija de una hora, un turno sin visitas a esa hora en punto se perdía: el 1 de
    // octubre de 2026 el turno de las 14:00 falló por un 503 del proveedor y a las 15:13 ya no
    // había forma de reintentarlo, aunque la portada siguiera sin esa nota. Ahora la ventana llega
    // hasta el turno siguiente (el último, una hora), así que el reintento cabe y aun así NUNCA
    // pueden solaparse dos turnos ni salir dos notas juntas.
    const siguiente = franjas[i + 1];
    const fin = siguiente ? siguiente.hour * 60 : inicio + ventanaHoras * 60;
    if (minutosAhora >= inicio && minutosAhora < fin) return f;
  }
  return null;
}

/**
 * A qué hora exacta (en UTC) abrió esta franja hoy. Hace falta para preguntarle a la base si ya
 * salió la nota de este turno, que es la única fuente que no miente.
 */
export function inicioDeFranja(now: Date, franja: Franja): string {
  const { desde } = rangoDelDiaLocal(now);
  return new Date(Date.parse(desde) + franja.hour * 3_600_000).toISOString();
}

/** Etiqueta del turno para guardar en la base: «2026-08-24:mediodia». */
export function marcaDeFranja(now: Date, franja: Franja): string {
  return `${diaLocal(now)}:${franja.key}`;
}

/** Cómo se le dice a una persona, para el panel. */
export const NOMBRE_FRANJA: Record<Franja["key"], { es: string; en: string }> = {
  manana: { es: "Mañana (7:00)", en: "Morning (7:00)" },
  "manana-2": { es: "Mañana (9:00)", en: "Morning (9:00)" },
  "manana-3": { es: "Media mañana (10:00)", en: "Mid-morning (10:00)" },
  mediodia: { es: "Mediodía (12:00)", en: "Midday (12:00)" },
  tarde: { es: "Tarde (14:00)", en: "Afternoon (14:00)" },
  "tarde-2": { es: "Tarde (16:00)", en: "Afternoon (16:00)" },
  "tarde-3": { es: "Tarde (17:00)", en: "Afternoon (17:00)" },
  noche: { es: "Noche (19:00)", en: "Evening (19:00)" },
  "noche-2": { es: "Noche (20:00)", en: "Evening (20:00)" },
  "noche-3": { es: "Noche (21:00)", en: "Evening (21:00)" },
};

/** Cómo se le dice a cada género en pantalla. */
export const NOMBRE_GENERO: Record<Franja["genero"], { es: string; en: string }> = {
  actualidad: { es: "Actualidad", en: "Breaking news" },
  propia: { es: "Curiosidades", en: "Lists & trivia" },
};

/** El nombre de la clase de pieza propia, para el panel. */
export const NOMBRE_SUBGENERO: Record<"curiosidades" | "ranking", { es: string; en: string }> = {
  curiosidades: { es: "Curiosidades", en: "Trivia" },
  ranking: { es: "Rankings y récords", en: "Rankings & records" },
};
