import { describe, expect, it, vi } from "vitest";
import {
  contarPalabras,
  duracionLegible,
  filtrarSabiasQue,
  generarGuion,
  limpiarGuion,
  limpiarTituloVideo,
  MEDIDAS,
  problemasDelGuion,
  recortarGuion,
  rescatarGuiones,
  SISTEMA_GUION,
  TITULO_VIDEO_MAX,
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

  it("siempre termina diciendo dónde está la nota, aunque el modelo se lo salte", () => {
    expect(
      limpiarGuion("Texto del guion.", "es").endsWith("La nota completa está en losupe.com"),
    ).toBe(true);
    expect(limpiarGuion("Script text.", "en").endsWith("The full story is on losupe.com")).toBe(
      true,
    );
    // Y no lo repite si ya estaba.
    const dos = limpiarGuion("Texto.\nLa nota completa está en losupe.com", "es");
    expect(dos.match(/losupe\.com/g)).toHaveLength(1);
    // Y si el modelo mete el cierre en medio, se mueve al final SIN aplanar los párrafos.
    const enMedio = limpiarGuion(
      "Primer párrafo.\n\nLa nota completa está en losupe.com\n\nSegundo párrafo.",
      "es",
    );
    expect(enMedio.split("\n\n")).toHaveLength(3);
    expect(enMedio.endsWith("La nota completa está en losupe.com")).toBe(true);
    expect(enMedio.match(/losupe\.com/g)).toHaveLength(1);
    // El cierre viejo se cambia por el nuevo: el modelo lo repite de memoria.
    const viejo = limpiarGuion("Texto.\n\nLo leí en losupe.com", "es");
    expect(viejo).not.toContain("Lo leí");
    expect(viejo.endsWith("La nota completa está en losupe.com")).toBe(true);
  });

  it("la duración se calcula a ritmo de lectura en voz alta", () => {
    expect(duracionLegible(palabras(150), "es")).toBe("1 min");
    expect(duracionLegible(palabras(250), "es")).toBe("1 min 40 s");
    expect(duracionLegible(palabras(250), "en")).toBe("1 min 40 sec");
    expect(duracionLegible(palabras(60), "es")).toBe("24 s");
  });

  it("las dos medidas son las de un Short y las de un video corto", () => {
    // El MÁXIMO es el que manda: un guion de 1 minuto que pasa de 140 palabras no es de 1 minuto.
    expect(MEDIDAS["1m"].max).toBeLessThanOrEqual(140);
    expect(MEDIDAS["2m"].max).toBeLessThanOrEqual(280);
    // El mínimo es tolerante a propósito (ver el comentario de MEDIDAS), pero sin bajar de los 40
    // segundos de lectura.
    expect(MEDIDAS["1m"].min).toBeGreaterThanOrEqual(100);
    expect(MEDIDAS["2m"].min).toBeGreaterThanOrEqual(180);
  });
});

/**
 * LOS CUATRO DEFECTOS DE LA PRIMERA VERSIÓN (Richard, 1 oct 2026), con la nota de República
 * Dominicana delante: guion de 2 min 45 para un Short, párrafos pegados sin espacio después del
 * punto, «según Wikipedia» tres veces, y cifras imposibles de leer en voz alta.
 */
describe("el guion de un minuto es DE UN MINUTO", () => {
  const cierre = "La nota completa está en losupe.com";
  const guion = (n: number) => `${palabras(n)}\n\n${cierre}`;

  it("un guion de 1 minuto que pasa de 140 palabras NO se publica", () => {
    expect(problemasDelGuion(guion(200), "1m")).toContainEqual(
      expect.stringContaining("se pasa de largo"),
    );
    expect(problemasDelGuion(guion(130), "1m")).toEqual([]);
  });

  it("y si se pasa, se recorta por frases enteras sin tocar el gancho ni el cierre", () => {
    const largo = `Gancho corto y fuerte.\n\n${palabras(200)}\n\n${cierre}`;
    const corto = recortarGuion(largo, MEDIDAS["1m"].max, "es");
    expect(contarPalabras(corto)).toBeLessThanOrEqual(MEDIDAS["1m"].max);
    expect(corto.startsWith("Gancho corto y fuerte.")).toBe(true);
    expect(corto.endsWith(cierre)).toBe(true);
  });

  it("NUNCA se nombra a Wikipedia en voz alta: se nombra la fuente original", () => {
    expect(
      problemasDelGuion(`El dato, según Wikipedia, es ese.\n\n${cierre}`, "1m"),
    ).toContainEqual("nombra a Wikipedia en voz alta");
    // Y la mención se quita sola cuando se puede, sin romper la frase.
    const limpio = limpiarGuion("La velocidad llega a 45 megabits, según Wikipedia.", "es");
    expect(limpio).not.toMatch(/wikipedia/i);
    expect(limpio).toContain("45 megabits");
  });

  it("sin el cierre de losupe, el guion no vale", () => {
    expect(problemasDelGuion(palabras(130), "1m")).toContainEqual(
      "no termina con el cierre de losupe",
    );
  });

  it("un punto pegado a la palabra siguiente se arregla y, si queda, se canta", () => {
    expect(problemasDelGuion(`Uno.Dos tres.\n\n${cierre}`, "1m")).toContainEqual(
      "hay un punto pegado a la palabra",
    );
    // «por segundo.Este avance» era literal en la nota de República Dominicana.
    expect(limpiarGuion("por segundo.Este avance es grande.", "es")).toContain(
      "por segundo. Este avance",
    );
  });

  it("el título del video cabe en una miniatura", () => {
    expect(limpiarTituloVideo("a".repeat(90)).length).toBeLessThanOrEqual(TITULO_VIDEO_MAX);
    expect(limpiarTituloVideo('  "Internet más rápido"  ')).toBe("Internet más rápido");
  });

  it("las instrucciones piden las dos versiones, el gancho y el cierre exacto", () => {
    expect(SISTEMA_GUION).toContain("1 MINUTO");
    expect(SISTEMA_GUION).toContain("2 MINUTOS");
    expect(SISTEMA_GUION).toContain("GANCHO");
    expect(SISTEMA_GUION).toContain("La nota completa está en losupe.com");
    expect(SISTEMA_GUION).toMatch(/PROHIBIDO nombrar a Wikipedia/);
    expect(SISTEMA_GUION).toMatch(/REDONDEADAS/);
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
        titulo_video_es: "El diésel toca récord",
        titulo_video_en: "Diesel hits a record",
        guion_1m_es: palabras(130),
        guion_1m_en: palabras(130),
        guion_2m_es: palabras(250),
        guion_2m_en: palabras(250),
        sabias_que_es: [
          "¿Sabías que el diésel llegó a 5,85 dólares por galón?",
          "¿Sabías que en 1901 pasó algo inventado?",
        ],
        sabias_que_en: [],
      }) as unknown as typeof fetch,
    });
    expect(r).not.toBeNull();
    expect(r!.guion.guion_1m_es.endsWith("La nota completa está en losupe.com")).toBe(true);
    expect(r!.guion.guion_2m_es!.endsWith("La nota completa está en losupe.com")).toBe(true);
    expect(r!.guion.titulo_video_es).toBe("El diésel toca récord");
    expect(r!.guion.sabias_que_es).toHaveLength(1);
    expect(r!.costUsd).toBeLessThan(0.01);
  });

  it("UN GUION DEMASIADO CORTO NO SE PUBLICA: mejor ninguno que uno malo", async () => {
    const r = await generarGuion({
      apiKey: "k",
      titulo: "x",
      cuerpoHtml: CUERPO,
      fetchImpl: responder({
        titulo_video_es: "x",
        titulo_video_en: "x",
        guion_1m_es: "Muy corto.",
        guion_1m_en: palabras(130),
        guion_2m_es: palabras(250),
        guion_2m_en: palabras(250),
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
      if (sql.includes("es.guion_1m IS NULL")) return [fila];
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
                    titulo_video_es: "Un título",
                    titulo_video_en: "A title",
                    guion_1m_es: palabras(130),
                    guion_1m_en: palabras(130),
                    guion_2m_es: palabras(250),
                    guion_2m_en: palabras(250),
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
    // Las dos medidas y el título del video se guardan juntos.
    expect(guardados[0]!.sql).toContain("guion_2m");
    expect(guardados[0]!.sql).toContain("titulo_video");
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
      i18n: Record<
        "es" | "en",
        { guion_1m: string; guion_2m: string; titulo_video: string; sabias_que: string[] }
      >;
    };
    for (const lang of ["es", "en"] as const) {
      // Las dos medidas, cada una dentro de su rango y las dos cerrando con losupe.
      for (const medida of ["1m", "2m"] as const) {
        const g = medida === "1m" ? semilla.i18n[lang].guion_1m : semilla.i18n[lang].guion_2m;
        expect(problemasDelGuion(g, medida, lang), `${lang} ${medida}`).toEqual([]);
      }
      expect(semilla.i18n[lang].titulo_video.length).toBeLessThanOrEqual(TITULO_VIDEO_MAX);
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

describe("cada medida se comprueba sola (1 oct 2026)", () => {
  it("si la de 2 minutos no cumple, se guarda igual la de 1 minuto", async () => {
    const responder = (data: object) =>
      vi.fn(async () =>
        Response.json({
          candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }],
          usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 800 },
        }),
      );
    const r = await generarGuion({
      apiKey: "k",
      titulo: "El diésel toca récord",
      cuerpoHtml: CUERPO,
      fetchImpl: responder({
        titulo_video_es: "Diésel en máximos",
        titulo_video_en: "Diesel at a record",
        guion_1m_es: palabras(130),
        guion_1m_en: palabras(130),
        // Esta se pasa de corta: antes tiraba las cuatro versiones y la nota se quedaba sin guion.
        guion_2m_es: "Dos frases y ya.",
        guion_2m_en: "Just two sentences.",
        sabias_que_es: [],
        sabias_que_en: [],
      }) as unknown as typeof fetch,
    });
    expect(r).not.toBeNull();
    expect(contarPalabras(r!.guion.guion_1m_es)).toBeGreaterThan(100);
    expect(r!.guion.guion_2m_es).toBeNull();
  });
});
