import { describe, expect, it } from "vitest";
import { slugify } from "@/lib/slug";
import { draftSchema } from "@/lib/robot/writer";

/**
 * Por qué buscar «losupe» en Google Imágenes no devolvía ni una foto nuestra (24 ago 2026), y qué
 * lo arregla. Son señales pequeñas que se pierden solas si nadie las vigila.
 */

describe("las imágenes tienen que poder encontrarse", () => {
  it("el nombre del archivo respeta las tildes en vez de comérselas", () => {
    // Antes se hacía a mano con /[^a-z0-9]+/ y salía «gu-a-para-empresas»: el nombre del archivo
    // cuenta para Google Imágenes, y así no dice nada.
    expect(slugify("Guía para empresas sobre cómo responder")).toBe(
      "guia-para-empresas-sobre-como-responder",
    );
    expect(slugify("Cuánto cuesta un dominio en 2026")).toBe("cuanto-cuesta-un-dominio-en-2026");
    expect(slugify("Economía y ñandú")).toBe("economia-y-nandu");
  });

  it("el redactor entrega también el pie de foto, no solo el texto alternativo", () => {
    const campos = Object.keys(draftSchema.shape);
    // El alternativo describe la imagen para quien no la ve; el pie cuenta algo y se lee.
    expect(campos).toContain("image_alt_es");
    expect(campos).toContain("image_caption_es");
    expect(campos).toContain("image_caption_en");
  });

  it("el pie es opcional pero, si viene, tiene que decir algo", () => {
    const base = {
      image_caption_es: "x",
    };
    const corto = draftSchema.shape.image_caption_es.safeParse(base.image_caption_es);
    expect(corto.success).toBe(false); // dos letras no son un pie de foto
    expect(draftSchema.shape.image_caption_es.safeParse(undefined).success).toBe(true);
    expect(
      draftSchema.shape.image_caption_es.safeParse(
        "La sede de la compañía en Miami, donde se anunció el cambio esta semana.",
      ).success,
    ).toBe(true);
  });
});

describe("peso de las imágenes", () => {
  it("a Pexels se le pide el tamaño que hace falta, no el máximo", async () => {
    const { aMedida, ANCHO_GRANDE, ANCHO_TARJETA } = await import("@/lib/robot/images");
    const original = "https://images.pexels.com/photos/123/foto.jpeg?auto=compress&w=99999";
    // El 29 ago 2026 se descargaba una foto de 1880 px y 427 KB para pintarla a 142 px.
    expect(aMedida(original, ANCHO_GRANDE)).toBe(
      "https://images.pexels.com/photos/123/foto.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1600",
    );
    expect(aMedida(original, ANCHO_TARJETA)).toContain("w=640");
    expect(ANCHO_TARJETA).toBeLessThan(ANCHO_GRANDE);
    // Lo que no es de Pexels se deja tal cual: no se inventan parámetros ajenos.
    expect(aMedida("https://otro.com/foto.jpg", 640)).toBe("https://otro.com/foto.jpg");
  });

  it("la miniatura tiene su nombre propio, previsible", async () => {
    const { rutaMiniatura } = await import("@/lib/robot/images");
    expect(rutaMiniatura("/media/notas/2026-08-29-una-nota.jpg")).toBe(
      "/media/notas/2026-08-29-una-nota-sm.jpg",
    );
    expect(rutaMiniatura("/media/notas/x.png")).toBe("/media/notas/x-sm.png");
    // Sin extensión conocida no se toca (mejor servir la grande que una ruta rota).
    expect(rutaMiniatura("/media/notas/raro")).toBe("/media/notas/raro");
  });
});
