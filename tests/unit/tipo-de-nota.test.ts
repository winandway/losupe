import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * NINGUNA NOTA SE MARCABA COMO NOTICIA (6 sep 2026).
 *
 * El tipo de nota (`news` / `evergreen`) se decidía con un porcentaje:
 *   `todayTotal % 10 < Math.round(evergreenRatio * 10)`
 * Con 4 notas al día `todayTotal` solo llega a 3, y 3 siempre es menor que 5. Es EXACTAMENTE el
 * mismo fallo aritmético que tumbó la escaleta (candado 20), repetido en otro sitio.
 *
 * Consecuencias, las dos graves:
 *   1. Todos los titulares salían con forma de guía y por eso se parecían entre sí — que es lo que
 *      hacía que el diario pareciera repetirse.
 *   2. Los datos estructurados decían `Article` en vez de `NewsArticle`, así que Google Noticias
 *      no veía ninguna noticia. El diario llevaba semanas sin poder entrar por esa puerta.
 */
describe("una nota de actualidad es una NOTICIA", () => {
  const pipeline = readFileSync("src/lib/robot/pipeline.ts", "utf8");

  it("el tipo NO se decide con un porcentaje sobre las notas del día", () => {
    // La aritmética que falló dos veces no vuelve al código.
    expect(pipeline).not.toMatch(/noteKind\s*=\s*todayTotal\s*%/);
    expect(pipeline).not.toMatch(/todayTotal % 10 < Math\.round\(evergreenRatio/);
  });

  it("la aritmética vieja, demostrada: con 4 notas al día nunca sale una noticia", () => {
    const tipoViejo = (todayTotal: number, ratio: number) =>
      todayTotal % 10 < Math.round(ratio * 10) ? "evergreen" : "news";
    // notes_per_day = 4 → todayTotal va de 0 a 3. Con el ratio por defecto, todas guías.
    for (const n of [0, 1, 2, 3]) expect(tipoViejo(n, 0.5)).toBe("evergreen");
    // Y ni subiendo el cupo se arregla del todo: hace falta pasar de 5 notas en un día.
    expect(tipoViejo(5, 0.5)).toBe("news");
  });

  it("la rama de actualidad marca «news» y la de pieza propia «evergreen»", () => {
    const actualidad = pipeline.indexOf('if (encargo.genero === "actualidad")');
    expect(actualidad).toBeGreaterThan(0);
    const trozo = pipeline.slice(actualidad, actualidad + 4000);
    expect(trozo).toContain('noteKind = "news"');
    // Y la pieza propia sigue siendo contenido duradero.
    expect(pipeline).toContain('noteKind = "evergreen"');
  });
});

describe("y eso es lo que abre la puerta de Google Noticias", () => {
  it("una nota «news» declara NewsArticle; una guía, Article", async () => {
    const { articleJsonLd } = await import("@/lib/seo");
    const base = {
      id: "a1",
      sectionId: "economia" as const,
      slug: "x",
      title: "Titular",
      excerpt: "Entradilla",
      contentHtml: "<p>Cuerpo</p>",
      authorId: "andreea-blidar",
      authorName: "Andreea Blidar",
      publishedAt: "2026-09-06T10:00:00.000Z",
      updatedAt: "2026-09-06T10:00:00.000Z",
      imageUrl: null,
      imageAlt: "",
      tags: [],
      sources: [],
      aiAssisted: true,
      readingMinutes: 4,
      lang: "es" as const,
      fallback: false,
    };
    const noticia = articleJsonLd(
      "https://losupe.com",
      "es",
      { ...base, kind: "news" } as never,
      "losupe",
    );
    const guia = articleJsonLd(
      "https://losupe.com",
      "es",
      { ...base, kind: "evergreen" } as never,
      "losupe",
    );
    expect((noticia as { "@type": string })["@type"]).toBe("NewsArticle");
    expect((guia as { "@type": string })["@type"]).toBe("Article");
  });
});
