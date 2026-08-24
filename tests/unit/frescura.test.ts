import { describe, expect, it } from "vitest";
import { DIAS_ACTUALIDAD, esReciente, separarPorFrescura } from "@/lib/frescura";

const AHORA = Date.parse("2026-08-24T18:00:00Z");
const nota = (publishedAt: string | null) => ({ publishedAt });

describe("lo reciente arriba, el archivo abajo", () => {
  it("una nota de hoy es actualidad; una de hace ocho meses es archivo", () => {
    expect(esReciente("2026-08-24T05:08:00Z", AHORA)).toBe(true);
    expect(esReciente("2026-08-01T00:00:00Z", AHORA)).toBe(true);
    // El caso real: la portada mezclaba notas de agosto de 2026 con archivo de diciembre de 2025.
    expect(esReciente("2025-12-10T00:38:00Z", AHORA)).toBe(false);
  });

  it("separa conservando el orden de cada grupo", () => {
    const { recientes, archivo } = separarPorFrescura(
      [
        nota("2026-08-24T05:00:00Z"),
        nota("2025-12-10T00:00:00Z"),
        nota("2026-08-23T20:00:00Z"),
        nota("2025-12-09T22:00:00Z"),
      ],
      AHORA,
    );
    expect(recientes.map((n) => n.publishedAt)).toEqual([
      "2026-08-24T05:00:00Z",
      "2026-08-23T20:00:00Z",
    ]);
    expect(archivo.map((n) => n.publishedAt)).toEqual([
      "2025-12-10T00:00:00Z",
      "2025-12-09T22:00:00Z",
    ]);
  });

  it("SI NO HAY NADA RECIENTE, no se separa: una portada vacía arriba es peor", () => {
    const viejas = [nota("2025-12-10T00:00:00Z"), nota("2025-12-09T22:00:00Z")];
    const r = separarPorFrescura(viejas, AHORA);
    expect(r.recientes).toHaveLength(2);
    expect(r.archivo).toHaveLength(0);
  });

  it("una nota sin fecha no se castiga", () => {
    expect(esReciente(null, AHORA)).toBe(true);
    expect(esReciente("no es una fecha", AHORA)).toBe(true);
  });

  it("el corte son 30 días", () => {
    expect(DIAS_ACTUALIDAD).toBe(30);
    const justo = new Date(AHORA - 29 * 86_400_000).toISOString();
    const pasado = new Date(AHORA - 31 * 86_400_000).toISOString();
    expect(esReciente(justo, AHORA)).toBe(true);
    expect(esReciente(pasado, AHORA)).toBe(false);
  });
});
