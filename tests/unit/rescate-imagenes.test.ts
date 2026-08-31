import { describe, expect, it, vi } from "vitest";
import { notasSinImagen, palabrasParaFoto, rescatarImagenes } from "@/lib/robot/rescate-imagenes";
import { FakeD1 } from "./fake-d1";

const TITULO =
  "20.682 quejas en seis meses: la ola de cierres de cuentas bancarias que golpea a los inmigrantes en Estados Unidos";
const TITULO_EN =
  "20,682 complaints in six months: the wave of bank account closures hitting immigrants in the United States";

describe("con qué se busca la foto", () => {
  it("BUSCA COSAS QUE SE PUEDEN FOTOGRAFIAR, no cifras ni coletillas", () => {
    // «20.682 quejas en seis meses» no es una imagen. «bank account closures» sí.
    const p = palabrasParaFoto(TITULO, TITULO_EN);
    expect(p).not.toContain("682");
    expect(p).not.toContain("months");
    expect(p.join(" ")).toMatch(/complaints|wave|bank/);
  });

  it("usa el titular en INGLÉS cuando existe", () => {
    // Los bancos de fotos tienen mucho más material etiquetado en inglés; buscar en español
    // devuelve resultados pobres o ninguno.
    expect(palabrasParaFoto("El dólar sube", "The dollar rises")).toContain("dollar");
    // Y si no hay traducción, se apaña con el español antes que quedarse sin foto.
    expect(palabrasParaFoto("El dólar sube hoy").length).toBeGreaterThan(0);
  });

  it("quita las muletillas de titular que solo dan fotos genéricas", () => {
    const p = palabrasParaFoto("10 curiosidades sobre el café", "10 facts about coffee");
    expect(p).not.toContain("facts");
    expect(p).toContain("coffee");
  });

  it("manda como mucho tres palabras y sin repetir", () => {
    const p = palabrasParaFoto("bank bank bank account closures immigrants united states", null);
    expect(p.length).toBeLessThanOrEqual(3);
    expect(new Set(p).size).toBe(p.length);
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
