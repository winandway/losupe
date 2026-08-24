import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPONSOR_GAP_HOURS,
  DEFAULT_SPONSOR_MAX_PER_WEEK,
  getSponsorPace,
  nextQueuedAssignment,
} from "@/lib/robot/queue";
import { FakeD1 } from "./fake-d1";

const AHORA = new Date("2026-08-24T12:00:00Z");

const sponsorRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "YaDominios",
  website: "https://yadominios.com/",
  contact_name: null,
  contact_email: null,
  brief: null,
  section_id: "tecnologia",
  notes_total: 4,
  period_start: null,
  period_end: null,
  status: "active",
  internal_notes: null,
  created_at: "2026-08-23T00:00:00Z",
  updated_at: "2026-08-23T00:00:00Z",
  queued: 2,
  published: 2,
  in_review: 0,
};

describe("ritmo de los patrocinadores (no dos notas seguidas)", () => {
  it("los valores por defecto son una cada 3 días y 2 por semana", async () => {
    expect(DEFAULT_SPONSOR_GAP_HOURS).toBe(72);
    expect(DEFAULT_SPONSOR_MAX_PER_WEEK).toBe(2);
    const vacia = new FakeD1(() => []);
    expect(await getSponsorPace(vacia.asD1())).toEqual({ gapHours: 72, maxPerWeek: 2 });
    const configurada = new FakeD1((sql, params) =>
      params[0] === "sponsor_min_gap_hours" ? [{ value: "48" }] : [{ value: "3" }],
    );
    expect(await getSponsorPace(configurada.asD1())).toEqual({ gapHours: 48, maxPerWeek: 3 });
    // Un ajuste vacío o con basura NO puede desactivar el freno (sería spam sin querer).
    const vacio = new FakeD1(() => [{ value: "" }]);
    expect(await getSponsorPace(vacio.asD1())).toEqual({ gapHours: 72, maxPerWeek: 2 });
    const basura = new FakeD1(() => [{ value: "  " }]);
    expect(await getSponsorPace(basura.asD1())).toEqual({ gapHours: 72, maxPerWeek: 2 });
    const negativo = new FakeD1(() => [{ value: "-5" }]);
    expect(await getSponsorPace(negativo.asD1())).toEqual({ gapHours: 72, maxPerWeek: 2 });
    // Cero SÍ vale: es la forma de decir «sin separación» a propósito.
    const cero = new FakeD1((sql, params) =>
      params[0] === "sponsor_min_gap_hours" ? [{ value: "0" }] : [{ value: "2" }],
    );
    expect((await getSponsorPace(cero.asD1())).gapHours).toBe(0);
  });

  it("si el patrocinador publicó hace 4 horas, no le toca (la consulta no devuelve nada)", async () => {
    const db = new FakeD1((s) => {
      // Simula lo que haría SQLite: con una nota de hace 4 h, el NOT EXISTS descarta la fila
      if (s.includes("FROM assignments a") && s.includes("JOIN sponsors s")) return [];
      if (s.includes("FROM sponsors s")) return [sponsorRow];
      return [];
    });
    expect(await nextQueuedAssignment(db.asD1(), AHORA)).toBeNull();
  });

  // El comportamiento de la consulta (separación, tope semanal, cuándo puede salir la siguiente y
  // los formatos de fecha) se prueba contra SQLite DE VERDAD en tests/unit/fechas-sqlite.test.ts.
  // Aquí solo vive la lectura de los ajustes, que es la parte que no toca la base.
});
