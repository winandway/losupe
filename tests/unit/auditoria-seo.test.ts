import { describe, expect, it } from "vitest";
import { DOMINIO_CANONICO, origenCanonico, redireccionCanonica } from "@/lib/dominio";
import { baseUrlFromHeaders } from "@/lib/site";
import { buildLinkHeader, unirLink } from "@/lib/agent-discovery";
import { conPagina, descripcionMeta, imagenOg, ROBOTS_INDEXABLE, tarjetaSocial } from "@/lib/seo";
import { rutaConPalabraDelIdioma } from "@/lib/urls";

/**
 * Candado 53 — auditoría SEO del 17 sep 2026. Cada bloque fija un error que estaba en producción.
 * Detalle en docs/candados.md.
 */

const visita = (url: string, headers: Record<string, string> = {}) =>
  redireccionCanonica(new URL(url), new Headers(headers));

describe("un solo dominio: https://losupe.com", () => {
  it("www y http redirigen a https://losupe.com conservando ruta y parámetros", () => {
    expect(visita("https://www.losupe.com/es/cripto?page=2")).toBe(
      "https://losupe.com/es/cripto?page=2",
    );
    expect(visita("http://losupe.com/en")).toBe("https://losupe.com/en");
    // Detrás de un proxy la dirección llega como https pero la visita fue por http.
    expect(visita("https://losupe.com/es", { "x-forwarded-proto": "http" })).toBe(
      "https://losupe.com/es",
    );
    expect(visita("https://losupe.com/es", { "cf-visitor": '{"scheme":"http"}' })).toBe(
      "https://losupe.com/es",
    );
  });

  it("la dirección buena NO se redirige (si no, bucle infinito)", () => {
    expect(visita("https://losupe.com/es")).toBeNull();
    expect(visita("https://losupe.com/es", { "x-forwarded-proto": "https" })).toBeNull();
  });

  it("nunca redirige el reloj ni los chequeos, ni toca localhost o la plataforma", () => {
    expect(visita("http://www.losupe.com/__scheduled")).toBeNull();
    expect(visita("http://localhost:8797/es")).toBeNull();
    expect(visita("https://losupe.sitios.dev/es")).toBeNull();
  });

  it("toda dirección que el sitio escribe de sí mismo usa el dominio canónico", () => {
    for (const host of ["losupe.com", "www.losupe.com", "losupe.sitios.dev", "WWW.LOSUPE.COM"]) {
      expect(origenCanonico(host, "http")).toBe(DOMINIO_CANONICO);
    }
    const h = new Headers({ host: "losupe.sitios.dev", "x-forwarded-proto": "https" });
    expect(baseUrlFromHeaders(h)).toBe("https://losupe.com");
    // En desarrollo y pruebas se respeta la dirección local, o nada funcionaría.
    expect(origenCanonico("localhost:8797", "http")).toBe("http://localhost:8797");
  });
});

describe("etiquetas para buscadores", () => {
  it("toda página indexable pide la imagen grande (Google Discover la exige)", () => {
    expect(ROBOTS_INDEXABLE).toMatchObject({
      index: true,
      follow: true,
      "max-image-preview": "large",
    });
  });

  it("las páginas sin foto propia comparten una imagen de 1200×630", () => {
    expect(imagenOg()).toEqual({ url: "/brand/og.png", width: 1200, height: 630 });
    expect(imagenOg("cripto").url).toBe("/og/cripto.png");
  });

  it("la página 2 de un listado es su propia canónica, la 1 va sin parámetro", () => {
    expect(conPagina("/es/cripto", 1)).toBe("/es/cripto");
    expect(conPagina("/es/cripto", 3)).toBe("/es/cripto?page=3");
  });

  it("la descripción nunca pasa de 158 caracteres y corta por frases o palabras", () => {
    const larga =
      "losupe es un diario digital bilingüe que explica la actualidad con fuentes nombradas. " +
      "Cada nota lleva la firma de una persona y la política editorial está publicada. " +
      "Además hay un robot que ayuda a redactar y un equipo que revisa lo que sale.";
    const d = descripcionMeta(larga)!;
    expect(d.length).toBeLessThanOrEqual(158);
    expect(d.endsWith(".")).toBe(true);
    const sinPuntos = "palabra ".repeat(60);
    const e = descripcionMeta(sinPuntos)!;
    expect(e.length).toBeLessThanOrEqual(158);
    expect(e.endsWith("palabra…")).toBe(true);
    expect(descripcionMeta("  Corta.  ")).toBe("Corta.");
    expect(descripcionMeta(null)).toBeUndefined();
  });
});

describe("al compartir, cada página es ella misma", () => {
  it("la tarjeta lleva la dirección, el título y la imagen de ESA página, completa", () => {
    const t = tarjetaSocial(
      { brand: { name: "losupe" }, ogLocale: "es_US" },
      { path: "/es/acerca", title: "Acerca de losupe", description: "Quiénes somos." },
    );
    expect(t.openGraph).toMatchObject({
      url: "/es/acerca",
      title: "Acerca de losupe",
      siteName: "losupe",
      locale: "es_US",
    });
    // Completa: si faltara la imagen, la página se compartiría sin foto (Next no hereda la del layout).
    expect(t.openGraph.images[0]).toMatchObject({ url: "/brand/og.png", width: 1200, height: 630 });
    expect(t.twitter).toMatchObject({ card: "summary_large_image", images: ["/brand/og.png"] });
  });
});

describe("la cabecera Link no pisa lo que pide React primero", () => {
  it("conserva la precarga de la foto principal y suma nuestros enlaces", () => {
    const deReact = '</video/hero-v2-poster.jpg>; rel=preload; as="image"; fetchpriority="high"';
    const nuestra = buildLinkHeader("https://losupe.com", "/es", "es");
    const unida = unirLink(deReact, nuestra);
    expect(unida.startsWith(deReact)).toBe(true);
    expect(unida).toContain('rel="llms-txt"');
    expect(unirLink(null, nuestra)).toBe(nuestra);
    expect(unirLink("  ", nuestra)).toBe(nuestra);
  });
});

describe("una sola dirección por página: la palabra de la ruta va en su idioma", () => {
  it("la palabra del otro idioma se corrige", () => {
    expect(rutaConPalabraDelIdioma("/es/about")).toBe("/es/acerca");
    expect(rutaConPalabraDelIdioma("/en/autor/magaly")).toBe("/en/author/magaly");
    expect(rutaConPalabraDelIdioma("/en/buscar")).toBe("/en/search");
  });

  it("las rutas correctas, las secciones y las notas no se tocan", () => {
    expect(rutaConPalabraDelIdioma("/es/acerca")).toBeNull();
    expect(rutaConPalabraDelIdioma("/en/author/magaly")).toBeNull();
    expect(rutaConPalabraDelIdioma("/es/cripto/una-nota")).toBeNull();
    expect(rutaConPalabraDelIdioma("/es")).toBeNull();
    expect(rutaConPalabraDelIdioma("/panel")).toBeNull();
  });
});
