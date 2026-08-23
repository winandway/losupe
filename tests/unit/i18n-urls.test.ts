import { describe, expect, it } from "vitest";
import { getDict, isLang, otherLang, pickLangFromAcceptLanguage, toLang } from "@/i18n";
import { es } from "@/i18n/es";
import { en } from "@/i18n/en";
import {
  SECTIONS,
  getSection,
  sectionByAnySlug,
  sectionBySlug,
  sectionSlug,
  isSectionId,
} from "@/lib/sections";
import {
  aboutPath,
  absoluteUrl,
  articlePath,
  authorPath,
  homePath,
  rssPath,
  searchPath,
  sectionPath,
  swapLangPath,
} from "@/lib/urls";
import {
  articleJsonLd,
  breadcrumbJsonLd,
  safeJsonLd,
  sectionAlternates,
  websiteJsonLd,
} from "@/lib/seo";
import { mapFull } from "@/lib/queries";
import { sampleFullRow } from "./fake-d1";

function keysOf(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? keysOf(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe("i18n", () => {
  it("español e inglés tienen exactamente las mismas claves", () => {
    expect(keysOf(en as unknown as Record<string, unknown>)).toEqual(
      keysOf(es as unknown as Record<string, unknown>),
    );
  });
  it("getDict / toLang / isLang / otherLang", () => {
    expect(getDict("en").nav.home).toBe("Home");
    expect(getDict("es").nav.home).toBe("Portada");
    expect(toLang("fr")).toBe("es");
    expect(isLang("en")).toBe(true);
    expect(isLang(undefined)).toBe(false);
    expect(otherLang("es")).toBe("en");
  });
  it("elige idioma por Accept-Language", () => {
    expect(pickLangFromAcceptLanguage("en-US,en;q=0.9,es;q=0.8")).toBe("en");
    expect(pickLangFromAcceptLanguage("es-CO,es;q=0.9,en;q=0.8")).toBe("es");
    expect(pickLangFromAcceptLanguage("fr-FR,fr;q=0.9")).toBe("es");
    expect(pickLangFromAcceptLanguage(null)).toBe("es");
    expect(pickLangFromAcceptLanguage("es;q=0.5,en;q=0.9")).toBe("en");
  });
  it("las funciones de texto responden en cada idioma", () => {
    expect(es.article.minutes(3)).toBe("3 min de lectura");
    expect(en.article.minutes(3)).toBe("3 min read");
    expect(es.section.count(1)).toBe("1 nota");
    expect(en.section.count(2)).toBe("2 stories");
    expect(en.search.results(1, "btc")).toBe("1 result for “btc”");
    expect(es.search.none("x")).toContain("“x”");
    expect(en.article.shareOn("X")).toBe("Share on X");
  });
});

describe("sections", () => {
  it("resuelve por id y por slug en ambos idiomas", () => {
    expect(SECTIONS).toHaveLength(5);
    expect(getSection("cripto")?.slug.en).toBe("crypto");
    expect(sectionBySlug("en", "economy")?.id).toBe("economia");
    expect(sectionBySlug("es", "economy")).toBeUndefined();
    expect(sectionByAnySlug("sales")).toEqual({ section: getSection("ventas"), lang: "en" });
    expect(sectionByAnySlug("nada")).toBeUndefined();
    expect(sectionSlug("tecnologia", "en")).toBe("technology");
    expect(isSectionId("artistas")).toBe(true);
    expect(isSectionId("otra")).toBe(false);
  });
});

describe("urls", () => {
  it("construye rutas por idioma", () => {
    expect(homePath("en")).toBe("/en");
    expect(sectionPath("en", "cripto")).toBe("/en/crypto");
    expect(articlePath("es", "cripto", "bitcoin sube")).toBe("/es/cripto/bitcoin%20sube");
    expect(authorPath("en", "kevin-rondon")).toBe("/en/author/kevin-rondon");
    expect(searchPath("es", "btc & eth")).toBe("/es/buscar?q=btc%20%26%20eth");
    expect(searchPath("en")).toBe("/en/search");
    expect(aboutPath("en")).toBe("/en/about");
    expect(rssPath("es")).toBe("/es/rss.xml");
    expect(absoluteUrl("https://losupe.com/", "es")).toBe("https://losupe.com/es");
  });
  it("cambia de idioma conservando la ruta", () => {
    expect(swapLangPath("/es", "en")).toBe("/en");
    expect(swapLangPath("/es/economia", "en")).toBe("/en/economy");
    expect(swapLangPath("/en/crypto/bitcoin-sube", "es")).toBe("/es/cripto/bitcoin-sube");
    expect(swapLangPath("/en/author/kevin", "es")).toBe("/es/autor/kevin");
    expect(swapLangPath("/es/buscar", "en")).toBe("/en/search");
    expect(swapLangPath("/es/acerca", "en")).toBe("/en/about");
    expect(swapLangPath("/", "en")).toBe("/en");
    expect(swapLangPath("/foo/bar", "en")).toBe("/en/foo/bar");
    expect(swapLangPath("/es/cosa-rara", "en")).toBe("/en/cosa-rara");
  });
});

describe("seo", () => {
  it("escapa < en JSON-LD", () => {
    expect(safeJsonLd({ a: "<script>" })).toBe('{"a":"\\u003cscript>"}');
  });
  it("arma NewsArticle con autor y editor", () => {
    const article = mapFull(sampleFullRow, "es", { es: "bitcoin-sube" });
    const ld = articleJsonLd("https://losupe.com", "es", article, "losupe") as Record<
      string,
      unknown
    >;
    expect(ld["@type"]).toBe("NewsArticle");
    expect(ld.headline).toBe("Bitcoin sube");
    expect((ld.author as { url: string }).url).toBe("https://losupe.com/es/autor/kevin-rondon");
    expect(ld.keywords).toBe("bitcoin, mercado");
    expect(ld.image).toEqual(["https://losupe.com/img/legacy/x.webp"]);
  });
  it("breadcrumbs, website y alternates", () => {
    const bc = breadcrumbJsonLd("https://losupe.com", "es", [
      { name: "Portada", path: "/es" },
      { name: "Cripto", path: "/es/cripto" },
    ]) as { itemListElement: { position: number; item: string }[] };
    expect(bc.itemListElement[1]?.position).toBe(2);
    expect(bc.itemListElement[1]?.item).toBe("https://losupe.com/es/cripto");
    const ws = websiteJsonLd("https://losupe.com", "en", "losupe", "/en/search") as {
      potentialAction: { target: string };
    };
    expect(ws.potentialAction.target).toContain("/en/search?q=");
    expect(sectionAlternates("cripto")).toEqual({
      es: "/es/cripto",
      en: "/en/crypto",
      "x-default": "/es/cripto",
    });
  });
});
