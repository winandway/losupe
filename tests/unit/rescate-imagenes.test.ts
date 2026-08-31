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
    expect(p.join(" ")).toMatch(/bank|account|closures|immigrants|states/);
  });

  it("toma las ÚLTIMAS palabras, que es donde vive el sustantivo", () => {
    // En un titular de diario, delante va el gancho (cifra, metáfora) y detrás el tema de verdad.
    const p = palabrasParaFoto("x", "the wave of bank account closures hitting immigrants");
    expect(p).not.toContain("wave");
    expect(p.join(" ")).toContain("immigrants");
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
        photos: [{ src: { large2x: "https://images.pexels.com/x.jpg" }, photographer: "Ana Ruiz" }],
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
            photos: [{ src: { large2x: "https://images.pexels.com/y.jpg" }, photographer: "Luis" }],
          });
        }
        return new Response(new Uint8Array([1]), { headers: { "content-type": "image/jpeg" } });
      }) as unknown as typeof fetch,
    });
    expect(r.ilustradas).toBe(1);
    expect(r.errores.length).toBe(1);
  });
});
