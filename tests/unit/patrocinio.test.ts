import { describe, expect, it } from "vitest";
import { patrocinadorDeSeccion, patrociniosVigentes } from "@/lib/patrocinio";

const FILA = {
  id: "sp-1",
  name: "YaDominios Cloud",
  website: "https://yadominios.com/",
  logo_url: "https://yadominios.com/logo.png",
  claim_es: "Publica tu web en minutos",
  claim_en: "Publish your site in minutes",
  section_until: "2026-12-31T00:00:00Z",
};

function base(fila: unknown, capturar?: (sql: string, p: unknown[]) => void) {
  return {
    prepare: (sql: string) => ({
      bind: (...p: unknown[]) => ({
        first: async () => {
          capturar?.(sql, p);
          return fila;
        },
        all: async () => {
          capturar?.(sql, p);
          return { results: fila ? [fila] : [] };
        },
      }),
    }),
  } as unknown as D1Database;
}

describe("patrocinio de sección", () => {
  it("devuelve la marca vigente, con su frase en el idioma que toca", async () => {
    const es = await patrocinadorDeSeccion(base(FILA), "tecnologia", "es");
    expect(es?.nombre).toBe("YaDominios Cloud");
    expect(es?.claim).toBe("Publica tu web en minutos");
    const en = await patrocinadorDeSeccion(base(FILA), "tecnologia", "en");
    expect(en?.claim).toBe("Publish your site in minutes");
  });

  it("la consulta exige que esté ACTIVO y que no se haya pasado la fecha", async () => {
    let sql = "";
    let params: unknown[] = [];
    await patrocinadorDeSeccion(
      base(FILA, (s, p) => {
        sql = s;
        params = p;
      }),
      "cripto",
      "es",
      new Date("2026-08-29T12:00:00Z"),
    );
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain("section_until IS NULL OR section_until >");
    expect(params[0]).toBe("cripto");
    expect(params[1]).toBe("2026-08-29T12:00:00.000Z");
  });

  it("sin patrocinador no pasa nada: la sección se ve igual", async () => {
    expect(await patrocinadorDeSeccion(base(null), "economia", "es")).toBeNull();
    expect(await patrociniosVigentes(base(null))).toEqual([]);
  });

  it("si la base falla, la sección sigue funcionando: un anuncio no tumba una página", async () => {
    const rota = {
      prepare: () => {
        throw new Error("sin base");
      },
    } as unknown as D1Database;
    expect(await patrocinadorDeSeccion(rota, "ventas", "es")).toBeNull();
    expect(await patrociniosVigentes(rota)).toEqual([]);
  });
});
