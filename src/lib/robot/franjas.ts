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

export type Franja = {
  /** Identificador interno; se guarda en la base para saber qué turno ya salió. */
  key: "manana" | "mediodia" | "tarde" | "noche";
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
};

/**
 * LA ESCALETA DEL DÍA: cuatro notas, dos de actualidad y dos de curiosidades.
 *
 * La actualidad abre la mañana y vuelve a la salida del trabajo, que es cuando la gente busca «qué
 * ha pasado». Las piezas propias van al mediodía y a la noche, que es cuando se lee con calma lo
 * que no caduca. Una franja = una nota = una firma distinta.
 */
export const FRANJAS: readonly Franja[] = [
  { key: "manana", hour: 7, genero: "actualidad" },
  { key: "mediodia", hour: 12, genero: "propia", subgenero: "curiosidades" },
  { key: "tarde", hour: 17, genero: "actualidad" },
  { key: "noche", hour: 21, genero: "propia", subgenero: "ranking" },
];

/**
 * Cuánto se admite llegar tarde a una franja. El robot no tiene un reloj propio: se despierta con
 * las visitas al sitio. Si a las 7:00 en punto no entró nadie, la nota sale cuando entre alguien,
 * dentro de estas horas. Pasada la ventana, ese turno se pierde — es a propósito: acumular turnos
 * es exactamente lo que hacía que salieran tres notas juntas de madrugada.
 */
export const VENTANA_HORAS = 3;

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
    if (minutosAhora >= inicio && minutosAhora < inicio + ventanaHoras * 60) return f;
  }
  return null;
}

/** Etiqueta del turno para guardar en la base: «2026-08-24:mediodia». */
export function marcaDeFranja(now: Date, franja: Franja): string {
  return `${diaLocal(now)}:${franja.key}`;
}

/** Cómo se le dice a una persona, para el panel. */
export const NOMBRE_FRANJA: Record<Franja["key"], { es: string; en: string }> = {
  manana: { es: "Mañana (7:00)", en: "Morning (7:00)" },
  mediodia: { es: "Mediodía (12:00)", en: "Midday (12:00)" },
  tarde: { es: "Tarde (17:00)", en: "Afternoon (17:00)" },
  noche: { es: "Noche (21:00)", en: "Evening (21:00)" },
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
