import { describe, expect, it } from "vitest";
import {
  efemeridesDeHoy,
  ordenarEfemerides,
  seccionDeEfemeride,
  titularDeEfemeride,
  type Efemeride,
} from "@/lib/robot/efemerides";
import { ideasDeSeccion, siguienteIdea, temaDe, todasLasIdeas } from "@/lib/robot/ideas";
import { elegirGenero, encargoDelTurno, RATIO_PROPIAS_POR_DEFECTO } from "@/lib/robot/mesa";
import { FakeD1 } from "./fake-d1";

const REGLAS = { ratioPropias: RATIO_PROPIAS_POR_DEFECTO, efemerides: true };

describe("banco de ideas propias", () => {
  it("hay ideas en las cinco secciones, y ninguna repetida", () => {
    const todas = todasLasIdeas();
    expect(todas.length).toBeGreaterThan(50);
    const titulares = todas.map((i) => i.titular);
    expect(new Set(titulares).size).toBe(titulares.length);
    for (const s of ["economia", "ventas", "tecnologia", "cripto", "artistas"] as const) {
      expect(ideasDeSeccion(s).length).toBeGreaterThan(5);
    }
  });

  it("son los titulares que pidió Richard", () => {
    const titulares = todasLasIdeas().map((i) => i.titular);
    expect(titulares).toContain(
      "10 curiosidades sobre las ventas por internet que casi nadie conoce",
    );
    expect(titulares).toContain("10 curiosidades sobre Michael Jackson que casi nadie conoce");
    expect(titulares).toContain(
      "Los 10 errores más grandes que cometen las empresas chinas al vender fuera",
    );
    expect(titulares).toContain(
      "Los 10 errores más grandes que cometen los vendedores por internet",
    );
  });

  it("cada idea dice QUÉ buscar: sin fuentes, una lista de curiosidades se inventa sola", () => {
    for (const idea of todasLasIdeas()) {
      expect(idea.busqueda.length).toBeGreaterThan(20);
      expect(idea.titular.length).toBeGreaterThan(15);
    }
  });

  it("no repite un tema que ya se publicó", () => {
    const primera = siguienteIdea("cripto", [])!;
    expect(primera).toBeTruthy();
    // Se publica esa; la siguiente vez tiene que salir otra distinta.
    const segunda = siguienteIdea("cripto", [`Ya publicamos algo sobre ${temaDe(primera)} ayer`])!;
    expect(temaDe(segunda)).not.toBe(temaDe(primera));
  });

  it("si se agotan las ideas de una sección, vuelve a empezar en vez de quedarse sin nada", () => {
    const todos = ideasDeSeccion("cripto").map((i) => temaDe(i));
    expect(siguienteIdea("cripto", todos)).not.toBeNull();
  });
});

describe("efemérides: qué se cumple hoy", () => {
  const base: Efemeride = {
    year: 2016,
    aniversario: 10,
    texto: "Murió Juan Gabriel, cantante y compositor mexicano",
    fuentes: [{ titulo: "Juan Gabriel", url: "https://es.wikipedia.org/wiki/Juan_Gabriel" }],
    sectionId: "artistas",
    redondo: true,
  };

  it("EL CASO DE RICHARD: diez años sin Juan Gabriel", () => {
    expect(titularDeEfemeride(base)).toBe("10 años sin Juan Gabriel");
    expect(seccionDeEfemeride(base.texto)).toBe("artistas");
  });

  it("los aniversarios redondos van primero: «hace 37 años» no le importa a nadie", () => {
    const suelto: Efemeride = { ...base, aniversario: 37, redondo: false, year: 1989 };
    const grande: Efemeride = { ...base, aniversario: 50, redondo: true, year: 1976 };
    const orden = ordenarEfemerides([suelto, base, grande]);
    expect(orden.map((e) => e.aniversario)).toEqual([50, 10, 37]);
  });

  it("lo que no es tema nuestro se descarta", () => {
    expect(seccionDeEfemeride("Se libró la batalla de tal sitio")).toBeNull();
    expect(seccionDeEfemeride("Nació un futbolista")).toBeNull();
    expect(seccionDeEfemeride("Se lanzó el primer satélite artificial")).toBe("tecnologia");
    expect(seccionDeEfemeride("Quebró un banco importante")).toBe("economia");
  });

  it("una efeméride SIN fuente no se usa: sería inventarla", async () => {
    const sinPaginas: typeof fetch = async () =>
      new Response(
        JSON.stringify({ deaths: [{ year: 2016, text: "Murió un cantante famoso", pages: [] }] }),
        { headers: { "content-type": "application/json" } },
      );
    expect(await efemeridesDeHoy(new Date("2026-08-28T16:00:00Z"), sinPaginas)).toEqual([]);
  });

  it("si Wikipedia no responde, el diario sigue igual", async () => {
    const caida: typeof fetch = async () => {
      throw new Error("sin red");
    };
    expect(await efemeridesDeHoy(new Date("2026-08-28T16:00:00Z"), caida)).toEqual([]);
  });
});

describe("la mesa reparte el trabajo del día", () => {
  it("una efeméride redonda MANDA: solo se puede contar hoy", () => {
    expect(elegirGenero(0, REGLAS, true, true)).toBe("efemeride");
    expect(elegirGenero(7, REGLAS, true, true)).toBe("efemeride");
  });

  it("sin actualidad no se queda de brazos cruzados: escribe una propia", () => {
    expect(elegirGenero(5, REGLAS, false, false)).toBe("propia");
  });

  it("reparte según el ajuste, sin azar (mismo día, mismo resultado)", () => {
    const generos = Array.from({ length: 10 }, (_, i) => elegirGenero(i, REGLAS, false, true));
    // Con 0.4, cuatro de cada diez son propias.
    expect(generos.filter((g) => g === "propia")).toHaveLength(4);
    expect(generos.filter((g) => g === "actualidad")).toHaveLength(6);
    // Y es estable: la misma entrada da la misma salida.
    expect(elegirGenero(3, REGLAS, false, true)).toBe(elegirGenero(3, REGLAS, false, true));
  });

  it("con el ajuste en cero, solo actualidad", () => {
    const soloNoticias = { ratioPropias: 0, efemerides: false };
    for (let i = 0; i < 10; i++)
      expect(elegirGenero(i, soloNoticias, true, true)).toBe("actualidad");
  });

  it("el encargo trae el tema resuelto, no solo el género", async () => {
    const db = new FakeD1(() => []);
    const sinWiki: typeof fetch = async () => new Response("{}", { status: 500 });
    const encargo = await encargoDelTurno(db.asD1(), {
      notasHoy: 0,
      hayActualidad: false,
      titularesRecientes: [],
      seccionesConCupo: ["ventas"],
      fetchImpl: sinWiki,
    });
    expect(encargo.genero).toBe("propia");
    if (encargo.genero === "propia") {
      expect(encargo.idea.sectionId).toBe("ventas");
      expect(encargo.idea.titular).toMatch(/curiosidades|errores|cómo|qué/i);
    }
  });

  it("sin secciones con cupo, cae en actualidad y no explota", async () => {
    const db = new FakeD1(() => []);
    const encargo = await encargoDelTurno(db.asD1(), {
      notasHoy: 0,
      hayActualidad: true,
      titularesRecientes: [],
      seccionesConCupo: [],
    });
    expect(encargo.genero).toBe("actualidad");
  });
});

describe("una pieza propia es una nota, no un resumen", () => {
  it("el encargo pide el largo de una nota de diario", async () => {
    const { buildPiezaPropiaPrompt } = await import("@/lib/robot/writer");
    const prompt = buildPiezaPropiaPrompt({
      titularPropuesto: "10 curiosidades sobre bitcoin que casi nadie conoce",
      genero: "curiosidades",
      sectionId: "cripto",
      sources: [{ title: "Bitcoin", url: "https://es.wikipedia.org/wiki/Bitcoin", text: "texto" }],
    });
    // El 25 ago 2026 la franja de la tarde se perdió entera con «el borrador es muy corto
    // (342 palabras)»: el encargo no decía nada del largo y salían listas de dos líneas por punto.
    expect(prompt).toContain("700");
    expect(prompt).toContain("1.100 palabras");
    expect(prompt).toMatch(/cada punto necesita su párrafo/i);
  });

  it("si sale corta, el reintento se lo dice con esas palabras", async () => {
    const { writeDraft } = await import("@/lib/robot/writer");
    const prompts: string[] = [];
    const corto = {
      es: {
        title: "Un titular suficientemente largo para pasar",
        excerpt: "Una entradilla que pasa el mínimo de sesenta caracteres sin problema alguno.",
        // Pasa el mínimo de caracteres del esquema pero se queda muy por debajo de las 450
        // palabras: es exactamente el caso que tumbó la franja de la tarde.
        content_html: `<p>${"palabradelargaquesuma ".repeat(90)}</p>`,
        meta_title: "Un meta titulo valido",
        meta_description: "Una meta descripcion que pasa el minimo de cincuenta caracteres.",
        tags: ["aa", "bb", "ccc"],
      },
      kind: "evergreen",
      image_prompt: "una foto de prensa",
      image_alt_es: "texto alternativo",
      image_alt_en: "alt text",
      image_keywords: ["foto"],
    };
    const fetchImpl: typeof fetch = async (_u, init) => {
      prompts.push(JSON.parse(String(init?.body)).contents[0].parts[0].text as string);
      return new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: JSON.stringify({ ...corto, en: corto.es }) }] } },
          ],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 },
        }),
        { headers: { "content-type": "application/json" } },
      );
    };
    await writeDraft("prompt", ["fuente"], { apiKey: "k", fetchImpl, retries: 1 }).catch(
      () => null,
    );
    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("DEMASIADO CORTO");
    expect(prompts[1]).toContain("450 palabras");
  });
});
