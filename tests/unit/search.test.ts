import { describe, expect, it } from "vitest";
import { normalizeTerm, synonymsFor, SYNONYM_GROUPS } from "@/lib/search-synonyms";
import {
  buildFtsMatch,
  createSearchIndexGuard,
  expandQuery,
  ftsSearchIds,
  indexArticle,
  likeSearch,
  listByIds,
  normalizeQuery,
  rebuildSearchIndex,
  searchSmart,
  suggest,
} from "@/lib/search";
import { FakeD1, sampleCardRow } from "./fake-d1";

class FakeD1WithBatch extends FakeD1 {
  batched = 0;
  async batch(stmts: unknown[]) {
    this.batched += stmts.length;
    return stmts.map(() => ({ success: true, results: [], meta: {} }));
  }
}

describe("sinónimos y normalización", () => {
  it("quita acentos y signos", () => {
    expect(normalizeTerm("  Dólar, ¡Bitcoin!  ")).toBe("dolar bitcoin");
    expect(normalizeQuery("Inteligencia   Artificial")).toBe("inteligencia artificial");
  });
  it("devuelve el grupo completo", () => {
    expect(synonymsFor("BTC")).toEqual(["btc", "bitcoin"]);
    expect(synonymsFor("dólar")).toContain("usd");
    expect(synonymsFor("palabrarara")).toEqual(["palabrarara"]);
  });
  it("los grupos no tienen términos vacíos ni con mayúsculas", () => {
    for (const g of SYNONYM_GROUPS) for (const t of g) expect(t).toBe(normalizeTerm(t));
  });
});

describe("expansión y consulta FTS", () => {
  it("expande tokens y frases del diccionario", () => {
    expect(expandQuery("btc dolar")).toEqual([
      ["btc", "bitcoin"],
      ["dolar", "dolares", "usd", "dollar", "dollars"],
    ]);
    expect(expandQuery("inteligencia artificial")[0]).toContain("ai");
    expect(expandQuery("")).toEqual([]);
  });
  it("arma el MATCH con OR por grupo, AND entre grupos y prefijo en el último", () => {
    expect(buildFtsMatch("btc")).toBe('("btc"* OR "bitcoin"*)');
    expect(buildFtsMatch("mercatren venez")).toBe(
      '("mercatren" OR "pedro llerena") AND ("venez"*)'.replace('("venez"*)', '"venez"*'),
    );
    expect(buildFtsMatch("tienda", true)).toContain('"e-commerce"*');
    expect(buildFtsMatch('"hola')).toBe('"hola"*');
    expect(buildFtsMatch("   ")).toBe("");
  });
});

describe("búsqueda", () => {
  const db = () =>
    new FakeD1WithBatch((sql, params) => {
      if (sql.includes("MATCH")) {
        expect(String(params[0])).toContain("*");
        return [
          { article_id: "a1", score: -3 },
          { article_id: "a1", score: -2 },
          { article_id: "a2", score: -1 },
        ];
      }
      if (sql.includes("a.id IN (")) {
        const ids = params.slice(2) as string[];
        return ids.map((id) => ({ ...sampleCardRow, id, title: `Nota ${id}` }));
      }
      if (
        sql.includes("FROM article_i18n i JOIN articles") ||
        sql.includes("FROM article_i18n WHERE article_id")
      ) {
        return [
          {
            article_id: "a1",
            lang: "es",
            title: "T",
            excerpt: "E",
            tags_json: '["x"]',
            content_html: "<p>Hola <b>mundo</b></p>",
          },
          {
            article_id: "a1",
            lang: "en",
            title: "T",
            excerpt: "E",
            tags_json: null,
            content_html: "<p>Hello</p>",
          },
        ];
      }
      if (sql.includes("COUNT(*)")) return [{ n: 0 }];
      return [sampleCardRow];
    });

  it("ftsSearchIds quita repetidos y respeta el límite", async () => {
    expect(await ftsSearchIds(db().asD1(), "es", '"a"*', 1)).toEqual(["a1"]);
    expect(await ftsSearchIds(db().asD1(), "es", '"a"*', 5)).toEqual(["a1", "a2"]);
  });
  it("listByIds conserva el orden pedido", async () => {
    const cards = await listByIds(db().asD1(), "es", ["a2", "a1"]);
    expect(cards.map((c) => c.id)).toEqual(["a2", "a1"]);
    expect(await listByIds(db().asD1(), "es", [])).toEqual([]);
  });
  it("searchSmart y suggest usan el índice; con consulta vacía devuelven nada", async () => {
    const r = await searchSmart(db().asD1(), "es", "btc", { limit: 5 });
    expect(r.map((c) => c.id)).toEqual(["a1", "a2"]);
    expect(await suggest(db().asD1(), "en", "bit")).toHaveLength(2);
    expect(await searchSmart(db().asD1(), "es", "  ")).toEqual([]);
  });
  it("si el índice falla, cae a LIKE con sinónimos", async () => {
    const fallback = new FakeD1((sql) => {
      if (sql.includes("MATCH")) throw new Error("no such table: articles_fts");
      return [sampleCardRow];
    });
    const r = await searchSmart(fallback.asD1(), "es", "btc");
    expect(r).toHaveLength(1);
    const likeCall = fallback.calls.find((c) => c.sql.includes("LIKE"));
    expect(likeCall?.params).toContain("%bitcoin%");
    expect(await likeSearch(fallback.asD1(), "es", "", 5)).toEqual([]);
  });
  it("rebuildSearchIndex e indexArticle limpian HTML y escriben en lotes", async () => {
    const d = db();
    expect(await rebuildSearchIndex(d.asD1())).toBe(2);
    expect(d.batched).toBe(2);
    const del = d.calls.find((c) => c.sql.startsWith("DELETE FROM articles_fts"));
    expect(del).toBeDefined();
    const d2 = db();
    await indexArticle(d2.asD1(), "a1");
    expect(d2.batched).toBe(2);
  });
  it("el guardián reconstruye una sola vez si el índice está vacío", async () => {
    const d = db();
    const guard = createSearchIndexGuard();
    await Promise.all([guard.ensure(d.asD1()), guard.ensure(d.asD1())]);
    await guard.ensure(d.asD1());
    expect(d.calls.filter((c) => c.sql.includes("COUNT(*)"))).toHaveLength(1);
    expect(d.batched).toBe(2);
    const broken = {
      prepare: () => {
        throw new Error("sin fts");
      },
    } as unknown as D1Database;
    await expect(createSearchIndexGuard().ensure(broken)).resolves.toBeUndefined();
  });
});
