import type { SectionId } from "@/lib/sections";
import { rangoDelDiaLocal } from "./franjas";

/**
 * Reparto de firmas entre el equipo de redacción. Cada nota la firma una persona distinta: se elige
 * primero entre quienes tienen esa sección como especialidad y, dentro de ese grupo, el que hace
 * más tiempo que no publica. Así rota solo, sin repetir siempre a la misma y sin que nadie quede
 * fuera. Si nadie tiene la especialidad, entra todo el equipo activo al mismo turno.
 *
 * REGLA DEL DÍA (24 ago 2026, dictada por Richard): quien ya firmó hoy pasa al final de la cola.
 * Salen tres notas al día y hay tres personas: una por franja. Que la misma firme dos o tres notas
 * en un día no se lo cree nadie — «nadie tiene esa capacidad» — y delata que detrás hay una
 * máquina. Solo se repite si el resto del equipo ya publicó, y entonces se repite al que menos.
 */

export type WriterRow = {
  id: string;
  name: string;
  sections_json: string | null;
  last_published: string | null;
  /** Cuántas notas lleva firmadas HOY (día del Este). Quien lleve más, va al final. */
  today?: number;
};

export type WriterPick = { id: string; name: string; specialist: boolean };

export function parseSections(json: string | null): string[] {
  try {
    const parsed = JSON.parse(json ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === "string") : [];
  } catch {
    return [];
  }
}

/** Ordena el equipo para una sección: especialistas primero, y dentro de cada grupo el más «frío». */
export function rankWriters(rows: readonly WriterRow[], sectionId: SectionId): WriterPick[] {
  return [...rows]
    .map((r) => ({
      id: r.id,
      name: r.name,
      specialist: parseSections(r.sections_json).includes(sectionId),
      // Quien nunca ha publicado va primero: así entra al turno desde su primera nota.
      last: r.last_published ?? "",
      today: r.today ?? 0,
    }))
    .sort((a, b) => {
      // 1º: quien no ha firmado hoy. Manda sobre la especialidad — un especialista que ya publicó
      // esta mañana no vuelve a firmar al mediodía mientras haya compañeros libres.
      if (a.today !== b.today) return a.today - b.today;
      if (a.specialist !== b.specialist) return a.specialist ? -1 : 1;
      if (a.last !== b.last) return a.last < b.last ? -1 : 1;
      return a.id < b.id ? -1 : 1;
    })
    .map(({ id, name, specialist }) => ({ id, name, specialist }));
}

/**
 * Siguiente firma para una nota de esa sección. Devuelve `null` si no hay nadie activo (el llamador
 * usa entonces `settings.default_author`).
 */
export async function pickWriter(
  db: D1Database,
  sectionId: SectionId,
  now = new Date(),
): Promise<WriterPick | null> {
  const { desde, hasta } = rangoDelDiaLocal(now);
  const { results } = await db
    .prepare(
      `SELECT au.id, au.name, au.sections_json,
              (SELECT MAX(ar.published_at) FROM articles ar WHERE ar.author_id = au.id) AS last_published,
              (SELECT COUNT(*) FROM articles ar WHERE ar.author_id = au.id
                 AND ar.created_at >= ?1 AND ar.created_at < ?2) AS today
       FROM authors au
       WHERE au.active = 1 AND au.kind = 'person' AND au.sections_json IS NOT NULL AND au.sections_json != '[]'`,
    )
    .bind(desde, hasta)
    .all<WriterRow>();
  if (results.length === 0) return null;
  return rankWriters(results, sectionId)[0] ?? null;
}
