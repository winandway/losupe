import { describe, expect, it } from "vitest";
import {
  countPublished,
  getArticleBySlug,
  getAuthor,
  listForSitemap,
  listLatest,
  listLatestPerSection,
  listPaged,
  listRecentForNews,
  listRelated,
  mapAuthor,
  mapCard,
  parseJsonArray,
  searchArticles,
} from "@/lib/queries";
import { FakeD1, sampleCardRow, sampleFullRow } from "./fake-d1";

describe("mapeo de filas", () => {
  it("mapCard convierte la fila y usa alt del idioma pedido con respaldo", () => {
    const card = mapCard({ ...sampleCardRow, image_alt_en: "Bitcoin EN" }, "en");
    expect(card.imageAlt).toBe("Bitcoin EN");
    expect(mapCard(sampleCardRow, "en").imageAlt).toBe("Bitcoin");
    expect(mapCard({ ...sampleCardRow, image_alt_es: null }, "es").imageAlt).toBe("Bitcoin sube");
    expect(mapCard({ ...sampleCardRow, fallback: 1, ai_assisted: 1 }, "en")).toMatchObject({
      fallback: true,
      aiAssisted: true,
      sectionId: "cripto",
    });
    expect(mapCard({ ...sampleCardRow, section_id: "inexistente" }, "es").sectionId).toBe(
      "economia",
    );
  });
  it("parseJsonArray tolera basura", () => {
    expect(parseJsonArray('["a"]')).toEqual(["a"]);
    expect(parseJsonArray("{no}")).toEqual([]);
    expect(parseJsonArray(null)).toEqual([]);
    expect(parseJsonArray('{"a":1}')).toEqual([]);
  });
  it("mapAuthor elige bio y rol por idioma", () => {
    const row = {
      id: "x",
      name: "X",
      kind: "newsroom",
      bio_es: "es",
      bio_en: null,
      role_es: "r",
      role_en: "role",
      avatar_url: null,
    };
    expect(mapAuthor(row, "en")).toMatchObject({ kind: "newsroom", bio: "es", role: "role" });
  });
});

describe("consultas", () => {
  it("listLatest filtra por sección y mapea", async () => {
    const db = new FakeD1(() => [sampleCardRow]);
    const items = await listLatest(db.asD1(), "es", { limit: 5, sectionId: "cripto" });
    expect(items).toHaveLength(1);
    expect(items[0]?.slug).toBe("bitcoin-sube");
    expect(db.calls[0]?.sql).toContain("a.section_id = ?3");
    expect(db.calls[0]?.sql).toContain("LIMIT ?4 OFFSET ?5");
    expect(db.calls[0]?.params).toEqual(["es", expect.any(String), "cripto", 5, 0]);
  });
  it("sin filtros, con autor y con ambos filtros enlaza exactamente lo que usa", async () => {
    const db = new FakeD1((sql) => (sql.includes("COUNT(*)") ? [{ n: 1 }] : [sampleCardRow]));
    await listLatest(db.asD1(), "en");
    await listLatest(db.asD1(), "en", { authorId: "kevin-rondon" });
    await listLatest(db.asD1(), "en", {
      sectionId: "cripto",
      authorId: "kevin-rondon",
      limit: 3,
      offset: 6,
    });
    await countPublished(db.asD1());
    await countPublished(db.asD1(), { sectionId: "cripto" });
    await countPublished(db.asD1(), { sectionId: "cripto", authorId: "kevin-rondon" });
    expect(db.calls).toHaveLength(6);
    expect(db.calls[2]?.params).toEqual(["en", expect.any(String), "cripto", "kevin-rondon", 3, 6]);
    expect(db.calls[5]?.sql).toContain("a.author_id = ?3");
  });
  it("countPublished y listPaged calculan páginas", async () => {
    const db = new FakeD1((sql) => (sql.includes("COUNT(*)") ? [{ n: 25 }] : [sampleCardRow]));
    expect(await countPublished(db.asD1(), { authorId: "kevin-rondon" })).toBe(25);
    const paged = await listPaged(db.asD1(), "en", 2, { sectionId: "cripto" });
    expect(paged.pages).toBe(3);
    expect(paged.page).toBe(2);
    expect(paged.items).toHaveLength(1);
  });
  it("listLatestPerSection agrupa por sección", async () => {
    const db = new FakeD1(() => [
      { ...sampleCardRow, rn: 1 },
      { ...sampleCardRow, id: "a2", section_id: "economia", rn: 1 },
    ]);
    const grouped = await listLatestPerSection(db.asD1(), "es", 3);
    expect(grouped.cripto).toHaveLength(1);
    expect(grouped.economia).toHaveLength(1);
    expect(grouped.ventas).toHaveLength(0);
  });
  it("getArticleBySlug resuelve el slug en cualquier idioma y trae traducciones", async () => {
    const db = new FakeD1((sql) => {
      if (sql.includes("FROM article_i18n WHERE slug")) return [{ article_id: "a1", lang: "es" }];
      if (sql.includes("SELECT lang, slug FROM article_i18n")) {
        return [
          { lang: "es", slug: "bitcoin-sube" },
          { lang: "en", slug: "bitcoin-rises" },
        ];
      }
      return [sampleFullRow];
    });
    const article = await getArticleBySlug(db.asD1(), "en", "bitcoin-sube");
    expect(article?.translations).toEqual({ es: "bitcoin-sube", en: "bitcoin-rises" });
    expect(article?.sources[0]?.url).toBe("https://example.com/f");
    expect(article?.tags).toEqual(["bitcoin", "mercado"]);
    expect(await getArticleBySlug(new FakeD1().asD1(), "es", "nada")).toBeNull();
  });
  it("listRelated, searchArticles, getAuthor, sitemaps", async () => {
    const db = new FakeD1((sql) => {
      if (sql.includes("FROM authors")) {
        return [
          {
            id: "kevin-rondon",
            name: "Kevin",
            kind: "person",
            bio_es: "b",
            bio_en: null,
            role_es: null,
            role_en: null,
            avatar_url: null,
          },
        ];
      }
      if (sql.includes("t.title, a.published_at")) return [{ ...sampleCardRow, title: "A" }];
      return [sampleCardRow];
    });
    expect(await listRelated(db.asD1(), "es", "cripto", "otro", 2)).toHaveLength(1);
    const found = await searchArticles(db.asD1(), "es", "bit%coin");
    expect(found).toHaveLength(1);
    expect(db.calls.at(-1)?.params[2]).toBe("%bit coin%");
    expect((await getAuthor(db.asD1(), "kevin-rondon", "en"))?.bio).toBe("b");
    expect(await listForSitemap(db.asD1())).toHaveLength(1);
    expect(await listRecentForNews(db.asD1(), "2025-01-01T00:00:00.000Z")).toHaveLength(1);
  });
});
