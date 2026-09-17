import { describe, expect, it, vi } from "vitest";
import { imagenSocial } from "@/lib/imagen-social";
import { aMedida, esImagenPesada, TOPE_IMAGEN_SOCIAL } from "@/lib/robot/images";
import { claveR2, rehacerImagenesPesadas } from "@/lib/robot/rescate-imagenes";
import { FakeD1 } from "./fake-d1";

/**
 * AL COMPARTIR EN WHATSAPP SALÍA EL LOGO (17 sep 2026).
 *
 * La nota de Trump y Canadá se compartía con el logo de losupe en vez de la foto. Medido: la foto
 * pesaba 2,67 MB y era PNG (con extensión .jpg), y su miniatura 480 KB, también PNG. WhatsApp no
 * descarga vistas previas de más de unos 300 KB: se rinde y pone el icono del sitio.
 *
 * Dos causas: a Pexels se le pedía `auto=compress`, que CONSERVA el formato original (una foto
 * subida en PNG llega en PNG), y la tarjeta social apuntaba a la foto grande.
 */
describe("a Pexels se le pide JPEG, siempre", () => {
  it("la dirección lleva fm=jpg y calidad", () => {
    const u = aMedida("https://images.pexels.com/photos/1/pexels-photo-1.png?x=y", 1600);
    expect(u).toContain("fm=jpg");
    expect(u).toMatch(/q=\d+/);
    expect(u).toContain("w=1600");
    // Y el parámetro viejo que viniera se descarta, no se mezcla.
    expect(u).not.toContain("x=y");
  });

  it("las direcciones que no son de Pexels no se tocan", () => {
    expect(aMedida("https://fal.media/abc.png", 1600)).toBe("https://fal.media/abc.png");
  });
});

describe("al compartir va la MINIATURA, no la foto grande", () => {
  it("una foto del robot comparte su versión pequeña", () => {
    expect(imagenSocial({ imageUrl: "/media/notas/una.jpg", sectionId: "economia" })).toBe(
      "/media/notas/una-sm.jpg",
    );
  });

  it("sin foto, la tarjeta PNG de la sección (las redes no pintan SVG)", () => {
    expect(imagenSocial({ imageUrl: null, sectionId: "cripto" })).toBe("/og/cripto.png");
  });

  it("una foto local sin miniatura generada se comparte entera, nunca rota", () => {
    expect(imagenSocial({ imageUrl: "/img/notas/no-existe/x.jpg", sectionId: "ventas" })).toBe(
      "/img/notas/no-existe/x.jpg",
    );
  });
});

describe("qué foto no sirve para compartir", () => {
  it("el caso real: PNG de 480 KB", () => {
    expect(esImagenPesada({ size: 479_597, contentType: "image/png" })).toBe(true);
  });

  it("un PNG pequeño tampoco: el formato ya delata que no pasó por la compresión", () => {
    expect(esImagenPesada({ size: 40_000, contentType: "image/png" })).toBe(true);
  });

  it("un JPEG por encima del tope, sí; uno normal, no", () => {
    expect(esImagenPesada({ size: TOPE_IMAGEN_SOCIAL + 1, contentType: "image/jpeg" })).toBe(true);
    expect(esImagenPesada({ size: 45_880, contentType: "image/jpeg" })).toBe(false);
  });

  it("el tope deja margen por debajo de los ~300 KB de WhatsApp", () => {
    expect(TOPE_IMAGEN_SOCIAL).toBeLessThan(300_000);
  });

  it("la clave de R2 sale de la dirección pública", () => {
    expect(claveR2("/media/notas/a%20b.jpg")).toBe("notas/a b.jpg");
    expect(claveR2("/img/notas/x.jpg")).toBeNull();
  });
});

describe("las fotos recientes que ya estaban guardadas se rehacen", () => {
  const filas = [
    {
      id: "pesada",
      image_url: "/media/notas/trump.jpg",
      slug: "trump",
      title: "Trump y Canadá",
      title_en: "Trump and Canada trade",
      excerpt: null,
    },
    {
      id: "ligera",
      image_url: "/media/notas/ok.jpg",
      slug: "ok",
      title: "Café",
      title_en: "Coffee harvest",
      excerpt: null,
    },
  ];

  it("rehace la PNG pesada con OTRO nombre y deja en paz la ligera", async () => {
    const db = new FakeD1((sql) => (sql.includes("LIKE '/media/%'") ? filas : []));
    const head = vi.fn(async (key: string) =>
      key.startsWith("notas/trump")
        ? { size: 479_597, httpMetadata: { contentType: "image/png" } }
        : { size: 45_880, httpMetadata: { contentType: "image/jpeg" } },
    );
    const put = vi.fn(async () => ({}));
    const fetchImpl = (async (u: RequestInfo | URL) =>
      String(u).includes("api.pexels.com")
        ? Response.json({
            photos: [
              {
                src: { large2x: "https://images.pexels.com/p.jpeg" },
                photographer: "Ana",
                alt: "Trump canada trade port",
              },
            ],
          })
        : new Response(new Uint8Array([1, 2]), {
            headers: { "content-type": "image/jpeg" },
          })) as unknown as typeof fetch;

    const r = await rehacerImagenesPesadas(
      db.asD1(),
      { PEXELS_API_KEY: "k", BUCKET: { head, put } as unknown as R2Bucket },
      { fetchImpl },
    );
    expect(r.revisadas).toBe(2);
    expect(r.pesadas).toBe(1);
    expect(r.rehechas).toBe(1);
    const actualizada = db.calls.find((c) => c.sql.startsWith("UPDATE articles"));
    expect(actualizada?.params[0]).toBe("pesada");
    expect(actualizada?.sql).not.toContain("updated_at");
    // Nombre NUEVO: las fotos van con caché inmutable de un año, sobrescribir no serviría.
    expect(String(actualizada?.params[1])).not.toBe("/media/notas/trump.jpg");
    expect(String(actualizada?.params[1])).toMatch(/^\/media\/notas\/trump-j/);
  });

  it("sin bucket no hace nada ni se cae", async () => {
    const db = new FakeD1(() => filas);
    const r = await rehacerImagenesPesadas(db.asD1(), {});
    expect(r).toEqual({ revisadas: 0, pesadas: 0, rehechas: 0, errores: [] });
  });
});
