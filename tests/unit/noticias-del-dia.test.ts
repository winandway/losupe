import { describe, expect, it } from "vitest";
import { pickCandidate, robotNotesToday } from "@/lib/robot/universal";
import { FRANJAS } from "@/lib/robot/franjas";
import { FakeD1 } from "./fake-d1";

/**
 * Candado 55 — tres noticias nuevas al día en Tecnología e IA y otras tres en Artistas (1 oct 2026).
 * De esas dos secciones salen los guiones de los dos canales de video de Richard: si se quedan
 * viejas, no hay nada que grabar. El día que lo pidió, la portada de Tecnología mostraba notas del
 * 24, del 9 y del 8 de septiembre, y dos eran efemérides.
 */

const AHORA = new Date("2026-10-01T16:00:00Z");

const fila = (id: string, seccion: string, horasAtras: number) => ({
  id,
  section_id: seccion,
  url: `https://ejemplo.com/${id}`,
  title: `Nota ${id}`,
  summary: "resumen",
  lang: "es",
  published_at: new Date(AHORA.getTime() - horasAtras * 3_600_000).toISOString(),
  score: 10,
});

/** Base falsa con las cinco secciones y los candidatos que decida la prueba. */
function base(candidatos: ReturnType<typeof fila>[], publicadasHoy: Record<string, number> = {}) {
  return new FakeD1((sql, params) => {
    if (sql.includes("FROM sections"))
      return [
        { id: "economia", notes_per_day: 9 },
        { id: "ventas", notes_per_day: 9 },
        { id: "tecnologia", notes_per_day: 3 },
        { id: "cripto", notes_per_day: 9 },
        { id: "artistas", notes_per_day: 3 },
      ];
    if (sql.includes("COUNT(*) AS n FROM articles"))
      return Object.entries(publicadasHoy).map(([section_id, n]) => ({ section_id, n }));
    if (sql.includes("FROM candidates") && sql.includes("status = 'new'")) {
      const seccion = String(params[0]);
      const desde = sql.includes("published_at >= ?4") ? String(params[3]) : null;
      return candidatos.filter(
        (c) => c.section_id === seccion && (!desde || c.published_at >= desde),
      );
    }
    return [];
  });
}

describe("el turno manda la sección: tecnología y artistas no dependen del cupo sobrante", () => {
  it("si el turno es de artistas, se busca en artistas aunque otras tengan más cupo libre", async () => {
    // Economía tiene nueve de cupo libre y artistas tres: con la regla vieja (la de más cupo
    // primero) ganaba economía SIEMPRE, y por eso las dos secciones de los canales se quedaban
    // viejas.
    const db = base([fila("art-1", "artistas", 3), fila("eco-1", "economia", 2)]);
    const elegido = await pickCandidate(db.asD1(), AHORA, [], { seccion: "artistas" });
    expect(elegido?.sectionId).toBe("artistas");
    const primera = db.calls.find((c) => c.sql.includes("FROM candidates"));
    expect(primera?.params[0]).toBe("artistas");
  });

  it("sin turno asignado, sigue mandando el cupo libre (economía, ventas y cripto como siempre)", async () => {
    const db = base([fila("eco-1", "economia", 2)]);
    const elegido = await pickCandidate(db.asD1(), AHORA, []);
    expect(elegido?.sectionId).toBe("economia");
  });
});

describe("una noticia es de hoy, no de hace tres semanas", () => {
  it("entre una fresca y una vieja, se elige la fresca", async () => {
    const db = base([fila("vieja", "tecnologia", 240), fila("fresca", "tecnologia", 5)]);
    const elegido = await pickCandidate(db.asD1(), AHORA, [], { seccion: "tecnologia" });
    expect(elegido?.id).toBe("fresca");
    // Y la primera consulta pide explícitamente lo publicado desde hace poco.
    expect(db.calls.find((c) => c.sql.includes("FROM candidates"))?.sql).toContain(
      "published_at >= ?4",
    );
  });

  it("si no hay NADA fresco, se publica lo que haya antes que dejar el turno vacío", async () => {
    const db = base([fila("vieja", "tecnologia", 240)]);
    const elegido = await pickCandidate(db.asD1(), AHORA, [], { seccion: "tecnologia" });
    expect(elegido?.id).toBe("vieja");
  });
});

describe("las efemérides no se comen el cupo de noticias", () => {
  it("el cupo de actualidad se cuenta SOLO con noticias", async () => {
    const db = base([fila("tec-1", "tecnologia", 1)], { tecnologia: 3 });
    await pickCandidate(db.asD1(), AHORA, [], { seccion: "tecnologia" });
    const conteo = db.calls.find((c) => c.sql.includes("COUNT(*) AS n FROM articles"));
    expect(conteo?.sql).toContain("kind = 'news'");
  });

  it("el conteo general (el de las piezas propias) sigue contándolo todo", async () => {
    const db = base([]);
    await robotNotesToday(db.asD1(), AHORA);
    const conteo = db.calls.find((c) => c.sql.includes("COUNT(*) AS n FROM articles"));
    expect(conteo?.sql).not.toContain("kind = 'news'");
  });

  it("con las tres noticias del día ya publicadas, esa sección deja de pedir más", async () => {
    const db = base([fila("tec-1", "tecnologia", 1)], { tecnologia: 3 });
    const elegido = await pickCandidate(db.asD1(), AHORA, [], { seccion: "tecnologia" });
    expect(elegido).toBeNull();
  });
});

describe("la escaleta del día cubre a los dos canales", () => {
  it("tres turnos de tecnología y tres de artistas, repartidos por el día", () => {
    const horas = (id: string) => FRANJAS.filter((f) => f.seccion === id).map((f) => f.hour);
    expect(horas("tecnologia")).toHaveLength(3);
    expect(horas("artistas")).toHaveLength(3);
    // Repartidos: mañana, tarde y noche. Si salieran seguidos, el canal tendría todo el material a
    // la misma hora y la portada se vería desequilibrada el resto del día.
    for (const id of ["tecnologia", "artistas"]) {
      const h = horas(id);
      expect(Math.max(...h) - Math.min(...h)).toBeGreaterThanOrEqual(8);
    }
  });
});
