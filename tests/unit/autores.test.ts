import { describe, expect, it } from "vitest";
import { parseSections, pickWriter, rankWriters, type WriterRow } from "@/lib/robot/authors";
import { FakeD1 } from "./fake-d1";

const equipo: WriterRow[] = [
  {
    id: "andreea-blidar",
    name: "Andreea Blidar",
    sections_json: '["economia","tecnologia"]',
    last_published: "2026-08-23T10:00:00Z",
  },
  {
    id: "merry-melina",
    name: "Merry Melina",
    sections_json: '["artistas","ventas"]',
    last_published: "2026-08-22T10:00:00Z",
  },
  {
    id: "pedro-llerena",
    name: "Pedro Llerena",
    sections_json: '["cripto","ventas"]',
    last_published: null,
  },
];

describe("reparto de firmas entre el equipo", () => {
  it("prefiere al especialista de la sección", () => {
    expect(rankWriters(equipo, "economia")[0]?.id).toBe("andreea-blidar");
    expect(rankWriters(equipo, "artistas")[0]?.id).toBe("merry-melina");
    expect(rankWriters(equipo, "cripto")[0]?.id).toBe("pedro-llerena");
    expect(rankWriters(equipo, "economia")[0]?.specialist).toBe(true);
  });

  it("entre dos especialistas de la misma sección, escribe el que lleva más tiempo sin publicar", () => {
    const orden = rankWriters(equipo, "ventas");
    expect(orden[0]?.id).toBe("pedro-llerena"); // nunca ha publicado
    expect(orden[1]?.id).toBe("merry-melina"); // publicó antes que Andreea
    expect(orden[0]?.specialist).toBe(true);
  });

  it("si nadie tiene la especialidad, rota igual por antigüedad de la última nota", () => {
    const sinEspecialistas = equipo.map((w) => ({ ...w, sections_json: "[]" }));
    const orden = rankWriters(sinEspecialistas, "economia");
    expect(orden.map((w) => w.id)).toEqual(["pedro-llerena", "merry-melina", "andreea-blidar"]);
    expect(orden.every((w) => !w.specialist)).toBe(true);
  });

  it("la rotación avanza: tras publicar, el siguiente turno es de otra persona", () => {
    const tras = equipo.map((w) =>
      w.id === "pedro-llerena" ? { ...w, last_published: "2026-08-24T10:00:00Z" } : w,
    );
    expect(rankWriters(tras, "ventas")[0]?.id).toBe("merry-melina");
  });

  it("parseSections aguanta datos rotos sin tumbar nada", () => {
    expect(parseSections('["cripto"]')).toEqual(["cripto"]);
    expect(parseSections(null)).toEqual([]);
    expect(parseSections("{no es json")).toEqual([]);
    expect(parseSections('{"a":1}')).toEqual([]);
    expect(parseSections('["ok",5,null]')).toEqual(["ok"]);
  });

  it("pickWriter consulta solo al equipo activo con especialidad y devuelve null si no hay nadie", async () => {
    const db = new FakeD1((sql) => {
      expect(sql).toContain("active = 1");
      expect(sql).toContain("kind = 'person'");
      return equipo as unknown as Record<string, unknown>[];
    });
    expect((await pickWriter(db.asD1(), "cripto"))?.id).toBe("pedro-llerena");
    const vacia = new FakeD1(() => []);
    expect(await pickWriter(vacia.asD1(), "cripto")).toBeNull();
  });
});
