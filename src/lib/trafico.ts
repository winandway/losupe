import { diaLocal, rangoDelDiaLocal } from "./robot/franjas";
import { bandera, nombreDePais, type Origen } from "./lectores";

/**
 * EL TRÁFICO DEL DIARIO, CON SU HISTORIAL.
 *
 * Pedido por Richard el 25 ago 2026: *«cuántas personas entraron este mes, cuántas el mes pasado,
 * esta semana, la semana pasada, hoy, ayer… qué noticia leyeron, por dónde llegaron y cuánto tiempo
 * estuvieron leyendo»*.
 *
 * Todo sale de la misma tabla `visitas`, que guarda **una fila por lectura** (una persona, una nota,
 * un día) con el tiempo acumulado. Sin Google Analytics ni rastreadores ajenos, y sin guardar
 * direcciones IP: ver `lectores.ts`.
 */

export type Periodo = {
  clave: string;
  etiqueta: string;
  lectores: number;
  lecturas: number;
  /** Media de tiempo leyendo, en segundos. */
  tiempoMedio: number;
  /** Cuánto sube o baja frente al periodo anterior comparable, en porcentaje. */
  variacion: number | null;
};

export type FilaRuta = {
  ruta: string;
  lectores: number;
  lecturas: number;
  tiempoMedio: number;
};

export type FilaDia = { dia: string; lectores: number; lecturas: number };

export type Trafico = {
  periodos: Periodo[];
  origenes: { origen: Origen; lectores: number; porcentaje: number }[];
  paises: { pais: string; nombre: string; bandera: string; lectores: number }[];
  masLeidas: FilaRuta[];
  porDia: FilaDia[];
  /** De dónde vienen exactamente (dominios), para ver qué buscador o red trae gente. */
  referentes: { referente: string; lectores: number }[];
  total: { lecturas: number; desde: string | null };
};

const VACIO: Trafico = {
  periodos: [],
  origenes: [],
  paises: [],
  masLeidas: [],
  porDia: [],
  referentes: [],
  total: { lecturas: 0, desde: null },
};

/** Los seis periodos que pidió Richard, cada uno con el anterior para poder comparar. */
function ventanas(ahora: Date) {
  const { desde: hoy0 } = rangoDelDiaLocal(ahora);
  const dia = 86_400_000;
  const ayer0 = new Date(Date.parse(hoy0) - dia).toISOString();
  const semana0 = new Date(Date.parse(hoy0) - 6 * dia).toISOString();
  const semanaPasada0 = new Date(Date.parse(hoy0) - 13 * dia).toISOString();
  const mes0 = new Date(Date.parse(hoy0) - 29 * dia).toISOString();
  const mesPasado0 = new Date(Date.parse(hoy0) - 59 * dia).toISOString();
  return [
    { clave: "hoy", etiqueta: "Hoy", desde: hoy0, hasta: null as string | null },
    { clave: "ayer", etiqueta: "Ayer", desde: ayer0, hasta: hoy0 },
    { clave: "semana", etiqueta: "Últimos 7 días", desde: semana0, hasta: null },
    { clave: "semanaPasada", etiqueta: "7 días anteriores", desde: semanaPasada0, hasta: semana0 },
    { clave: "mes", etiqueta: "Últimos 30 días", desde: mes0, hasta: null },
    { clave: "mesPasado", etiqueta: "30 días anteriores", desde: mesPasado0, hasta: mes0 },
  ];
}

export function variacion(actual: number, anterior: number): number | null {
  if (anterior === 0) return actual > 0 ? 100 : null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

export async function resumenDeTrafico(db: D1Database, ahora = new Date()): Promise<Trafico> {
  try {
    const uno = async (desde: string, hasta: string | null) => {
      const sql = hasta
        ? `SELECT COUNT(DISTINCT visitante) AS l, COUNT(*) AS v, AVG(segundos) AS t
           FROM visitas WHERE ts >= ?1 AND ts < ?2`
        : `SELECT COUNT(DISTINCT visitante) AS l, COUNT(*) AS v, AVG(segundos) AS t
           FROM visitas WHERE ts >= ?1`;
      const st = hasta ? db.prepare(sql).bind(desde, hasta) : db.prepare(sql).bind(desde);
      const r = await st.first<{ l: number; v: number; t: number | null }>();
      return {
        lectores: Number(r?.l ?? 0),
        lecturas: Number(r?.v ?? 0),
        tiempoMedio: Math.round(Number(r?.t ?? 0)),
      };
    };

    const v = ventanas(ahora);
    const datos = await Promise.all(v.map((x) => uno(x.desde, x.hasta)));
    const periodos: Periodo[] = v.map((x, i) => {
      // Cada periodo se compara con el siguiente de la lista, que es su anterior comparable.
      const anterior = i % 2 === 0 ? datos[i + 1] : undefined;
      return {
        clave: x.clave,
        etiqueta: x.etiqueta,
        ...datos[i]!,
        variacion: anterior ? variacion(datos[i]!.lectores, anterior.lectores) : null,
      };
    });

    const mesDesde = v[4]!.desde;

    const { results: origenes } = await db
      .prepare(
        `SELECT COALESCE(origen, 'directo') AS origen, COUNT(DISTINCT visitante) AS lectores
         FROM visitas WHERE ts >= ?1 GROUP BY origen ORDER BY lectores DESC`,
      )
      .bind(mesDesde)
      .all<{ origen: string; lectores: number }>();
    const totalOrigenes = origenes.reduce((a, b) => a + Number(b.lectores), 0) || 1;

    const { results: paises } = await db
      .prepare(
        `SELECT pais, COUNT(DISTINCT visitante) AS lectores FROM visitas
         WHERE ts >= ?1 AND pais IS NOT NULL GROUP BY pais ORDER BY lectores DESC LIMIT 25`,
      )
      .bind(mesDesde)
      .all<{ pais: string; lectores: number }>();

    const { results: masLeidas } = await db
      .prepare(
        `SELECT ruta, COUNT(DISTINCT visitante) AS lectores, COUNT(*) AS lecturas,
                AVG(segundos) AS t
         FROM visitas WHERE ts >= ?1 GROUP BY ruta ORDER BY lectores DESC LIMIT 25`,
      )
      .bind(mesDesde)
      .all<{ ruta: string; lectores: number; lecturas: number; t: number | null }>();

    const { results: porDia } = await db
      .prepare(
        `SELECT dia, COUNT(DISTINCT visitante) AS lectores, COUNT(*) AS lecturas
         FROM visitas WHERE ts >= ?1 GROUP BY dia ORDER BY dia`,
      )
      .bind(mesDesde)
      .all<{ dia: string; lectores: number; lecturas: number }>();

    const { results: referentes } = await db
      .prepare(
        `SELECT referente, COUNT(DISTINCT visitante) AS lectores FROM visitas
         WHERE ts >= ?1 AND referente IS NOT NULL AND referente != ''
         GROUP BY referente ORDER BY lectores DESC LIMIT 12`,
      )
      .bind(mesDesde)
      .all<{ referente: string; lectores: number }>();

    const total = await db
      .prepare(`SELECT COUNT(*) AS n, MIN(dia) AS desde FROM visitas`)
      .first<{ n: number; desde: string | null }>();

    return {
      periodos,
      origenes: origenes.map((o) => ({
        origen: o.origen as Origen,
        lectores: Number(o.lectores),
        porcentaje: Math.round((Number(o.lectores) / totalOrigenes) * 100),
      })),
      paises: paises.map((p) => ({
        pais: p.pais,
        nombre: nombreDePais(p.pais),
        bandera: bandera(p.pais),
        lectores: Number(p.lectores),
      })),
      masLeidas: masLeidas.map((m) => ({
        ruta: m.ruta,
        lectores: Number(m.lectores),
        lecturas: Number(m.lecturas),
        tiempoMedio: Math.round(Number(m.t ?? 0)),
      })),
      porDia: porDia.map((d) => ({
        dia: d.dia,
        lectores: Number(d.lectores),
        lecturas: Number(d.lecturas),
      })),
      referentes: referentes.map((r) => ({
        referente: r.referente,
        lectores: Number(r.lectores),
      })),
      total: { lecturas: Number(total?.n ?? 0), desde: total?.desde ?? null },
    };
  } catch {
    return VACIO;
  }
}

/** «3 min 20 s», que se lee de un vistazo. */
export function tiempoLegible(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos <= 0) return "—";
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  if (m === 0) return `${s} s`;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

/** El día en palabras: «lun 25 ago». */
export function diaLegible(dia: string, hoy = diaLocal(new Date())): string {
  if (dia === hoy) return "hoy";
  const [y, m, d] = dia.split("-").map(Number);
  if (!y || !m || !d) return dia;
  const fecha = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("es", { weekday: "short", day: "numeric", month: "short" }).format(
    fecha,
  );
}

export const NOMBRE_ORIGEN: Record<Origen, string> = {
  buscador: "Buscadores (Google y demás)",
  redes: "Redes sociales",
  referido: "Otros sitios que nos enlazan",
  directo: "Directo (escriben la dirección)",
};
