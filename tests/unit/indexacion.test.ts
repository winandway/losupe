/**
 * Candado 58: que Google guarde las notas.
 *
 * El 7 nov 2026 Search Console contaba 45 redirecciones y 24 copias con `noindex` creadas por el
 * propio sitio: el selector de idioma armaba `/en/economy/<slug-en-español>` y los listados en
 * inglés enlazaban notas sin traducir. Estas pruebas fijan que eso no vuelva.
 */
import { describe, expect, it } from "vitest";
import { applySchema } from "@/lib/schema-guard";
import { SCHEMA_SQL } from "@/lib/schema-sql";
import {
  countPublished,
  listLatest,
  listLatestPerSection,
  listPaged,
  listRelated,
} from "@/lib/queries";
import { destinoOtroIdioma } from "@/lib/urls";
import { SqliteD1 } from "./sqlite-d1";

describe("selector de idioma en una nota", () => {
  it("usa la traducción que declara la página en su hreflang", () => {
    expect(
      destinoOtroIdioma(
        "/es/economia/bolsa-sube",
        "en",
        "https://losupe.com/en/economy/stocks-rise",
      ),
    ).toBe("/en/economy/stocks-rise");
  });

  it("sin traducción va a la sección del otro idioma, nunca a una dirección inventada", () => {
    expect(destinoOtroIdioma("/es/cripto/bitcoin-sube", "en")).toBe("/en/crypto");
    expect(destinoOtroIdioma("/es/cripto/bitcoin-sube", "en", null)).toBe("/en/crypto");
    expect(destinoOtroIdioma("/en/artists/some-story", "es")).toBe("/es/artistas");
  });

  it("ignora una alternativa de otro idioma o rota", () => {
    expect(
      destinoOtroIdioma("/es/cripto/bitcoin-sube", "en", "https://losupe.com/es/cripto/x"),
    ).toBe("/en/crypto");
    expect(destinoOtroIdioma("/es/cripto/bitcoin-sube", "en", "http://[::")).toBe("/en/crypto");
  });

  it("fuera de las notas cambia la ruta como siempre", () => {
    expect(destinoOtroIdioma("/es", "en")).toBe("/en");
    expect(destinoOtroIdioma("/es/economia", "en")).toBe("/en/economy");
    expect(destinoOtroIdioma("/es/autor/kevin", "en")).toBe("/en/author/kevin");
    expect(destinoOtroIdioma("/es/acerca", "en")).toBe("/en/about");
  });
});

async function baseConDosNotas() {
  const db = new SqliteD1();
  const d1 = db.asD1();
  await applySchema(d1, SCHEMA_SQL);
  db.exec(`
    INSERT OR IGNORE INTO authors (id, name) VALUES ('redaccion', 'Redacción');
    INSERT INTO articles (id, section_id, author_id, status, published_at)
      VALUES ('a1', 'cripto', 'redaccion', 'published', '2026-11-01T10:00:00.000Z'),
             ('a2', 'cripto', 'redaccion', 'published', '2026-11-02T10:00:00.000Z');
    INSERT INTO article_i18n (article_id, lang, slug, title, content_html) VALUES
      ('a1', 'es', 'solo-en-espanol', 'Solo en español', '<p>x</p>'),
      ('a2', 'es', 'traducida', 'Traducida', '<p>x</p>'),
      ('a2', 'en', 'translated', 'Translated', '<p>x</p>');
  `);
  return d1;
}

describe("listados: solo notas que existen en el idioma pedido", () => {
  it("en inglés no aparece la copia en español de una nota sin traducir", async () => {
    const d1 = await baseConDosNotas();
    const en = await listLatest(d1, "en", { sectionId: "cripto" });
    expect(en.map((n) => n.slug)).toEqual(["translated"]);
    expect(en.every((n) => !n.fallback)).toBe(true);
    const es = await listLatest(d1, "es", { sectionId: "cripto" });
    expect(es.map((n) => n.slug)).toEqual(["traducida", "solo-en-espanol"]);
  });

  it("la portada por secciones y las relacionadas siguen la misma regla", async () => {
    const d1 = await baseConDosNotas();
    const porSeccion = await listLatestPerSection(d1, "en", 6);
    expect(porSeccion.cripto.map((n) => n.slug)).toEqual(["translated"]);
    const rel = await listRelated(d1, "en", "cripto", "otra", 4);
    expect(rel.map((n) => n.slug)).toEqual(["translated"]);
  });

  it("el conteo en inglés no anuncia páginas llenas de notas en español", async () => {
    const d1 = await baseConDosNotas();
    expect(await countPublished(d1, { sectionId: "cripto" }, "en")).toBe(1);
    expect(await countPublished(d1, { sectionId: "cripto" })).toBe(2);
    const paginado = await listPaged(d1, "en", 1, { sectionId: "cripto" }, 1);
    expect(paginado.pages).toBe(1);
  });
});
