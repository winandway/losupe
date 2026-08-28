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
import { FRANJAS } from "@/lib/robot/franjas";
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

describe("la escaleta manda: 2 de actualidad y 2 de curiosidades", () => {
  const F = Object.fromEntries(FRANJAS.map((f) => [f.key, f])) as Record<
    string,
    (typeof FRANJAS)[number]
  >;

  it("EL FALLO DEL 28 AGO 2026: siete notas seguidas de curiosidades, cero de actualidad", () => {
    // La causa era aritmética: `notasHoy % 10 < 4` con tres notas al día da 0, 1 y 2 — los tres
    // menores que 4, así que SIEMPRE salía «propia». Ahora manda la franja, y esto lo demuestra.
    const dia = FRANJAS.map((f, i) => elegirGenero(f, i, REGLAS, true, true));
    expect(dia).toEqual(["actualidad", "efemeride", "actualidad", "efemeride"]);
    // Dos huecos de actualidad, pase lo que pase con las efemérides.
    expect(dia.filter((g) => g === "actualidad")).toHaveLength(2);
  });

  it("una efeméride NO puede comerse la actualidad", () => {
    // Antes: `if (hayEfemerideRedonda) return "efemeride"` iba antes que nada. Y hay aniversarios
    // redondos casi a diario, así que se llevaba por delante todas las noticias.
    expect(elegirGenero(F.manana!, 0, REGLAS, true, true)).toBe("actualidad");
    expect(elegirGenero(F.tarde!, 2, REGLAS, true, true)).toBe("actualidad");
    // En su hueco sí, porque un «diez años sin» solo se puede contar hoy.
    expect(elegirGenero(F.mediodia!, 1, REGLAS, true, true)).toBe("efemeride");
    expect(elegirGenero(F.noche!, 3, REGLAS, true, true)).toBe("efemeride");
  });

  it("si toca actualidad y no hay material, se escribe una propia en vez de perder la nota", () => {
    expect(elegirGenero(F.manana!, 0, REGLAS, false, false)).toBe("propia");
  });

  it("con las efemérides apagadas, el hueco de curiosidades sigue siendo de curiosidades", () => {
    const sinEfemerides = { ratioPropias: 0.4, efemerides: false };
    expect(elegirGenero(F.mediodia!, 1, sinEfemerides, true, true)).toBe("propia");
    expect(elegirGenero(F.manana!, 0, sinEfemerides, true, true)).toBe("actualidad");
  });

  it("a mano, fuera de franja, también alterna 50/50", () => {
    const manual = [0, 1, 2, 3].map((i) => elegirGenero(null, i, REGLAS, false, true));
    expect(manual).toEqual(["actualidad", "propia", "actualidad", "propia"]);
  });

  it("es estable: la misma situación da siempre la misma decisión", () => {
    expect(elegirGenero(F.manana!, 0, REGLAS, true, true)).toBe(
      elegirGenero(F.manana!, 0, REGLAS, true, true),
    );
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

describe("rankings: la franja de la noche pregunta y responde", () => {
  it("los temas que pidió Richard están en el banco", () => {
    const rankings = todasLasIdeas().filter((i) => i.genero === "ranking");
    expect(rankings.length).toBeGreaterThan(20);
    const titulares = rankings.map((i) => i.titular.toLowerCase());
    // El ejemplo con el que llegó: buscó en Google «el producto más vendido del mundo».
    expect(titulares.some((t) => t.includes("producto más vendido del mundo"))).toBe(true);
    expect(titulares.some((t) => t.includes("país que más licor bebe"))).toBe(true);
    expect(titulares.some((t) => t.includes("generación z"))).toBe(true);
    expect(titulares.some((t) => t.includes("más se vende en estados unidos"))).toBe(true);
    expect(titulares.some((t) => t.includes("hogares mexicanos"))).toBe(true);
  });

  it("los titulares enganchan por el TEMA, sin suspense vacío", () => {
    // «La respuesta te sorprenderá» es lo que hace que no vuelvan a leerte.
    for (const idea of todasLasIdeas()) {
      expect(idea.titular).not.toMatch(/sorprender|no vas a creer|increíble|impactante|!/i);
      expect(idea.titular).not.toMatch(/[A-ZÁÉÍÓÚÑ]{4,}/); // sin gritos en mayúsculas
    }
  });

  it("la noche pide rankings y el mediodía NO", () => {
    const noche = siguienteIdea("artistas", [], 0, "ranking");
    expect(noche?.genero).toBe("ranking");
    const mediodia = siguienteIdea("artistas", [], 0, "curiosidades");
    expect(mediodia?.genero).not.toBe("ranking");
  });

  it("la escaleta reparte las dos franjas propias en cosas distintas", async () => {
    const { FRANJAS } = await import("@/lib/robot/franjas");
    const propias = FRANJAS.filter((f) => f.genero === "propia");
    expect(propias).toHaveLength(2);
    // Antes las dos eran lo mismo y se notaba. Ahora una es de curiosidades y otra de rankings.
    expect(new Set(propias.map((f) => f.subgenero)).size).toBe(2);
    expect(FRANJAS.find((f) => f.key === "noche")?.subgenero).toBe("ranking");
  });

  it("el encargo de un ranking pide el dato en la primera frase, sin rodeos", async () => {
    const { buildPiezaPropiaPrompt } = await import("@/lib/robot/writer");
    const prompt = buildPiezaPropiaPrompt({
      titularPropuesto: "Cuál es el producto más vendido del mundo",
      genero: "ranking",
      sectionId: "economia",
      sources: [{ title: "Arroz", url: "https://es.wikipedia.org/wiki/Arroz", text: "texto" }],
    });
    expect(prompt).toMatch(/cada puesto lleva su cifra/i);
    expect(prompt).toMatch(/sin rodeos ni suspense/i);
    expect(prompt).toMatch(/gancho está en el TEMA/i);
  });
});
