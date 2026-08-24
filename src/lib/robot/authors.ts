import type { SectionId } from "@/lib/sections";

/**
 * Reparto de firmas entre el equipo de redacción. Cada nota la firma una persona distinta: se elige
 * primero entre quienes tienen esa sección como especialidad y, dentro de ese grupo, el que hace
 * más tiempo que no publica. Así rota solo, sin repetir siempre a la misma y sin que nadie quede
 * fuera. Si nadie tiene la especialidad, entra todo el equipo activo al mismo turno.
 */

export type WriterRow = {
  id: string;
  name: string;
  sections_json: string | null;
  last_published: string | null;
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
    }))
    .sort((a, b) => {
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
export async function pickWriter(db: D1Database, sectionId: SectionId): Promise<WriterPick | null> {
  const { results } = await db
    .prepare(
      `SELECT au.id, au.name, au.sections_json,
              (SELECT MAX(ar.published_at) FROM articles ar WHERE ar.author_id = au.id) AS last_published
       FROM authors au
       WHERE au.active = 1 AND au.kind = 'person' AND au.sections_json IS NOT NULL AND au.sections_json != '[]'`,
    )
    .all<WriterRow>();
  if (results.length === 0) return null;
  return rankWriters(results, sectionId)[0] ?? null;
}
