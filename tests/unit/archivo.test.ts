import { describe, expect, it } from "vitest";
import {
  conceptos,
  DIAS_DE_MEMORIA,
  hechosNuevos,
  parecido,
  revisarArchivo,
  UMBRAL_PARECIDO,
} from "@/lib/robot/archivo";

/**
 * EL CASO QUE LO MOTIVÓ TODO. Richard, 29 ago 2026: el diario publicó estas dos notas con cinco
 * días de diferencia. Son la misma nota contada dos veces.
 */
const ORMUZ = {
  titulo: "Sanciones económicas y el Estrecho de Ormuz: una guía para entender su impacto global",
  entradilla:
    "Las restricciones al comercio internacional y el paso de petróleo por el Estrecho de Ormuz explican buena parte de lo que pasa con los precios.",
  publicadaEn: "2026-08-24T04:49:59.199Z",
};

const RUTAS = {
  titulo: "Medidas económicas y rutas comerciales: una guía para entender su impacto global",
  resumen:
    "Las restricciones al comercio internacional y las rutas de petróleo explican buena parte de lo que pasa con los precios.",
};

const AHORA = new Date("2026-08-29T11:35:00Z");

describe("el caso real: dos notas para el mismo tema", () => {
  it("LAS PILLA. Era el fallo: nadie comparaba una nota nueva con lo ya publicado", () => {
    const v = revisarArchivo(RUTAS, [ORMUZ], AHORA);
    expect(v.repite).toBe(true);
    if (!v.repite) return;
    expect(v.seguimiento, "no trae ningún hecho nuevo: es repetir").toBe(false);
    expect(v.parecidoCon).toBe(ORMUZ.titulo);
    expect(v.motivo).toContain("sin nada nuevo");
  });

  it("la plantilla del titular no cuenta como parecido", () => {
    // «una guía para entender su impacto global» lo ponemos nosotros en el molde. Si contara, dos
    // guías de temas distintos parecerían gemelas y se bloquearían entre ellas.
    const a = "Bitcoin: una guía para entender su impacto global";
    const b = "El café en Colombia: una guía para entender su impacto global";
    expect(parecido(a, b)).toBeLessThan(UMBRAL_PARECIDO);
    expect(
      revisarArchivo({ titulo: a }, [{ titulo: b, publicadaEn: AHORA.toISOString() }], AHORA),
    ).toEqual({ repite: false });
  });
});

describe("LA EXCEPCIÓN: una noticia que sigue viva se cuenta varios días", () => {
  const TERREMOTO = {
    titulo: "Terremoto en Filipinas: 120 muertos y miles de casas destruidas",
    entradilla:
      "El sismo de magnitud 7,1 dejó al menos 120 fallecidos. El gobierno declaró el estado de emergencia.",
    publicadaEn: "2026-08-27T10:00:00.000Z",
  };

  it("un capítulo nuevo con cifras nuevas SÍ se escribe: eso es seguir una noticia", () => {
    const v = revisarArchivo(
      {
        titulo: "Terremoto en Filipinas: ya son 340 los muertos y 18 países mandaron ayuda",
        resumen:
          "El balance subió a 340 fallecidos. Japón, Corea y Australia enviaron equipos de rescate.",
      },
      [TERREMOTO],
      AHORA,
    );
    expect(v.repite).toBe(true);
    if (!v.repite) return;
    // Es el mismo tema, pero trae hechos que no estaban: se escribe, y se avisa de que es un capítulo.
    expect(v.seguimiento).toBe(true);
    expect(v.novedades.length).toBeGreaterThanOrEqual(2);
    expect(v.motivo).toContain("capítulo");
  });

  it("pero volver a contar lo mismo del terremoto, sin nada nuevo, NO", () => {
    const v = revisarArchivo(
      {
        titulo: "Terremoto en Filipinas: el impacto del sismo en el país",
        resumen:
          "El sismo dejó al menos 120 fallecidos y el gobierno declaró el estado de emergencia.",
      },
      [TERREMOTO],
      AHORA,
    );
    expect(v.repite).toBe(true);
    if (!v.repite) return;
    expect(v.seguimiento).toBe(false);
  });
});

describe("la misma fuente es el mismo hecho", () => {
  it("si citamos la misma URL que una nota reciente, es repetir aunque el titular cambie", () => {
    const v = revisarArchivo(
      {
        titulo: "Un giro inesperado en la política de tasas",
        resumen: "Algo pasó con los tipos de interés.",
        fuentes: ["https://www.elpais.com/economia/2026-08-28/la-fed-baja-tasas.html"],
      },
      [
        {
          titulo: "La Fed baja las tasas por primera vez en el año",
          publicadaEn: "2026-08-28T12:00:00.000Z",
          fuentes: ["https://elpais.com/economia/2026-08-28/la-fed-baja-tasas.html/"],
        },
      ],
      AHORA,
    );
    // Ni el «www.» ni la barra final despistan: es el mismo artículo de origen.
    expect(v.repite).toBe(true);
    if (!v.repite) return;
    expect(v.motivo).toContain("misma fuente");
    expect(v.seguimiento, "misma fuente nunca es seguimiento: es el mismo hecho").toBe(false);
  });
});

describe("la memoria tiene fecha de caducidad", () => {
  it("pasados los días de memoria, volver sobre un tema es legítimo", () => {
    const viejo = new Date(AHORA.getTime() - (DIAS_DE_MEMORIA + 1) * 86_400_000).toISOString();
    expect(revisarArchivo(RUTAS, [{ ...ORMUZ, publicadaEn: viejo }], AHORA)).toEqual({
      repite: false,
    });
  });

  it("una fecha rota no bloquea el diario", () => {
    expect(revisarArchivo(RUTAS, [{ ...ORMUZ, publicadaEn: "no es una fecha" }], AHORA)).toEqual({
      repite: false,
    });
    expect(revisarArchivo(RUTAS, [], AHORA)).toEqual({ repite: false });
  });
});

describe("las piezas por dentro", () => {
  it("los sinónimos llevan el mismo concepto a un solo nombre", () => {
    // «btc» y «bitcoin» son lo mismo; si no se unifican, el mismo tema se cuela con otro nombre.
    expect(parecido("El precio de BTC hoy", "El precio de bitcoin hoy")).toBe(1);
    expect(parecido("La economía de EEUU", "La economía de Estados Unidos")).toBeGreaterThan(0.5);
  });

  it("las palabras vacías no cuentan", () => {
    const c = conceptos("El impacto de las cosas que hay en la nueva economía de Estados Unidos");
    expect(c.has("el")).toBe(false);
    expect(c.has("que")).toBe(false);
    expect([...c].some((x) => x.includes("econom"))).toBe(true);
  });

  it("los hechos nuevos son cifras y nombres que no estaban", () => {
    const n = hechosNuevos(
      "Ya son 340 los muertos y llegaron equipos de Japón y Corea",
      "El sismo dejó 120 muertos en Filipinas",
    );
    expect(n).toContain("340");
    expect(n.some((x) => x.includes("japon"))).toBe(true);
    // Y lo que ya estaba no cuenta como nuevo.
    expect(hechosNuevos("Van 120 muertos", "El sismo dejó 120 muertos")).not.toContain("120");
  });

  it("dos temas distintos no se estorban", () => {
    const v = revisarArchivo(
      { titulo: "Los 10 errores más grandes que cometen los vendedores por internet" },
      [
        {
          titulo: "Terremoto en Filipinas: 120 muertos y miles de casas destruidas",
          publicadaEn: "2026-08-28T10:00:00.000Z",
        },
      ],
      AHORA,
    );
    expect(v).toEqual({ repite: false });
  });
});

describe("EL ENGANCHE: el filtro tiene que actuar donde se elige el tema", () => {
  /**
   * El agujero de verdad no era el algoritmo: era que **nadie lo llamaba** para la actualidad. La
   * comprobación existía solo dentro del banco de ideas propias. Estas pruebas fijan el enganche.
   */
  async function baseCon(candidatos: { id: string; title: string; summary?: string }[]) {
    const { FakeD1 } = await import("./fake-d1");
    const escrituras: { sql: string; params: unknown[] }[] = [];
    const db = new FakeD1((sql, params) => {
      if (sql.includes("FROM sections")) return [{ id: "economia", notes_per_day: 4 }];
      if (sql.includes("FROM articles") && sql.includes("COUNT")) return [];
      if (sql.includes("FROM candidates"))
        return candidatos.map((c) => ({
          id: c.id,
          section_id: "economia",
          url: `https://ejemplo.com/${c.id}`,
          title: c.title,
          summary: c.summary ?? null,
          lang: "es",
          published_at: "2026-08-29T09:00:00.000Z",
          score: 10,
        }));
      if (sql.startsWith("UPDATE candidates")) escrituras.push({ sql, params });
      return [];
    });
    return { db, escrituras };
  }

  it("un tema ya contado SE SALTA y se coge el siguiente", async () => {
    const { pickCandidate } = await import("@/lib/robot/universal");
    const { db, escrituras } = await baseCon([
      { id: "repe", title: RUTAS.titulo, summary: RUTAS.resumen },
      { id: "bueno", title: "El café colombiano bate su récord de exportación" },
    ]);
    const elegido = await pickCandidate(db.asD1(), AHORA, [ORMUZ]);
    expect(elegido?.id, "tenía que saltarse el repetido").toBe("bueno");
    // Y el repetido se aparta de la cola CON SU MOTIVO escrito, para no volver a mirarlo.
    const fuera = escrituras.find((e) => e.sql.includes("'skipped'"));
    expect(fuera).toBeDefined();
    expect(String(fuera!.params[1])).toContain("ya lo contamos");
  });

  it("si el tema sigue vivo y trae datos nuevos, se escribe y se marca como capítulo", async () => {
    const { pickCandidate } = await import("@/lib/robot/universal");
    const { db } = await baseCon([
      {
        id: "seguimiento",
        title: "Terremoto en Filipinas: ya son 340 los muertos y 18 países mandaron ayuda",
        summary: "El balance subió a 340. Japón, Corea y Australia enviaron equipos.",
      },
    ]);
    const elegido = await pickCandidate(db.asD1(), AHORA, [
      {
        titulo: "Terremoto en Filipinas: 120 muertos y miles de casas destruidas",
        entradilla: "El sismo de magnitud 7,1 dejó al menos 120 fallecidos.",
        publicadaEn: "2026-08-27T10:00:00.000Z",
      },
    ]);
    expect(elegido?.id).toBe("seguimiento");
    expect(elegido?.seguimiento?.novedades.length).toBeGreaterThanOrEqual(2);
  });

  it("sin archivo se comporta como siempre: no bloquea nada", async () => {
    const { pickCandidate } = await import("@/lib/robot/universal");
    const { db } = await baseCon([{ id: "uno", title: RUTAS.titulo }]);
    expect((await pickCandidate(db.asD1(), AHORA))?.id).toBe("uno");
  });

  it("si TODOS repiten, no se publica basura: mejor sin nota que la misma dos veces", async () => {
    const { pickCandidate } = await import("@/lib/robot/universal");
    const { db } = await baseCon([
      { id: "a", title: RUTAS.titulo, summary: RUTAS.resumen },
      { id: "b", title: RUTAS.titulo, summary: RUTAS.resumen },
    ]);
    expect(await pickCandidate(db.asD1(), AHORA, [ORMUZ])).toBeNull();
  });
});

describe("lo que se le dice al redactor", () => {
  it("en un capítulo nuevo se le exige EMPEZAR por lo nuevo", async () => {
    const { bloqueSeguimiento } = await import("@/lib/robot/writer");
    const t = bloqueSeguimiento({
      de: "Terremoto en Filipinas: 120 muertos",
      novedades: ["340", "18", "japon"],
    });
    expect(t).toContain("CAPÍTULO MÁS");
    expect(t).toContain("Terremoto en Filipinas: 120 muertos");
    expect(t).toContain("340");
    expect(t).toContain("Empieza por lo nuevo");
    // Sin seguimiento, ni una línea de más en el prompt.
    expect(bloqueSeguimiento(undefined)).toBe("");
  });

  it("se le pasan los titulares de la portada para que no titule igual", async () => {
    const { bloqueYaPublicado } = await import("@/lib/robot/writer");
    const t = bloqueYaPublicado([ORMUZ.titulo, "Otro titular"]);
    expect(t).toContain(ORMUZ.titulo);
    expect(t).toContain("no repitas");
    expect(bloqueYaPublicado([])).toBe("");
  });

  it("una NOTICIA no puede titularse como una guía (fue justo lo que pasó)", async () => {
    const { buildUniversalPrompt } = await import("@/lib/robot/writer");
    const p = buildUniversalPrompt({
      sectionId: "economia",
      topicTitle: "EEUU bloquea el paso de petróleo",
      kind: "news",
      sources: [{ title: "El País", url: "https://elpais.com/x", text: "texto" }],
    });
    expect(p).toContain("No lo titules como una guía");
    // En una guía duradera, en cambio, ese titular sí es el suyo.
    const g = buildUniversalPrompt({
      sectionId: "economia",
      topicTitle: "Cómo funcionan las sanciones",
      kind: "evergreen",
      sources: [{ title: "El País", url: "https://elpais.com/x", text: "texto" }],
    });
    expect(g).toContain("GUÍA DURADERA");
  });
});
