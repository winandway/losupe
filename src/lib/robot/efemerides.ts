import type { SectionId } from "@/lib/sections";
import { partesEnZona } from "./franjas";

/**
 * QUÉ SE CUMPLE HOY.
 *
 * Richard, 24 ago 2026: *«Juan Gabriel acaba de cumplir diez años de fallecido, nosotros no le hemos
 * publicado»*. Y tenía razón: un diario que no sabe qué día es se pierde justo las notas que la
 * gente estaba esperando leer.
 *
 * Los datos salen de Wikipedia, que tiene una lista de efemérides por día abierta y sin llaves. Dos
 * motivos para elegirla: es **citable** —cada efeméride trae su artículo, así que la nota no se
 * inventa nada— y no cuesta un centavo.
 *
 * Se priorizan los aniversarios REDONDOS (10, 25, 50, 100 años). Un «hace 37 años» no le importa a
 * nadie; un «diez años sin Juan Gabriel» es una nota que se lee y se comparte.
 */

const API = "https://api.wikimedia.org/feed/v1/wikipedia/es/onthisday/all/{mes}/{dia}" as const;

export type Efemeride = {
  /** El año del hecho. */
  year: number;
  /** Cuántos años se cumplen hoy. */
  aniversario: number;
  texto: string;
  /** Enlaces de Wikipedia para documentar la nota. Sin fuentes no se escribe. */
  fuentes: { titulo: string; url: string }[];
  sectionId: SectionId;
  /** Los redondos van primero: son los que de verdad importan. */
  redondo: boolean;
};

/** Aniversarios que la gente celebra. Lo demás es solo una fecha. */
export const ANIVERSARIOS_REDONDOS = [10, 20, 25, 30, 40, 50, 60, 75, 100, 150, 200];

/** A qué sección va cada efeméride. `null` = no es tema nuestro y se descarta. */
export function seccionDeEfemeride(texto: string): SectionId | null {
  const t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (
    /\b(cantante|musico|musica|cantautor|compositor|actor|actriz|cineasta|director de cine|pelicula|album|banda|grupo musical|artista|pintor|escritor|novelista|poeta|premio nobel de literatura|festival)\b/.test(
      t,
    )
  ) {
    return "artistas";
  }
  if (
    /\b(internet|computadora|ordenador|software|telefono|satelite|cohete|nasa|inventa|invencion|patente|robot|nuclear|electricidad|television|radio|inteligencia artificial)\b/.test(
      t,
    )
  ) {
    return "tecnologia";
  }
  if (/\b(bitcoin|criptomoneda|blockchain)\b/.test(t)) return "cripto";
  if (
    /\b(bolsa|crack|crisis economica|banco|moneda|dolar|economia|empresa|fundo la compania|fundada)\b/.test(
      t,
    )
  ) {
    return "economia";
  }
  return null;
}

type RespuestaWiki = {
  events?: WikiItem[];
  deaths?: WikiItem[];
  births?: WikiItem[];
};
type WikiItem = {
  text?: string;
  year?: number;
  pages?: { titles?: { normalized?: string }; content_urls?: { desktop?: { page?: string } } }[];
};

function aEfemeride(item: WikiItem, hoy: number, prefijo: string): Efemeride | null {
  const year = Number(item.year);
  if (!Number.isFinite(year) || !item.text) return null;
  const aniversario = hoy - year;
  if (aniversario <= 0) return null;
  const texto = `${prefijo}${item.text}`.trim();
  const sectionId = seccionDeEfemeride(texto);
  if (!sectionId) return null;
  const fuentes = (item.pages ?? [])
    .map((p) => ({
      titulo: p.titles?.normalized ?? "",
      url: p.content_urls?.desktop?.page ?? "",
    }))
    .filter((f) => f.titulo && f.url)
    .slice(0, 3);
  if (fuentes.length === 0) return null; // sin dónde documentarla, no se escribe
  return {
    year,
    aniversario,
    texto,
    fuentes,
    sectionId,
    redondo: ANIVERSARIOS_REDONDOS.includes(aniversario),
  };
}

/** Ordena: primero los aniversarios redondos, y entre ellos el más redondo (más años). */
export function ordenarEfemerides(items: readonly Efemeride[]): Efemeride[] {
  return [...items].sort((a, b) => {
    if (a.redondo !== b.redondo) return a.redondo ? -1 : 1;
    return b.aniversario - a.aniversario;
  });
}

/**
 * Las efemérides de hoy que son tema nuestro, las mejores primero. No lanza: si Wikipedia no
 * responde, se devuelve una lista vacía y el diario sigue con lo demás.
 */
export async function efemeridesDeHoy(
  ahora = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<Efemeride[]> {
  const { y, m, d } = partesEnZona(ahora);
  const url = API.replace("{mes}", String(m).padStart(2, "0")).replace(
    "{dia}",
    String(d).padStart(2, "0"),
  );
  try {
    const res = await fetchImpl(url, {
      headers: { "user-agent": "losupe.com/1.0 (https://losupe.com)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as RespuestaWiki;
    const out: Efemeride[] = [];
    for (const [lista, prefijo] of [
      [body.deaths ?? [], "Murió "],
      [body.births ?? [], "Nació "],
      [body.events ?? [], ""],
    ] as const) {
      for (const item of lista) {
        const e = aEfemeride(item, y, prefijo);
        if (e) out.push(e);
      }
    }
    return ordenarEfemerides(out);
  } catch {
    return [];
  }
}

/** El titular que se le encarga al redactor a partir de una efeméride. */
export function titularDeEfemeride(e: Efemeride): string {
  const quien = e.fuentes[0]?.titulo ?? "";
  if (e.texto.startsWith("Murió ") && quien) {
    return `${e.aniversario} años sin ${quien}`;
  }
  if (e.texto.startsWith("Nació ") && quien) {
    return `${quien}: ${e.aniversario} años de su nacimiento`;
  }
  return `Hace ${e.aniversario} años: ${e.texto.slice(0, 90)}`;
}
