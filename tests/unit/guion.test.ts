import { describe, expect, it, vi } from "vitest";
import {
  contarPalabras,
  duracionLegible,
  filtrarSabiasQue,
  generarGuion,
  limpiarGuion,
  PALABRAS_MAX,
  PALABRAS_MIN,
  rescatarGuiones,
  SISTEMA_GUION,
} from "@/lib/robot/guion";
import { FakeD1 } from "./fake-d1";

/**
 * EL GUION PARA CREADORES (17 sep 2026).
 *
 * Un creador va a leer esto delante de miles de personas. Por eso las pruebas más importantes no
 * son las del formato: son las que impiden que se cuele un dato inventado con nuestro nombre al final.
 */
const CUERPO = `<p>El precio del diésel en Estados Unidos llegó a 5,85 dólares por galón, según la EIA.</p>
<p>Es el nivel más alto desde 2022. ${"Los transportistas lo notan en cada viaje y lo trasladan a las tiendas. ".repeat(12)}</p>`;

function palabras(n: number) {
  return Array.from({ length: n }, (_, i) => `palabra${i}`).join(" ");
}

describe("NO SE INVENTA NADA", () => {
  it("un «¿Sabías qué?» con una cifra que NO está en la nota se tira", () => {
    const datos = [
      "¿Sabías que el diésel llegó a 5,85 dólares por galón, el nivel más alto desde 2022?",
      // Inventado: 1978 y 12 no aparecen en la nota.
      "¿Sabías que el primer motor diésel de camión se vendió en 1978 en 12 estados?",
    ];
    const ok = filtrarSabiasQue(datos, CUERPO);
    expect(ok).toHaveLength(1);
    expect(ok[0]).toContain("5,85");
  });

  it("un dato sin cifras, sacado del sentido de la nota, sí pasa", () => {
    expect(
      filtrarSabiasQue(
        ["¿Sabías que los transportistas trasladan el costo a las tiendas?"],
        CUERPO,
      ),
    ).toHaveLength(1);
  });

  it("como mucho dos, y ni muy cortos ni kilométricos", () => {
    const largos = [
      "¿Sabías que x?",
      "a".repeat(400),
      "¿Sabías que el diésel subió mucho este año?",
      "¿Sabías que los transportistas lo notan en cada viaje?",
      "¿Sabías que las tiendas pagan la diferencia al final?",
    ];
    const r = filtrarSabiasQue(largos, CUERPO);
    expect(r.length).toBeLessThanOrEqual(2);
    expect(r.every((d) => d.length >= 20 && d.length <= 320)).toBe(true);
  });

  it("las instrucciones dicen, con todas las letras, que no se invente", () => {
    expect(SISTEMA_GUION).toContain("NO INVENTES NADA");
    expect(SISTEMA_GUION).toContain("QUE ESTÉN EN LA NOTA");
    // Y que si no hay dato curioso, se deje vacío en vez de forzarlo.
    expect(SISTEMA_GUION).toContain("listas VACÍAS");
    // Y que nombre la fuente original.
    expect(SISTEMA_GUION).toMatch(/fuente original/i);
  });
});

describe("listo para un teleprompter", () => {
  it("quita enlaces, asteriscos y emojis, y deja los párrafos separados", () => {
    const g = limpiarGuion("**Hola** 🚀 mira https://x.com/a\nsegunda línea", "es");
    expect(g).not.toContain("**");
    expect(g).not.toContain("https://");
    expect(g).not.toContain("🚀");
    expect(g).toContain("\n\n");
  });

  it("siempre termina diciendo dónde se leyó, aunque el modelo se lo salte", () => {
    expect(limpiarGuion("Texto del guion.", "es").endsWith("Lo leí en losupe.com")).toBe(true);
    expect(limpiarGuion("Script text.", "en").endsWith("I read it on losupe.com")).toBe(true);
    // Y no lo repite si ya estaba.
    const dos = limpiarGuion("Texto.\nLo leí en losupe.com", "es");
    expect(dos.match(/losupe\.com/g)).toHaveLength(1);
  });

  it("la duración se calcula a ritmo de lectura en voz alta", () => {
    expect(duracionLegible(palabras(150), "es")).toBe("1 min");
    expect(duracionLegible(palabras(250), "es")).toBe("1 min 40 s");
    expect(duracionLegible(palabras(250), "en")).toBe("1 min 40 sec");
    expect(duracionLegible(palabras(60), "es")).toBe("24 s");
  });

  it("el rango da de un minuto a unos tres", () => {
    expect(PALABRAS_MIN).toBeGreaterThanOrEqual(100);
    expect(PALABRAS_MAX).toBeLessThanOrEqual(500);
  });
});

describe("generarGuion", () => {
  const responder = (data: object) =>
    vi.fn(async () =>
      Response.json({
        candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }],
        usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 800 },
      }),
    );

  it("devuelve el guion limpio y los datos filtrados", async () => {
    const r = await generarGuion({
      apiKey: "k",
      titulo: "El diésel toca récord",
      cuerpoHtml: CUERPO,
      fetchImpl: responder({
        guion_es: palabras(200),
        guion_en: palabras(200),
        sabias_que_es: [
          "¿Sabías que el diésel llegó a 5,85 dólares por galón?",
          "¿Sabías que en 1901 pasó algo inventado?",
        ],
        sabias_que_en: [],
      }) as unknown as typeof fetch,
    });
    expect(r).not.toBeNull();
    expect(r!.guion.guion_es.endsWith("Lo leí en losupe.com")).toBe(true);
    expect(r!.guion.sabias_que_es).toHaveLength(1);
    expect(r!.costUsd).toBeLessThan(0.01);
  });

  it("UN GUION DEMASIADO CORTO NO SE PUBLICA: mejor ninguno que uno malo", async () => {
    const r = await generarGuion({
      apiKey: "k",
      titulo: "x",
      cuerpoHtml: CUERPO,
      fetchImpl: responder({
        guion_es: "Muy corto.",
        guion_en: palabras(200),
        sabias_que_es: [],
        sabias_que_en: [],
      }) as unknown as typeof fetch,
    });
    expect(r).toBeNull();
  });

  it("sin llave, o con una nota sin cuerpo, no llama a nadie", async () => {
    const f = vi.fn();
    expect(
      await generarGuion({
        titulo: "x",
        cuerpoHtml: CUERPO,
        fetchImpl: f as unknown as typeof fetch,
      }),
    ).toBeNull();
    expect(
      await generarGuion({
        apiKey: "k",
        titulo: "x",
        cuerpoHtml: "<p>corto</p>",
        fetchImpl: f as unknown as typeof fetch,
      }),
    ).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("si el modelo falla, no revienta", async () => {
    const caido = vi.fn(async () => new Response("no", { status: 500 }));
    expect(
      await generarGuion({
        apiKey: "k",
        titulo: "x",
        cuerpoHtml: CUERPO,
        fetchImpl: caido as unknown as typeof fetch,
      }),
    ).toBeNull();
  });
});

describe("rescatarGuiones", () => {
  const fila = {
    id: "art-1",
    sources_json: '[{"title":"EIA","url":"https://eia.gov"}]',
    title: "Diésel",
    excerpt: null,
    content_html: CUERPO,
    tiene_en: 1,
  };

  it("guarda el guion en los DOS idiomas y apunta el gasto", async () => {
    const db = new FakeD1((sql) => {
      if (sql.includes("es.guion IS NULL")) return [fila];
      if (sql.includes("value FROM settings")) return [{ value: "5" }];
      if (sql.includes("SUM(cost_usd)")) return [{ total: 0 }];
      return [];
    });
    const fetchImpl = (async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    guion_es: palabras(200),
                    guion_en: palabras(200),
                    sabias_que_es: [],
                    sabias_que_en: [],
                  }),
                },
              ],
            },
          },
        ],
        usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 800 },
      })) as unknown as typeof fetch;
    const r = await rescatarGuiones(db.asD1(), { GEMINI_API_KEY: "k" }, { fetchImpl });
    expect(r.hechas).toBe(1);
    const guardados = db.calls.filter((c) => c.sql.startsWith("UPDATE article_i18n SET guion"));
    expect(guardados.map((g) => g.params[1])).toEqual(["es", "en"]);
    expect(db.calls.some((c) => c.sql.startsWith("INSERT INTO spend_log"))).toBe(true);
    // Añadir el guion NO es actualizar la noticia: la fecha de modificación no se mueve (si se
    // moviera, Google vería la nota «actualizada» sin que cambiara una palabra).
    expect(db.calls.some((c) => /updated_at/.test(c.sql))).toBe(false);
  });

  it("sin llave de Gemini no toca la base", async () => {
    const db = new FakeD1(() => []);
    expect(await rescatarGuiones(db.asD1(), {})).toEqual({
      encontradas: 0,
      hechas: 0,
      errores: [],
    });
    expect(db.calls).toHaveLength(0);
  });

  it("una base rota no tumba la corrida", async () => {
    const rota = {
      prepare: () => {
        throw new Error("no such column: guion");
      },
    } as unknown as D1Database;
    const r = await rescatarGuiones(rota, { GEMINI_API_KEY: "k" });
    expect(r.hechas).toBe(0);
    expect(r.errores[0]).toContain("guion");
  });
});

describe("la guía del casillero trae su guion de ejemplo", () => {
  it("dentro del rango, en los dos idiomas y cerrando con losupe", async () => {
    const semilla = (await import("../../seed/content/2026-09-09-casillero-miami.mjs")).default as {
      i18n: Record<"es" | "en", { guion: string; sabias_que: string[] }>;
    };
    for (const lang of ["es", "en"] as const) {
      const g = semilla.i18n[lang].guion;
      expect(contarPalabras(g)).toBeGreaterThanOrEqual(PALABRAS_MIN);
      expect(contarPalabras(g)).toBeLessThanOrEqual(PALABRAS_MAX);
      expect(
        g.trim().endsWith(lang === "es" ? "Lo leí en losupe.com" : "I read it on losupe.com"),
      ).toBe(true);
    }
  });
});

describe("LAS LETRAS NO ESQUIVAN LA COMPROBACIÓN (primer día en producción, 17 sep 2026)", () => {
  it("un dato con el año escrito en letras se descarta: así no se puede verificar", () => {
    // El caso real de Raúl Magaña. Ese año SÍ estaba en la nota, pero un año inventado en letras
    // habría pasado igual por el filtro de cifras.
    const nota = "Raúl Magaña hizo doblaje en 2017 para Ultraman Zero.";
    expect(
      filtrarSabiasQue(
        ["¿Sabías que Raúl Magaña incursionó en el doblaje en dos mil diecisiete?"],
        nota,
      ),
    ).toEqual([]);
    // Con número se puede comprobar, y pasa.
    expect(
      filtrarSabiasQue(["¿Sabías que Raúl Magaña incursionó en el doblaje en 2017?"], nota),
    ).toHaveLength(1);
  });

  it("también en inglés", () => {
    expect(
      filtrarSabiasQue(["Did you know he won his first award in nineteen ninety?"], "x"),
    ).toEqual([]);
  });

  it("«miles de personas» no es una cifra y no se descarta por eso", () => {
    expect(
      filtrarSabiasQue(["¿Sabías que miles de personas ven sus telenovelas cada tarde?"], "x"),
    ).toHaveLength(1);
  });

  it("las instrucciones piden números en el «¿Sabías qué?»", () => {
    expect(SISTEMA_GUION).toContain("CON NÚMEROS");
  });
});

describe("el filtro se aplica también AL MOSTRAR la nota", () => {
  it("un «¿Sabías qué?» guardado antes de la regla de letras no se muestra", async () => {
    const { mapFull } = await import("@/lib/queries");
    const { sampleFullRow } = await import("./fake-d1");
    const nota = mapFull(
      {
        ...sampleFullRow,
        content_html: "<p>Hizo doblaje en 2017.</p>",
        sabias_que_json: JSON.stringify([
          "¿Sabías que incursionó en el doblaje en dos mil diecisiete?",
          "¿Sabías que incursionó en el doblaje en 2017, ya siendo actor?",
        ]),
      },
      "es",
      {},
    );
    expect(nota.sabiasQue).toEqual([
      "¿Sabías que incursionó en el doblaje en 2017, ya siendo actor?",
    ]);
  });
});
