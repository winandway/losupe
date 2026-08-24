import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPONSOR_GAP_HOURS,
  DEFAULT_SPONSOR_MAX_PER_WEEK,
  getSponsorPace,
  nextQueuedAssignment,
  sponsorNextSlot,
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
const assignmentRow = {
  id: "22222222-2222-4222-8222-222222222222",
  sponsor_id: sponsorRow.id,
  position: 3,
  title_idea: "La tercera del patrocinador",
  brief: null,
  section_id: "tecnologia",
  source_urls_json: "[]",
  scheduled_for: null,
  status: "queued",
  article_id: null,
  run_id: null,
  error: null,
  created_at: "2026-08-23T00:00:00Z",
  updated_at: "2026-08-23T00:00:00Z",
  published_at: null,
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

  it("la consulta exige la separación mínima y el tope semanal", async () => {
    let sql = "";
    let params: unknown[] = [];
    const db = new FakeD1((s, p) => {
      if (s.includes("FROM assignments a") && s.includes("JOIN sponsors s")) {
        sql = s;
        params = p;
        return [assignmentRow];
      }
      if (s.includes("FROM sponsors s")) return [sponsorRow];
      return [];
    });
    const r = await nextQueuedAssignment(db.asD1(), AHORA);
    expect(r?.titleIdea).toBe("La tercera del patrocinador");
    // El SQL tiene que filtrar por publicación reciente y por tope semanal
    expect(sql).toContain("NOT EXISTS");
    expect(sql).toContain("r.published_at > ?2");
    expect(sql).toContain("w.published_at > ?3");
    // ?2 = hace 72 h, ?3 = hace 7 días, ?4 = tope
    expect(params[1]).toBe(new Date(AHORA.getTime() - 72 * 3_600_000).toISOString());
    expect(params[2]).toBe(new Date(AHORA.getTime() - 7 * 86_400_000).toISOString());
    expect(params[3]).toBe(2);
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

  it("sponsorNextSlot dice cuándo puede salir la siguiente", async () => {
    // Publicó hace 4 horas: tiene que esperar hasta 68 h después
    const haceCuatro = new Date(AHORA.getTime() - 4 * 3_600_000).toISOString();
    const reciente = new FakeD1((s) =>
      s.includes("MAX(published_at)") ? [{ ultima: haceCuatro, semana: 1 }] : [],
    );
    const r1 = await sponsorNextSlot(reciente.asD1(), sponsorRow.id, AHORA);
    expect(r1.availableAt).toBe(new Date(Date.parse(haceCuatro) + 72 * 3_600_000).toISOString());
    expect(r1.publishedThisWeek).toBe(1);

    // Publicó hace 5 días: ya puede
    const haceCinco = new Date(AHORA.getTime() - 5 * 86_400_000).toISOString();
    const vieja = new FakeD1((s) =>
      s.includes("MAX(published_at)") ? [{ ultima: haceCinco, semana: 1 }] : [],
    );
    expect((await sponsorNextSlot(vieja.asD1(), sponsorRow.id, AHORA)).availableAt).toBeNull();

    // Ya lleva 2 esta semana: tope alcanzado
    const tope = new FakeD1((s) =>
      s.includes("MAX(published_at)") ? [{ ultima: haceCinco, semana: 2 }] : [],
    );
    const r3 = await sponsorNextSlot(tope.asD1(), sponsorRow.id, AHORA);
    expect(r3.availableAt).toBe("semana");
    expect(r3.maxPerWeek).toBe(2);

    // Nunca ha publicado: puede de una
    const nueva = new FakeD1((s) =>
      s.includes("MAX(published_at)") ? [{ ultima: null, semana: 0 }] : [],
    );
    expect((await sponsorNextSlot(nueva.asD1(), sponsorRow.id, AHORA)).availableAt).toBeNull();
  });
});
