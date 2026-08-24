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

describe("una firma por franja: nadie escribe dos notas el mismo día", () => {
  it("quien ya firmó hoy pasa al final, aunque sea el especialista", () => {
    // Andreea es la especialista de economía, pero ya publicó en la franja de la mañana.
    const conLaManana: WriterRow[] = [
      { ...equipo[0]!, today: 1 },
      { ...equipo[1]!, today: 0 },
      { ...equipo[2]!, today: 0 },
    ];
    const orden = rankWriters(conLaManana, "economia");
    expect(orden[0]?.id).not.toBe("andreea-blidar");
    // Y Andreea queda de última: es la única que ya publicó hoy.
    expect(orden[orden.length - 1]?.id).toBe("andreea-blidar");
  });

  it("las tres notas del día las firman tres personas distintas", () => {
    const estado = equipo.map((w) => ({ ...w, today: 0 }));
    const firmas: string[] = [];
    for (const seccion of ["economia", "economia", "economia"] as const) {
      const elegido = rankWriters(estado, seccion)[0]!;
      firmas.push(elegido.id);
      const fila = estado.find((w) => w.id === elegido.id)!;
      fila.today = (fila.today ?? 0) + 1;
      fila.last_published = new Date().toISOString();
    }
    expect(new Set(firmas).size).toBe(3);
  });

  it("si TODOS publicaron hoy, vuelve a entrar el que menos lleva", () => {
    const todos: WriterRow[] = [
      { ...equipo[0]!, today: 2 },
      { ...equipo[1]!, today: 1 },
      { ...equipo[2]!, today: 2 },
    ];
    expect(rankWriters(todos, "economia")[0]?.id).toBe("merry-melina");
  });
});
