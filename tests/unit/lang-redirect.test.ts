import { describe, expect, it } from "vitest";
import { langRedirectTarget } from "@/lib/lang-redirect";

const u = (path: string) => new URL(`https://losupe.com${path}`);

describe("redirección de idioma en el worker", () => {
  it("la raíz va al idioma del navegador", () => {
    expect(langRedirectTarget(u("/"), "en-US,en;q=0.9")).toBe("/en");
    expect(langRedirectTarget(u("/"), "es-CO")).toBe("/es");
    expect(langRedirectTarget(u("/"), null)).toBe("/es");
    expect(langRedirectTarget(u("/?ref=x"), null)).toBe("/es?ref=x");
  });
  it("rutas con idioma no se tocan", () => {
    expect(langRedirectTarget(u("/es"), null)).toBeNull();
    expect(langRedirectTarget(u("/en/crypto/nota"), null)).toBeNull();
  });
  it("archivos y rutas especiales no se tocan", () => {
    for (const p of [
      "/robots.txt",
      "/sitemap.xml",
      "/news-sitemap.xml",
      "/favicon.ico",
      "/icon.png",
      "/opengraph-image.png",
      "/_next/static/x.js",
      "/img/legacy/a.webp",
      "/brand/logo-512.png",
      "/__scheduled",
      "/__health",
      "/noticia/viejo-slug",
      "/archivo.pdf",
    ]) {
      expect(langRedirectTarget(u(p), "en"), p).toBeNull();
    }
  });
  it("cualquier otra ruta sin idioma recibe el prefijo", () => {
    expect(langRedirectTarget(u("/economia?page=2"), "es")).toBe("/es/economia?page=2");
    expect(langRedirectTarget(u("/about"), "en-GB")).toBe("/en/about");
  });
});
