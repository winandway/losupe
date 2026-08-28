import { diaLocal, rangoDelDiaLocal } from "./robot/franjas";
import { SQL_NOW } from "./sql-time";

/**
 * LECTORES DE VERDAD.
 *
 * Pedido por Richard el 25 ago 2026: *«un contador de lectores reales, que yo pueda ver desde qué
 * país me visitan, pero que sean reales, no quiero que cuenten los bots»*.
 *
 * CÓMO SE SEPARA UN LECTOR DE UN ROBOT. Con dos filtros, y el primero es el que de verdad decide:
 *
 *   1. **La visita la confirma el navegador.** No se cuenta al servir la página: se cuenta cuando el
 *      navegador ejecuta un aviso desde la propia pantalla. Los rastreadores, los que copian sitios
 *      y la mayoría de los robots piden el HTML y se van sin ejecutar nada. Ese es el filtro bueno.
 *   2. **Lista de robots conocidos**, por si alguno sí ejecuta código. Es la segunda red, no la
 *      primera.
 *
 * PRIVACIDAD, Y NO ES UN ADORNO. Aquí **no se guarda ninguna dirección IP** ni nada que identifique
 * a una persona. Para contar visitantes únicos se usa una huella hecha con la IP, el navegador y el
 * día, pasada por una función que no se puede deshacer, y **con el día dentro**: mañana la misma
 * persona da otra huella distinta, así que sirve para contar y no para seguir a nadie. Tampoco se
 * usan cookies — por eso el sitio no necesita el cartelito de aceptar cookies.
 */

/** Robots conocidos. La lista corta y honesta: la barrera de verdad es que hay que ejecutar código. */
const ROBOTS =
  /bot|crawler|spider|crawl|slurp|curl|wget|python-requests|axios|headless|lighthouse|pagespeed|preview|monitor|uptime|scrapy|facebookexternalhit|whatsapp|telegram|discord|embedly|quora|pinterest|semrush|ahrefs|mj12|dotbot|petal|bytespider|gptbot|claudebot|ccbot|perplexity|applebot|amazonbot/i;

export function esRobot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim().length < 10) return true; // sin navegador que se identifique
  return ROBOTS.test(userAgent);
}

/** Cuántos minutos cuenta alguien como «en línea ahora». */
export const MINUTOS_EN_LINEA = 5;
/** Cuánto se guarda el detalle de las visitas. Lo viejo se borra solo. */
export const DIAS_DE_HISTORIAL = 120;
/** Tope de segundos que puede sumar un solo aviso del sensor (el sensor avisa cada 2 minutos). */
export const MAX_SEGUNDOS_POR_AVISO = 180;

/**
 * Huella anónima del visitante para el día de hoy. No se puede deshacer y cambia cada día: sirve
 * para contar personas distintas, no para saber quién es ninguna.
 */
export async function huellaDelDia(
  ip: string,
  userAgent: string,
  ahora = new Date(),
): Promise<string> {
  const datos = new TextEncoder().encode(`${diaLocal(ahora)}|${ip}|${userAgent}|losupe`);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(hash)]
    .slice(0, 12)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * De dónde llegó quien está leyendo. Es la pregunta que de verdad importa para saber si el trabajo
 * de posicionamiento sirve: no es lo mismo que Google te mande gente a que entren escribiendo la
 * dirección.
 */
export type Origen = "buscador" | "redes" | "referido" | "directo";

const BUSCADORES = /google|bing|duckduckgo|yahoo|ecosia|brave|yandex|baidu|qwant|startpage/i;
const REDES =
  /facebook|instagram|twitter|^t\.co$|x\.com|linkedin|whatsapp|telegram|tiktok|reddit|youtube|pinterest|threads|bsky|mastodon/i;

export function clasificarOrigen(referente: string | null | undefined): Origen {
  const r = (referente ?? "").trim().toLowerCase();
  if (!r || r.includes("losupe.com")) return "directo";
  if (BUSCADORES.test(r)) return "buscador";
  if (REDES.test(r)) return "redes";
  return "referido";
}

export type VisitaEntrante = {
  ruta: string;
  lang: string | null;
  pais: string | null;
  referente: string | null;
  ip: string;
  userAgent: string;
  /** Segundos leídos desde el aviso anterior. */
  segundos?: number;
};

/**
 * Anota (o actualiza) una lectura. Nunca lanza: un contador jamás puede tumbar una página.
 *
 * UNA FILA POR LECTURA, no por cada aviso del sensor: la misma persona leyendo la misma nota el
 * mismo día es **una** lectura, y lo que va cambiando es cuánto tiempo lleva. Así el tiempo de
 * lectura se puede sumar de verdad y la cuenta de lectores no se infla con los avisos periódicos.
 */
export async function anotarVisita(
  db: D1Database,
  v: VisitaEntrante,
  ahora = new Date(),
): Promise<boolean> {
  if (esRobot(v.userAgent)) return false;
  const ruta = v.ruta.slice(0, 300);
  if (!ruta.startsWith("/")) return false;
  // Un aviso no puede sumar más tiempo del que hay entre dos avisos: así una pestaña que devuelve
  // un número absurdo no ensucia las cuentas.
  const segundos = Math.max(0, Math.min(Math.round(v.segundos ?? 0), MAX_SEGUNDOS_POR_AVISO));
  try {
    const visitante = await huellaDelDia(v.ip, v.userAgent, ahora);
    await db
      .prepare(
        `INSERT INTO visitas (id, ts, dia, pais, ruta, lang, visitante, referente, origen, segundos)
         VALUES (?1, ${SQL_NOW}, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT(dia, visitante, ruta) DO UPDATE SET
           ts = ${SQL_NOW},
           segundos = segundos + ?9,
           pais = COALESCE(visitas.pais, excluded.pais)`,
      )
      .bind(
        crypto.randomUUID(),
        diaLocal(ahora),
        (v.pais ?? "").slice(0, 2).toUpperCase() || null,
        ruta,
        v.lang === "en" ? "en" : "es",
        visitante,
        v.referente ? v.referente.slice(0, 200) : null,
        clasificarOrigen(v.referente),
        segundos,
      )
      .run();
    return true;
  } catch {
    return false;
  }
}

export type ResumenLectores = {
  enLinea: number;
  hoy: { lectores: number; visitas: number };
  semana: { lectores: number; visitas: number };
  mes: { lectores: number; visitas: number };
  paises: { pais: string; lectores: number }[];
  masLeidas: { ruta: string; visitas: number }[];
  /** Lectores por hora del día de hoy, en hora del Este. Para ver a qué hora entran. */
  porHora: { hora: number; lectores: number }[];
  total: number;
};

const VACIO: ResumenLectores = {
  enLinea: 0,
  hoy: { lectores: 0, visitas: 0 },
  semana: { lectores: 0, visitas: 0 },
  mes: { lectores: 0, visitas: 0 },
  paises: [],
  masLeidas: [],
  porHora: [],
  total: 0,
};

export async function resumenDeLectores(
  db: D1Database,
  ahora = new Date(),
): Promise<ResumenLectores> {
  try {
    const hace = (ms: number) => new Date(ahora.getTime() - ms).toISOString();
    const { desde: inicioHoy } = rangoDelDiaLocal(ahora);
    const uno = async <T>(sql: string, ...bind: unknown[]) =>
      (await db
        .prepare(sql)
        .bind(...bind)
        .first<T>()) ?? null;

    const [enLinea, hoy, semana, mes, total] = await Promise.all([
      uno<{ n: number }>(
        `SELECT COUNT(DISTINCT visitante) AS n FROM visitas WHERE ts > ?1`,
        hace(MINUTOS_EN_LINEA * 60_000),
      ),
      uno<{ l: number; v: number }>(
        `SELECT COUNT(DISTINCT visitante) AS l, COUNT(*) AS v FROM visitas WHERE ts >= ?1`,
        inicioHoy,
      ),
      uno<{ l: number; v: number }>(
        `SELECT COUNT(DISTINCT visitante) AS l, COUNT(*) AS v FROM visitas WHERE ts > ?1`,
        hace(7 * 86_400_000),
      ),
      uno<{ l: number; v: number }>(
        `SELECT COUNT(DISTINCT visitante) AS l, COUNT(*) AS v FROM visitas WHERE ts > ?1`,
        hace(30 * 86_400_000),
      ),
      uno<{ n: number }>(`SELECT COUNT(*) AS n FROM visitas`),
    ]);

    const { results: paises } = await db
      .prepare(
        `SELECT pais, COUNT(DISTINCT visitante) AS lectores FROM visitas
         WHERE ts > ?1 AND pais IS NOT NULL
         GROUP BY pais ORDER BY lectores DESC LIMIT 20`,
      )
      .bind(hace(30 * 86_400_000))
      .all<{ pais: string; lectores: number }>();

    const { results: masLeidas } = await db
      .prepare(
        `SELECT ruta, COUNT(*) AS visitas FROM visitas
         WHERE ts > ?1 GROUP BY ruta ORDER BY visitas DESC LIMIT 12`,
      )
      .bind(hace(7 * 86_400_000))
      .all<{ ruta: string; visitas: number }>();

    const { results: horas } = await db
      .prepare(
        `SELECT substr(ts, 12, 2) AS h, COUNT(DISTINCT visitante) AS lectores FROM visitas
         WHERE ts >= ?1 GROUP BY h ORDER BY h`,
      )
      .bind(inicioHoy)
      .all<{ h: string; lectores: number }>();

    return {
      enLinea: Number(enLinea?.n ?? 0),
      hoy: { lectores: Number(hoy?.l ?? 0), visitas: Number(hoy?.v ?? 0) },
      semana: { lectores: Number(semana?.l ?? 0), visitas: Number(semana?.v ?? 0) },
      mes: { lectores: Number(mes?.l ?? 0), visitas: Number(mes?.v ?? 0) },
      paises: paises.map((p) => ({ pais: p.pais, lectores: Number(p.lectores) })),
      masLeidas: masLeidas.map((m) => ({ ruta: m.ruta, visitas: Number(m.visitas) })),
      porHora: horas.map((h) => ({ hora: Number(h.h), lectores: Number(h.lectores) })),
      total: Number(total?.n ?? 0),
    };
  } catch {
    return VACIO;
  }
}

/** Borra el detalle viejo. Se llama desde la corrida del robot; no hace falta otro reloj. */
export async function limpiarVisitasViejas(db: D1Database, ahora = new Date()): Promise<number> {
  try {
    const limite = new Date(ahora.getTime() - DIAS_DE_HISTORIAL * 86_400_000).toISOString();
    const r = await db.prepare(`DELETE FROM visitas WHERE ts < ?1`).bind(limite).run();
    return r.meta?.changes ?? 0;
  } catch {
    return 0;
  }
}

/** El nombre del país en español, para no enseñar códigos de dos letras. */
export const PAISES: Record<string, string> = {
  US: "Estados Unidos",
  MX: "México",
  CO: "Colombia",
  VE: "Venezuela",
  ES: "España",
  AR: "Argentina",
  PE: "Perú",
  CL: "Chile",
  EC: "Ecuador",
  DO: "República Dominicana",
  GT: "Guatemala",
  CU: "Cuba",
  BO: "Bolivia",
  HN: "Honduras",
  PY: "Paraguay",
  SV: "El Salvador",
  NI: "Nicaragua",
  CR: "Costa Rica",
  PA: "Panamá",
  UY: "Uruguay",
  PR: "Puerto Rico",
  BR: "Brasil",
  CA: "Canadá",
  GB: "Reino Unido",
  FR: "Francia",
  DE: "Alemania",
  IT: "Italia",
  PT: "Portugal",
  NL: "Países Bajos",
  IN: "India",
  CN: "China",
  JP: "Japón",
  AU: "Australia",
};

/** La bandera del país en emoji, a partir de su código de dos letras. */
export function bandera(codigo: string): string {
  if (!/^[A-Z]{2}$/.test(codigo)) return "🏳️";
  return String.fromCodePoint(
    ...[...codigo].map((c) => 0x1f1e6 + (c.charCodeAt(0) - "A".charCodeAt(0))),
  );
}

export function nombreDePais(codigo: string): string {
  return PAISES[codigo] ?? codigo;
}
