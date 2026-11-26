import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applySchema } from "@/lib/schema-guard";
import { SCHEMA_SQL } from "@/lib/schema-sql";
import {
  NEWS_SECTIONS,
  retiredSectionRedirect,
  RETIRED_SECTION_ID,
  SECTIONS,
  sectionByAnySlug,
} from "@/lib/sections";
import { articleJsonLd } from "@/lib/seo";
import { SqliteD1 } from "./sqlite-d1";

/**
 * Candado 66 — el medio no se delata (Richard, 26 nov 2026).
 *
 * «Si pasaras la página a Google Noticias y Google viera que tenemos ese poco de empresas…
 * nadie nos está preguntando nada. ¿Por qué tenemos que poner algo que nadie nos está
 * preguntando?». Fuera la sección «Desde Windoce», la lista de productos de la política
 * editorial, el crédito del pie y el «patrocinador» en los datos para buscadores.
 * Y sin romper nada: lo que Google ya vio redirige, no se queda en 404.
 */
describe("la sección de la casa no vuelve", () => {
  it("no está en el menú ni en las secciones de noticias", () => {
    expect(SECTIONS.map((s) => s.id)).not.toContain(RETIRED_SECTION_ID);
    expect(NEWS_SECTIONS).toEqual(SECTIONS);
    expect(sectionByAnySlug("desde-windoce")).toBeUndefined();
    expect(sectionByAnySlug("from-windoce")).toBeUndefined();
  });

  it("sus direcciones viejas redirigen a la portada del idioma, con o sin nota detrás", () => {
    expect(retiredSectionRedirect("/es/desde-windoce")).toBe("/es");
    expect(retiredSectionRedirect("/es/desde-windoce/")).toBe("/es");
    expect(retiredSectionRedirect("/es/desde-windoce/una-nota-vieja")).toBe("/es");
    expect(retiredSectionRedirect("/en/from-windoce")).toBe("/en");
    expect(retiredSectionRedirect("/en/from-windoce/an-old-story")).toBe("/en");
    // Y no se lleva por delante nada vivo.
    expect(retiredSectionRedirect("/es/delivery")).toBeNull();
    expect(retiredSectionRedirect("/es/delivery/una-nota")).toBeNull();
    expect(retiredSectionRedirect("/en/desde-windoce")).toBeNull();
    expect(retiredSectionRedirect("/")).toBeNull();
  });

  it("el worker aplica la redirección con 301", () => {
    const worker = readFileSync("worker.ts", "utf8");
    expect(worker).toMatch(
      /legacyRedirectTarget\(pathname\) \?\? retiredSectionRedirect\(pathname\)/,
    );
  });

  it("las notas de la sección quedan archivadas en la base, sin borrar", async () => {
    const db = new SqliteD1();
    const d1 = db.asD1();
    await applySchema(d1, SCHEMA_SQL);
    db.raw.exec(
      `INSERT INTO articles (id, section_id, author_id, status) VALUES ('casa-1', 'windoce', 'pedro-llerena', 'published')`,
    );
    // Se vuelve a aplicar el esquema, como en cada publicación.
    await applySchema(d1, SCHEMA_SQL);
    const fila = db.raw.prepare(`SELECT status FROM articles WHERE id = 'casa-1'`).get() as {
      status: string;
    };
    expect(fila.status).toBe("archived");
    const sec = db.raw.prepare(`SELECT active FROM sections WHERE id = 'windoce'`).get() as
      { active: number } | undefined;
    if (sec) expect(sec.active).toBe(0);
  });
});

describe("nada nombra al grupo dueño", () => {
  it("los datos para buscadores no llevan patrocinador ni contenido de anunciante", () => {
    const ld = articleJsonLd(
      "https://losupe.com",
      "es",
      {
        id: "x",
        sectionId: "delivery",
        slug: "una-nota",
        title: "Una nota",
        excerpt: "Resumen",
        metaDescription: null,
        imageUrl: null,
        publishedAt: "2026-11-26T10:00:00Z",
        updatedAt: "2026-11-26T10:00:00Z",
        lang: "es",
        tags: [],
        contentHtml: "<p>Texto</p>",
        readingMinutes: 1,
        authorName: "Pedro Llerena",
        authorId: "pedro-llerena",
        kind: "news",
        sources: [],
      } as never,
      "Losupe",
    ) as Record<string, unknown>;
    expect(ld["@type"]).toBe("NewsArticle");
    expect(JSON.stringify(ld)).not.toMatch(/sponsor|Windoce|AdvertiserContent/);
  });

  it("el pie no enlaza a windoce.com", () => {
    const pie = readFileSync("src/components/Footer.tsx", "utf8").replace(
      /\{\/\*[\s\S]*?\*\/\}/g,
      "",
    );
    expect(pie).not.toMatch(/windoce\.com|Windoce LLC/);
  });
});

describe("las notas sembradas tampoco se delatan", () => {
  it("ninguna nota de periodismo trae un recuadro de propiedad", async () => {
    const { readdirSync } = await import("node:fs");
    const archivos = readdirSync("seed/content").filter(
      (f) => f.endsWith(".mjs") && !f.includes("-casa-"),
    );
    expect(archivos.length).toBeGreaterThan(3);
    for (const f of archivos) {
      const nota = (await import(`../../seed/content/${f}`)).default as {
        i18n: Record<string, { content_html: string }>;
      };
      for (const [lang, t] of Object.entries(nota.i18n)) {
        expect(t.content_html, `${f} (${lang})`).not.toMatch(
          /Windoce|mismo grupo|same business group|Aviso de transparencia|Disclosure:|aviso-casa/,
        );
      }
    }
  });

  it("la nota de Venezuela va en delivery, firmada, y cuenta las motos como plan", async () => {
    const nota = (await import("../../seed/content/2026-11-26-divoox-venezuela.mjs")).default;
    expect(nota.article.section_id).toBe("delivery");
    expect(nota.article.author_id).toBe("pedro-llerena");
    const es = nota.i18n.es.content_html as string;
    for (const c of [
      "El Vigía",
      "Tucaní",
      "Santa Bárbara del Zulia",
      "Barquisimeto",
      "Valera",
      "Valencia",
      "Caracas",
    ])
      expect(es).toContain(c);
    expect(es).toMatch(/Según la empresa/);
    expect(es).toMatch(/un plan/);
    // Sin cifras inventadas de repartidores, pedidos ni restaurantes.
    expect(es).not.toMatch(/\d[\d.,]*\s*(repartidores|pedidos|restaurantes|comercios)/);
  });
});
