import { describe, expect, it } from "vitest";
import { articleJsonLd, itemListJsonLd, organizationJsonLd, personJsonLd } from "@/lib/seo";
import { splitAfterParagraph } from "@/lib/html";
import { cleanEditorialHtml, internalLinksBlock } from "@/lib/robot/writer";
import { mapFull } from "@/lib/queries";
import { sampleFullRow } from "./fake-d1";

const BASE = "https://losupe.com";
const article = mapFull(sampleFullRow, "es", { es: sampleFullRow.slug });

describe("datos estructurados para Google News y las IA", () => {
  it("la ficha del medio declara políticas, idiomas y logo con medidas", () => {
    const org = organizationJsonLd(BASE, "losupe", "Noticias", "es", {
      email: "hola@losupe.com",
      sameAs: ["https://t.me/losupe"],
    });
    expect(org["@type"]).toBe("NewsMediaOrganization");
    expect(org["@id"]).toBe(`${BASE}#organizacion`);
    expect(org.publishingPrinciples).toContain("/es/politica-editorial");
    expect(org.correctionsPolicy).toContain("/es/politica-editorial");
    expect(org.logo).toMatchObject({ width: 512, height: 512 });
    expect(org.knowsLanguage).toEqual(["es", "en"]);
    expect(org.email).toBe("hola@losupe.com");
    expect(org.sameAs).toEqual(["https://t.me/losupe"]);
    // Sin redes ni correo, esas claves no salen vacías
    const min = organizationJsonLd(BASE, "losupe", "Noticias");
    expect("sameAs" in min).toBe(false);
    expect("email" in min).toBe(false);
  });

  it("la nota lleva autor, editor enlazado, palabras, fuentes citadas y speakable", () => {
    const ld = articleJsonLd(BASE, "es", article, "losupe");
    expect(["NewsArticle", "Article"]).toContain(ld["@type"]);
    expect(ld.wordCount).toBeGreaterThan(0);
    expect(ld.publisher["@id"]).toBe(`${BASE}#organizacion`);
    expect(ld.author.url).toContain("/es/autor/");
    expect(ld.speakable.cssSelector).toContain("h1");
    expect(ld.citation?.[0]).toMatchObject({ "@type": "CreativeWork" });
    expect(ld.url).toContain("https://losupe.com/es/");
  });

  it("los titulares largos se recortan a 110 caracteres (límite de Google)", () => {
    const largo = { ...article, title: "T".repeat(200) };
    const ld = articleJsonLd(BASE, "es", largo, "losupe");
    expect(ld.headline.length).toBeLessThanOrEqual(110);
    expect(ld.headline.endsWith("…")).toBe(true);
  });

  it("la portada declara la lista ordenada de notas", () => {
    const ld = itemListJsonLd(
      BASE,
      "es",
      "Portada",
      [
        { title: "Uno", sectionId: "cripto", slug: "uno" },
        { title: "Dos", sectionId: "economia", slug: "dos" },
      ],
      "/es",
    );
    expect(ld["@type"]).toBe("CollectionPage");
    expect(ld.mainEntity.numberOfItems).toBe(2);
    expect(ld.mainEntity.itemListElement[0]).toMatchObject({ position: 1, name: "Uno" });
    expect(ld.mainEntity.itemListElement[0]?.url).toBe("https://losupe.com/es/cripto/uno");
  });

  it("el perfil del autor dice para quién trabaja y de qué sabe", () => {
    const ld = personJsonLd(
      BASE,
      "es",
      {
        id: "andreea-blidar",
        name: "Andreea Blidar",
        kind: "person",
        bio: "Editora",
        role: "Editora",
        avatarUrl: null,
      },
      "losupe",
    );
    expect(ld.mainEntity["@type"]).toBe("Person");
    expect(ld.mainEntity.worksFor["@id"]).toBe(`${BASE}#organizacion`);
    expect(ld.mainEntity.knowsAbout).toContain("inteligencia artificial");
  });
});

describe("firmas incrustadas en el cuerpo", () => {
  it("se quitan al leer la nota, así también quedan limpias las ya publicadas", async () => {
    const { isBylineParagraph, stripInlineBylines } = await import("@/lib/html");
    expect(isBylineParagraph("Por Magaly Molina")).toBe(true);
    expect(isBylineParagraph("By Andreea Blidar")).toBe(true);
    expect(isBylineParagraph("Por  Pedro Llerena .")).toBe(true);
    // Frases normales que empiezan por «Por» no se tocan
    expect(isBylineParagraph("Por eso el mercado subió con fuerza esta semana")).toBe(false);
    expect(isBylineParagraph("Por ahora")).toBe(false);
    expect(isBylineParagraph("Texto cualquiera")).toBe(false);

    expect(stripInlineBylines("<p>Cuerpo.</p><p>Por Magaly Molina</p>")).toBe("<p>Cuerpo.</p>");
    expect(stripInlineBylines("<p>Cuerpo.</p>")).toBe("<p>Cuerpo.</p>");
    expect(
      stripInlineBylines("<p>Por eso el mercado subió con fuerza durante la semana.</p>"),
    ).toBe("<p>Por eso el mercado subió con fuerza durante la semana.</p>");
  });

  it("la nota que llega del lector ya viene sin la firma incrustada", async () => {
    const { mapFull } = await import("@/lib/queries");
    const { sampleFullRow } = await import("./fake-d1");
    const conFirma = {
      ...sampleFullRow,
      content_html: "<p>Cuerpo de la nota.</p>\n<p>Por Magaly Molina</p>",
    };
    const nota = mapFull(conFirma, "es", { es: conFirma.slug });
    expect(nota.contentHtml).toBe("<p>Cuerpo de la nota.</p>\n");
    expect(nota.contentHtml).not.toMatch(/Magaly/);
  });
});

describe("enlaces internos", () => {
  it("parte el cuerpo tras el segundo párrafo, y no parte notas cortas", () => {
    const html = "<p>Uno.</p><p>Dos.</p><h2>T</h2><p>Tres.</p><p>Cuatro.</p>";
    const { before, after } = splitAfterParagraph(html, 2);
    expect(before).toBe("<p>Uno.</p><p>Dos.</p>");
    expect(after).toContain("<h2>T</h2>");
    const corta = splitAfterParagraph("<p>Uno.</p><p>Dos.</p>", 2);
    expect(corta.after).toBe("");
    expect(corta.before).toBe("<p>Uno.</p><p>Dos.</p>");
  });

  it("el redactor recibe las rutas de nuestras notas y las conserva sin nofollow", () => {
    const bloque = internalLinksBlock([{ title: "Bitcoin sube", path: "/es/cripto/bitcoin-sube" }]);
    expect(bloque).toContain("/es/cripto/bitcoin-sube");
    expect(bloque).toContain("sin dominio");
    expect(internalLinksBlock([])).toBe("");
    // Un enlace interno se queda en el sitio; uno externo lleva nofollow y pestaña nueva
    const limpio = cleanEditorialHtml(
      '<p>Ver <a href="/es/cripto/bitcoin-sube">esta nota</a> y <a href="https://reuters.com/x">Reuters</a>.</p>',
    );
    expect(limpio).toContain('<a href="/es/cripto/bitcoin-sube">');
    expect(limpio).not.toContain('href="/es/cripto/bitcoin-sube" target');
    expect(limpio).toContain('href="https://reuters.com/x" target="_blank"');
    expect(limpio).toContain("nofollow");
  });
});
