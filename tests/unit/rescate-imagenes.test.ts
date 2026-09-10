import { describe, expect, it, vi } from "vitest";
import { notasSinImagen, palabrasParaFoto, rescatarImagenes } from "@/lib/robot/rescate-imagenes";
import { FakeD1 } from "./fake-d1";

const TITULO =
  "20.682 quejas en seis meses: la ola de cierres de cuentas bancarias que golpea a los inmigrantes en Estados Unidos";
const TITULO_EN =
  "20,682 complaints in six months: the wave of bank account closures hitting immigrants in the United States";

describe("LA OLA DEL MAR: qué se debe ver en la foto", () => {
  /**
   * El fallo que hay que recordar. La primera versión sacaba las tres primeras palabras «útiles»
   * del titular en inglés. Para «the WAVE of bank account closures» eso dio *wave*, y Pexels
   * devolvió, muy obedientemente, una ola del mar para una nota sobre cierres de cuentas.
   * Una foto real que no tiene nada que ver es PEOR que un icono: el icono al menos no miente.
   */
  it("no busca metáforas: «la ola de cierres» no es una ola del mar", () => {
    const p = palabrasParaFoto(TITULO, TITULO_EN);
    expect(p, "«wave» es la metáfora del titular, no lo que hay que fotografiar").not.toContain(
      "wave",
    );
    expect(p.join(" ")).toMatch(/bank|account|closures/);
  });

  it("LAS COSAS MANDAN; LOS LUGARES SOLO ACOMPAÑAN (la bandera, 10 sep 2026)", () => {
    // Caso medido: para la guía del casillero la heurística buscaba «america without surprises» y
    // el banco devolvió una bandera de Estados Unidos. Ni «without» ni «surprises» son cosas, y
    // «america» sola da banderas y mapas.
    const p = palabrasParaFoto(
      "Casillero en Miami: la guía para comprar en Estados Unidos y que te llegue a Sudamérica",
      "A Miami mailbox: the guide to shopping in the U.S. and getting it to South America without surprises",
    );
    expect(p).not.toContain("without");
    expect(p).not.toContain("surprises");
    expect(p[0], "primero la cosa que se fotografía").toBe("mailbox");
    // El lugar puede ir, pero acompañando y nunca el primero.
    expect(p.indexOf("miami")).toBeGreaterThan(0);
  });

  it("un titular que SOLO nombra lugares no busca nada: mejor sin foto que una bandera", () => {
    expect(palabrasParaFoto("Estados Unidos y Colombia", "United States and Colombia")).toEqual([]);
  });

  it("y sigue sin comerse las metáforas del principio", () => {
    const p = palabrasParaFoto("x", "the wave of bank account closures hitting immigrants");
    expect(p).not.toContain("wave");
    expect(p.join(" ")).toMatch(/bank|account|closures/);
  });

  it("tampoco busca cifras ni medidas de tiempo", () => {
    const p = palabrasParaFoto(TITULO, TITULO_EN);
    expect(p).not.toContain("682");
    expect(p).not.toContain("months");
  });

  it("usa el titular en INGLÉS cuando existe", () => {
    // Los bancos de fotos tienen mucho más material etiquetado en inglés.
    expect(palabrasParaFoto("El dólar sube", "The dollar rises")).toContain("dollar");
    expect(palabrasParaFoto("El dólar sube hoy").length).toBeGreaterThan(0);
  });

  it("quita las muletillas de titular que solo dan fotos genéricas", () => {
    const p = palabrasParaFoto("10 curiosidades sobre el café", "coffee beans facts");
    expect(p).not.toContain("facts");
    expect(p).toContain("coffee");
  });

  it("manda como mucho tres palabras y sin repetir", () => {
    const p = palabrasParaFoto("x", "bank bank bank account closures immigrants united states");
    expect(p.length).toBeLessThanOrEqual(3);
    expect(new Set(p).size).toBe(p.length);
  });
});

describe("el editor gráfico: se le pregunta al modelo qué se debe ver", () => {
  it("le pide un OBJETO fotografiable y le prohíbe la metáfora", async () => {
    const { SISTEMA_FOTO } = await import("@/lib/robot/rescate-imagenes");
    // Lo que hace buena la respuesta está en las instrucciones, y el ejemplo es el caso real.
    expect(SISTEMA_FOTO).toContain("no es una ola del mar");
    expect(SISTEMA_FOTO).toContain("OBJETO");
    expect(SISTEMA_FOTO).toContain("EN INGLÉS");
    // Y dos reglas que salieron de mirar el resultado: fotografiar LA COSA, no a quién le pasa; y
    // nada de pancartas — una pancarta le pone al diario una opinión que la nota no tiene.
    expect(SISTEMA_FOTO).toContain("no a quién le pasa");
    expect(SISTEMA_FOTO).toContain("pancartas");
  });

  it("devuelve lo que dice el modelo, limpio y sin metáforas coladas", async () => {
    const { preguntarQueFoto } = await import("@/lib/robot/rescate-imagenes");
    const responder = (buscar: string) =>
      vi.fn(async () =>
        Response.json({
          candidates: [{ content: { parts: [{ text: JSON.stringify({ buscar }) }] } }],
          usageMetadata: { promptTokenCount: 90, candidatesTokenCount: 8 },
        }),
      );
    const r = await preguntarQueFoto({
      apiKey: "k",
      titulo: TITULO,
      fetchImpl: responder("bank card atm") as unknown as typeof fetch,
    });
    expect(r).toEqual(["bank", "card", "atm"]);
    // Y si al modelo se le cuela una metáfora, se cae aquí también.
    expect(
      await preguntarQueFoto({
        apiKey: "k",
        titulo: TITULO,
        fetchImpl: responder("wave ocean") as unknown as typeof fetch,
      }),
    ).toEqual(["ocean"]);
  });

  it("sin llave o si falla, no bloquea: manda la heurística", async () => {
    const { preguntarQueFoto } = await import("@/lib/robot/rescate-imagenes");
    expect(await preguntarQueFoto({ titulo: TITULO })).toBeNull();
    const caido = vi.fn(async () => new Response("no", { status: 500 }));
    expect(
      await preguntarQueFoto({
        apiKey: "k",
        titulo: TITULO,
        fetchImpl: caido as unknown as typeof fetch,
      }),
    ).toBeNull();
  });
});

describe("a quién rescata", () => {
  it("solo notas PUBLICADAS y de verdad sin imagen", async () => {
    const db = new FakeD1(() => []);
    await notasSinImagen(db.asD1(), 5);
    const sql = db.calls[0]?.sql ?? "";
    expect(sql).toContain("status = 'published'");
    // La cadena vacía cuenta como sin imagen: sin esto, una nota con `image_url = ''` se quedaba
    // fuera del rescate y con el hueco puesto para siempre.
    expect(sql).toContain("image_url IS NULL OR a.image_url = ''");
  });
});

describe("el rescate en marcha", () => {
  const fila = {
    id: "art-1",
    slug: "cierres-de-cuentas",
    title: TITULO,
    title_en: TITULO_EN,
  };
  const baseCon = (filas: Record<string, unknown>[]) =>
    new FakeD1((sql) => (sql.includes("FROM articles") && sql.includes("JOIN") ? filas : []));

  it("le pone la foto a la nota y guarda el crédito", async () => {
    const db = baseCon([fila]);
    const pexels = vi.fn(async () =>
      Response.json({
        photos: [
          {
            src: { large2x: "https://images.pexels.com/x.jpg" },
            photographer: "Ana Ruiz",
            // Las fotos de verdad traen su descripción, y ahora se comprueba que corresponda.
            alt: "Bank complaints desk in a United States office",
          },
        ],
      }),
    );
    const env = {
      PEXELS_API_KEY: "k",
      BUCKET: {
        put: vi.fn(async () => ({})),
      },
    } as never;
    const r = await rescatarImagenes(db.asD1(), env, {
      fetchImpl: (async (u: RequestInfo | URL) =>
        String(u).includes("api.pexels.com")
          ? await pexels()
          : new Response(new Uint8Array([1, 2, 3]), {
              headers: { "content-type": "image/jpeg" },
            })) as unknown as typeof fetch,
    });
    expect(r.encontradas).toBe(1);
    expect(r.ilustradas).toBe(1);
    // Y el crédito del fotógrafo se guarda: es la condición de la licencia de Pexels.
    const guardado = db.calls.find((c) => c.sql.startsWith("UPDATE articles"));
    expect(guardado).toBeDefined();
    expect(String(guardado!.params.join(" "))).toContain("Ana Ruiz");
  });

  it("SI NO HAY FOTO, LA NOTA SIGUE EN PIE y el fallo queda escrito", async () => {
    const db = baseCon([fila]);
    const env = { PEXELS_API_KEY: "k" } as never;
    const r = await rescatarImagenes(db.asD1(), env, {
      fetchImpl: (async () => Response.json({ photos: [] })) as unknown as typeof fetch,
    });
    expect(r.ilustradas).toBe(0);
    // Nada de tragarse el fallo: se dice cuál nota y por qué. Un rescate mudo es como no tenerlo.
    expect(r.errores[0]).toContain("cierres-de-cuentas");
    // Y no se toca la nota: conserva su portada dibujada.
    expect(db.calls.some((c) => c.sql.startsWith("UPDATE articles"))).toBe(false);
  });

  it("sin llave de fotos no explota ni bloquea la corrida", async () => {
    const db = baseCon([fila]);
    const r = await rescatarImagenes(db.asD1(), {} as never);
    expect(r.ilustradas).toBe(0);
    expect(r.encontradas).toBe(1);
  });

  it("una base rota no puede tumbar la publicación", async () => {
    const rota = {
      prepare: () => {
        throw new Error("no such table: articles");
      },
    } as unknown as D1Database;
    const r = await rescatarImagenes(rota, { PEXELS_API_KEY: "k" } as never);
    expect(r.ilustradas).toBe(0);
    expect(r.errores.length).toBeGreaterThan(0);
  });

  it("un fallo en una nota no deja a la siguiente sin foto", async () => {
    const db = baseCon([fila, { ...fila, id: "art-2", slug: "otra-nota" }]);
    let llamada = 0;
    const env = { PEXELS_API_KEY: "k", BUCKET: { put: vi.fn(async () => ({})) } } as never;
    const r = await rescatarImagenes(db.asD1(), env, {
      fetchImpl: (async (u: RequestInfo | URL) => {
        if (String(u).includes("api.pexels.com")) {
          llamada += 1;
          if (llamada === 1) throw new Error("Pexels cayó");
          return Response.json({
            photos: [
              {
                src: { large2x: "https://images.pexels.com/y.jpg" },
                photographer: "Luis",
                alt: "Bank complaints desk in a United States office",
              },
            ],
          });
        }
        return new Response(new Uint8Array([1]), { headers: { "content-type": "image/jpeg" } });
      }) as unknown as typeof fetch,
    });
    expect(r.ilustradas).toBe(1);
    expect(r.errores.length).toBe(1);
  });
});

describe("EL EDIFICIO NEVADO: la foto tiene que corresponder, o no va", () => {
  /**
   * Tercer intento con las fotos, y el que cierra el agujero de verdad.
   *
   * Afinar las palabras de búsqueda ayudó, pero no basta: **el banco de fotos siempre devuelve
   * algo**, tenga que ver o no. Quedarse con la primera puso una ola del mar en una nota de bancos
   * (31 ago 2026) y un edificio nevado de Milwaukee en una guía sobre un casillero en Miami
   * (10 sep 2026). Mientras nadie mire el RESULTADO, va a volver a pasar.
   *
   * Ahora se mira: cada foto trae su descripción y se exige que coincida con lo buscado.
   */
  it("elige la que coincide con lo buscado, no la primera de la lista", async () => {
    const { elegirFoto } = await import("@/lib/robot/images");
    const fotos = [
      { alt: "Snow covered university building in winter", id: 1 },
      { alt: "Aerial view of a city street", id: 2 },
      { alt: "Warehouse worker scanning shipping boxes", id: 3 },
    ];
    expect(elegirFoto(fotos, ["warehouse", "shipping", "boxes"])?.id).toBe(3);
  });

  it("SI NINGUNA CORRESPONDE, NO PONE NINGUNA", async () => {
    const { elegirFoto } = await import("@/lib/robot/images");
    // Es el caso real: se buscaba un casillero y llegaron edificios y calles.
    const fotos = [
      { alt: "Snow covered university building in winter", id: 1 },
      { alt: "Aerial view of a city street", id: 2 },
    ];
    expect(elegirFoto(fotos, ["mailbox", "shipping", "warehouse"])).toBeUndefined();
    // Porque una foto que no tiene nada que ver es PEOR que no tener foto: el hueco no engaña.
  });

  it("gana la que coincide en más palabras", async () => {
    const { elegirFoto } = await import("@/lib/robot/images");
    const fotos = [
      { alt: "A shipping container at sunset", id: 1 },
      { alt: "Shipping boxes stacked in a warehouse", id: 2 },
    ];
    expect(elegirFoto(fotos, ["shipping", "boxes", "warehouse"])?.id).toBe(2);
  });

  it("sin descripciones ni palabras no se bloquea: sigue como siempre", async () => {
    const { elegirFoto } = await import("@/lib/robot/images");
    // Sin palabras con las que comparar no hay nada que verificar, así que no hay foto.
    expect(elegirFoto([{ alt: "x", id: 1 }], [])).toBeUndefined();
    // Sin lista, no hay foto y punto.
    expect(elegirFoto([], ["boxes"])).toBeUndefined();
    // Una foto sin descripción no puede verificarse, así que no se elige a ciegas.
    expect(elegirFoto([{ alt: undefined }], ["boxes"])).toBeUndefined();
  });

  it("no se cuela por una coincidencia de dos letras", async () => {
    const { elegirFoto } = await import("@/lib/robot/images");
    // Las palabras muy cortas se ignoran: «us» aparecería dentro de cientos de descripciones. Y si
    // no queda ninguna palabra verificable, no hay foto — aceptar a ciegas es lo que trajo la ola.
    expect(elegirFoto([{ alt: "A bus in the city", id: 1 }], ["us"])).toBeUndefined();
  });
});
