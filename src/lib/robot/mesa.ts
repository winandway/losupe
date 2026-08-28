import type { SectionId } from "@/lib/sections";
import { getSetting } from "./budget";
import { efemeridesDeHoy, titularDeEfemeride, type Efemeride } from "./efemerides";
import { franjaActiva, type Franja } from "./franjas";
import { siguienteIdea, type Idea } from "./ideas";

/**
 * LA MESA DE REDACCIÓN.
 *
 * Es el jefe de redacción del diario: **decide qué se escribe antes de que nadie escriba**. Lo pidió
 * Richard el 24 ago 2026: *«deberíamos tener un cerebro, que sería como el gerente que prepara todo
 * antes de llegar a la IA que escribe… el que manda al redactor»*.
 *
 * Hasta ahora el robot solo reaccionaba: escribía lo que trajera el RSS y punto. Si las fuentes no
 * lo mencionaban, para nosotros no existía — así se perdieron los diez años sin Juan Gabriel. Ahora
 * hay tres géneros y un reparto, como en cualquier redacción de verdad:
 *
 *   ACTUALIDAD   lo que está pasando (RSS y tendencias). Es la base del diario.
 *   PROPIA       curiosidades y listas: «10 curiosidades sobre…», «los 10 errores más grandes de…».
 *                No caducan, se leen enteras y se comparten.
 *   EFEMÉRIDE    qué se cumple hoy, cuando toca un aniversario redondo.
 *
 * QUIÉN DECIDE EL GÉNERO: la escaleta (`FRANJAS` en `franjas.ts`), no un porcentaje. Cada franja
 * tiene el suyo asignado — 2 de actualidad y 2 de curiosidades al día.
 *
 * Antes esto era un porcentaje y salió mal: el cálculo se hacía sobre un contador que se reinicia
 * cada día, así que con tres notas nunca llegaba al umbral y **todas** salían de curiosidades.
 * Siete seguidas, cero de actualidad (25-28 ago 2026). Una redacción trabaja con escaleta, no con
 * porcentajes.
 *
 * Y la efeméride **ya no manda sobre todo**: solo puede ocupar un hueco de curiosidades. Un «diez
 * años sin» es una nota estupenda, pero no puede comerse la actualidad del día.
 */

export type GeneroEncargo = "actualidad" | "propia" | "efemeride";

export type Encargo =
  | { genero: "actualidad" }
  | { genero: "propia"; idea: Idea }
  | { genero: "efemeride"; efemeride: Efemeride; titular: string; sectionId: SectionId };

/**
 * Se conserva por compatibilidad con los ajustes guardados, pero **ya no decide nada**: el género
 * lo pone la escaleta. Se dejó a propósito para que un ajuste viejo en la base no rompa nada.
 */
export const RATIO_PROPIAS_POR_DEFECTO = 0.4;

export type ReglasMesa = {
  ratioPropias: number;
  /** ¿Se aprovechan las efemérides redondas? Se puede apagar desde el panel. */
  efemerides: boolean;
};

export async function reglasDeLaMesa(db: D1Database): Promise<ReglasMesa> {
  const leer = async (key: string) => {
    try {
      return (await getSetting(db, key))?.trim() ?? "";
    } catch {
      return "";
    }
  };
  const crudo = await leer("mesa_ratio_propias");
  const n = crudo === "" ? NaN : Number(crudo);
  return {
    ratioPropias: Number.isFinite(n) && n >= 0 && n <= 1 ? n : RATIO_PROPIAS_POR_DEFECTO,
    efemerides: (await leer("mesa_efemerides")) !== "0",
  };
}

/**
 * Decide qué género toca en este turno.
 *
 * `notasHoy` es cuántas notas del robot llevan publicadas hoy: sirve para repartir a lo largo del
 * día sin llevar una cuenta aparte que pueda desincronizarse.
 */
export function elegirGenero(
  franja: Franja | null,
  notasHoy: number,
  reglas: ReglasMesa,
  hayEfemerideRedonda: boolean,
  hayActualidad: boolean,
): GeneroEncargo {
  // 1) Manda la escaleta. Si la corrida es a mano (fuera de franja), se alterna por posición del
  //    día, que da el mismo reparto: par → actualidad, impar → curiosidades.
  const toca: Franja["genero"] = franja
    ? franja.genero
    : notasHoy % 2 === 0
      ? "actualidad"
      : "propia";

  // 2) Si toca actualidad y la hay, se escribe actualidad. Punto. La efeméride NO se cuela aquí:
  //    ese fue el fallo que dejó al diario siete notas sin una sola noticia.
  if (toca === "actualidad") return hayActualidad ? "actualidad" : "propia";

  // 3) En el hueco de curiosidades sí manda la efeméride, porque solo se puede contar HOY.
  if (reglas.efemerides && hayEfemerideRedonda) return "efemeride";
  return "propia";
}

/**
 * El encargo del turno, ya resuelto: qué género y, si es propio o efeméride, sobre qué.
 *
 * `titularesRecientes` son los titulares ya publicados, para no repetir tema. `seccionesConCupo`
 * son las secciones que todavía tienen sitio hoy.
 */
export async function encargoDelTurno(
  db: D1Database,
  opts: {
    notasHoy: number;
    hayActualidad: boolean;
    titularesRecientes: readonly string[];
    seccionesConCupo: readonly SectionId[];
    /** La franja de este turno. Si no se pasa, se deduce del reloj. */
    franja?: Franja | null;
    ahora?: Date;
    fetchImpl?: typeof fetch;
  },
): Promise<Encargo> {
  const reglas = await reglasDeLaMesa(db);
  const ahora = opts.ahora ?? new Date();

  let efemeride: Efemeride | null = null;
  const huecoDeCuriosidades =
    (opts.franja ?? franjaActiva(ahora))?.genero !== "actualidad" || !opts.hayActualidad;
  if (reglas.efemerides && huecoDeCuriosidades && opts.seccionesConCupo.length > 0) {
    const lista = await efemeridesDeHoy(ahora, opts.fetchImpl);
    efemeride = lista.find((e) => e.redondo && opts.seccionesConCupo.includes(e.sectionId)) ?? null;
    // Y que no la hayamos contado ya (el robot corre tres veces al día).
    if (efemeride) {
      const titular = titularDeEfemeride(efemeride);
      const yaEsta = opts.titularesRecientes.some((t) =>
        t.toLowerCase().includes((efemeride?.fuentes[0]?.titulo ?? "###").toLowerCase()),
      );
      if (yaEsta) efemeride = null;
      else if (!titular) efemeride = null;
    }
  }

  const franja = opts.franja ?? franjaActiva(ahora);
  const genero = elegirGenero(
    franja,
    opts.notasHoy,
    reglas,
    Boolean(efemeride),
    opts.hayActualidad,
  );

  if (genero === "efemeride" && efemeride) {
    return {
      genero: "efemeride",
      efemeride,
      titular: titularDeEfemeride(efemeride),
      sectionId: efemeride.sectionId,
    };
  }

  if (genero === "propia") {
    // Se reparte entre las secciones con cupo, empezando por la que menos ha salido hoy.
    for (let i = 0; i < opts.seccionesConCupo.length; i++) {
      const seccion = opts.seccionesConCupo[(opts.notasHoy + i) % opts.seccionesConCupo.length];
      if (!seccion) continue;
      // La franja dice qué clase de pieza toca: curiosidades al mediodía, rankings por la noche.
      const idea = siguienteIdea(
        seccion,
        opts.titularesRecientes,
        opts.notasHoy,
        franja?.subgenero,
      );
      if (idea) return { genero: "propia", idea };
    }
  }

  return { genero: "actualidad" };
}
