/**
 * «Desde Windoce» — contenido de la casa (candado 57).
 *
 * Lo que fija esta prueba: una nota de la sección de la casa NO se puede publicar sin su aviso
 * («Contenido de la casa: Losupe y X son de Windoce LLC»), no entra al mapa de Google Noticias,
 * se marca como contenido de anunciante en los datos estructurados y sale una por día como máximo.
 * Se comprobó EN ROJO: quitando el `assertAvisoCasa` de `setArticleStatus`, la prueba
 * «sin aviso no se publica» falla.
 */
import { describe, expect, it, vi } from "vitest";

// El mapa de Google Noticias lee la base con getDb(): aquí se le da la SQLite de la prueba.
const dbDeLaPrueba: { actual: D1Database | null } = { actual: null };
vi.mock("@/lib/db", () => ({ getDb: async () => dbDeLaPrueba.actual }));
import { applySchema, applySeed } from "@/lib/schema-guard";
import { SCHEMA_SQL } from "@/lib/schema-sql";
import { CONTENT_SEEDS } from "@/lib/seed-content";
import { avisoHtml, CasaSinAvisoError, conAviso, tieneAviso } from "@/lib/casa/aviso";
import {
  enlaceFinal,
  finalizarNotaCasa,
  NotaCasaRechazada,
  pasoCasa,
  siguienteTurno,
} from "@/lib/casa/paso-diario";
import { getProducto, PRODUCTOS } from "@/lib/casa/productos";
import { setArticleStatus } from "@/lib/robot/publish";
import { articleJsonLd } from "@/lib/seo";
import { getSection, NEWS_SECTIONS, SECTIONS } from "@/lib/sections";
import { SqliteD1 } from "./sqlite-d1";

const SEMILLAS_CASA = CONTENT_SEEDS.filter((s) => s.id.includes("-casa-"));

async function baseConCasa() {
  const db = new SqliteD1();
  const d1 = db.asD1();
  await applySchema(d1, SCHEMA_SQL);
  for (const s of SEMILLAS_CASA) await applySeed(d1, s);
  return { db, d1 };
}

describe("la sección de la casa", () => {
  it("existe, es de la casa y NO es una sección de noticias", () => {
    const casa = getSection("windoce");
    expect(casa?.house).toBe(true);
    expect(casa?.slug).toEqual({ es: "desde-windoce", en: "from-windoce" });
    expect(SECTIONS.map((s) => s.id)).toContain("windoce");
    expect(NEWS_SECTIONS.map((s) => s.id)).not.toContain("windoce");
  });

  it("hay una ficha por cada producto de windoce.com, con fecha de verificación", () => {
    expect(PRODUCTOS.map((p) => p.id).sort()).toEqual(
      [
        "aliramoney",
        "beellon",
        "divoox",
        "kipuu",
        "mercatren",
        "pantalay",
        "qrbott",
        "tokiia",
        "yadominios",
        "yapanel",
      ].sort(),
    );
    for (const p of PRODUCTOS) {
      expect(p.verificado).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.datos.es.length).toBe(p.datos.en.length);
      expect(p.url).toMatch(/^https:\/\//);
      // Ninguna ficha repite cifras de usuarios sin fuente.
      expect(p.datos.es.join(" ")).not.toMatch(/miles de usuarios|millones de usuarios/i);
    }
  });

  it("el aviso dice de quién es, en los dos idiomas", () => {
    const pantalay = getProducto("pantalay")!;
    expect(avisoHtml(pantalay, "es")).toContain(
      "Contenido de la casa:</strong> Losupe y Pantalay son de Windoce LLC.",
    );
    expect(avisoHtml(pantalay, "en")).toContain(
      "Brand content:</strong> Losupe and Pantalay are part of Windoce LLC.",
    );
    const html = conAviso(conAviso("<p>Hola</p>", pantalay, "es"), pantalay, "es");
    // No se duplica si ya estaba.
    expect(html.match(/aviso-casa/g)?.length).toBe(1);
    expect(tieneAviso(html, pantalay, "es")).toBe(true);
  });
});

describe("las siete notas de la primera semana", () => {
  it("son siete, una por producto, rotando los cuatro formatos", () => {
    expect(SEMILLAS_CASA).toHaveLength(7);
    for (let i = 0; i < 7; i++) {
      const { producto, formato } = siguienteTurno(i);
      const semilla = SEMILLAS_CASA[i]!;
      expect(semilla.id).toContain(producto.id);
      expect(semilla.statements.join("\n")).toContain(`'${formato}'`);
    }
  });

  it("todas quedan en revisión, con aviso, un solo enlace al producto y textos para redes", async () => {
    const { db } = await baseConCasa();
    const filas = db.raw
      .prepare(
        `SELECT a.id, a.status, a.section_id, h.product_id, h.social_json FROM articles a JOIN house_notes h ON h.article_id = a.id`,
      )
      .all() as {
      id: string;
      status: string;
      section_id: string;
      product_id: string;
      social_json: string;
    }[];
    expect(filas).toHaveLength(7);
    for (const f of filas) {
      expect(f.status).toBe("review");
      expect(f.section_id).toBe("windoce");
      const p = getProducto(f.product_id)!;
      const redes = JSON.parse(f.social_json);
      expect(redes.facebook_instagram.titulo).toBeTruthy();
      expect(redes.facebook_instagram.texto).toBeTruthy();
      expect(redes.tiktok).toMatch(/#/);
      expect(redes.youtube.titulo.length).toBeLessThanOrEqual(70);
      expect(redes.whatsapp).toBeTruthy();
      for (const lang of ["es", "en"] as const) {
        const { content_html } = db.raw
          .prepare(`SELECT content_html FROM article_i18n WHERE article_id = ? AND lang = ?`)
          .get(f.id, lang) as { content_html: string };
        expect(tieneAviso(content_html, p, lang), `${f.id} ${lang}`).toBe(true);
        expect(content_html.trimEnd().endsWith(enlaceFinal(p, lang))).toBe(true);
        expect(content_html.match(/<a\b/g)?.length, "un solo enlace").toBe(1);
        expect(content_html).not.toMatch(/miles de usuarios|thousands of users|compra ya|buy now/i);
      }
    }
  });
});

describe("el candado: sin aviso no se publica", () => {
  it("con aviso, la nota pasa a la fila de aprobadas y se publica", async () => {
    const { d1, db } = await baseConCasa();
    const id = "art-2026-11-07-casa-2-pantalay";
    await setArticleStatus(d1, id, "approved");
    await setArticleStatus(d1, id, "published");
    const fila = db.raw.prepare(`SELECT status FROM articles WHERE id = ?`).get(id) as {
      status: string;
    };
    expect(fila.status).toBe("published");
  });

  it("si alguien quita el aviso del texto en inglés, NO se publica", async () => {
    const { d1, db } = await baseConCasa();
    const id = "art-2026-11-07-casa-2-pantalay";
    db.raw
      .prepare(
        `UPDATE article_i18n SET content_html = replace(content_html, 'Brand content:', 'Note:') WHERE article_id = ? AND lang = 'en'`,
      )
      .run(id);
    await expect(setArticleStatus(d1, id, "published")).rejects.toBeInstanceOf(CasaSinAvisoError);
    await expect(setArticleStatus(d1, id, "approved")).rejects.toBeInstanceOf(CasaSinAvisoError);
    const fila = db.raw.prepare(`SELECT status FROM articles WHERE id = ?`).get(id) as {
      status: string;
    };
    expect(fila.status).toBe("review");
  });

  it("si la nota no tiene producto anotado, NO se publica", async () => {
    const { d1, db } = await baseConCasa();
    const id = "art-2026-11-07-casa-3-beellon";
    db.raw.prepare(`DELETE FROM house_notes WHERE article_id = ?`).run(id);
    await expect(setArticleStatus(d1, id, "published")).rejects.toBeInstanceOf(CasaSinAvisoError);
  });
});

describe("el paso diario", () => {
  it("publica UNA aprobada por día, la más vieja, aunque haya varias en fila", async () => {
    const { d1, db } = await baseConCasa();
    await setArticleStatus(d1, "art-2026-11-07-casa-1-divoox", "approved");
    await setArticleStatus(d1, "art-2026-11-07-casa-2-pantalay", "approved");
    const now = new Date("2026-11-08T15:00:00.000Z");
    const r1 = await pasoCasa({ DB: d1 }, { now, fetchImpl: async () => new Response("") });
    expect(r1.publicada).toBe("art-2026-11-07-casa-1-divoox");
    expect(r1.motivo).toBe("sin_llave");
    const r2 = await pasoCasa({ DB: d1 }, { now, fetchImpl: async () => new Response("") });
    expect(r2.publicada).toBeNull();
    const pantalay = db.raw
      .prepare(`SELECT status FROM articles WHERE id = 'art-2026-11-07-casa-2-pantalay'`)
      .get() as { status: string };
    expect(pantalay.status).toBe("approved");
    // Al día siguiente, sale la otra.
    const r3 = await pasoCasa(
      { DB: d1 },
      { now: new Date("2026-11-09T15:00:00.000Z"), fetchImpl: async () => new Response("") },
    );
    expect(r3.publicada).toBe("art-2026-11-07-casa-2-pantalay");
  });

  it("no escribe más si ya hay siete esperando a Richard", async () => {
    const { d1 } = await baseConCasa();
    const r = await pasoCasa(
      { DB: d1, GEMINI_API_KEY: "x" },
      { now: new Date("2026-11-20T15:00:00.000Z"), fetchImpl: async () => new Response("") },
    );
    expect(r.escrita).toBeNull();
    expect(r.motivo).toBe("esperando_revision");
  });

  it("la rotación sigue con los productos que faltan", () => {
    expect(siguienteTurno(7).producto.id).toBe("yadominios");
    expect(siguienteTurno(8).producto.id).toBe("aliramoney");
    expect(siguienteTurno(9).producto.id).toBe("tokiia");
    expect(siguienteTurno(10).producto.id).toBe("divoox");
    expect(siguienteTurno(10).formato).toBe("tendencia");
  });
});

describe("lo que escribe el modelo pasa por las reglas", () => {
  const p = getProducto("pantalay")!;
  const cuerpo = `<p>${"Texto de la nota con buena longitud. ".repeat(50)}</p><p><a href="https://otra.com">enlace</a></p>`;
  const valido = {
    es: {
      title: "Cómo grabar tu pantalla gratis sin instalar nada",
      excerpt: "Una guía sencilla para grabar la pantalla y compartir el enlace.",
      content_html: cuerpo,
      meta_title: "Grabar pantalla gratis",
      meta_description: "Guía para grabar la pantalla desde el navegador sin instalar nada.",
      tags: ["pantalla", "tutorial"],
    },
    en: {
      title: "How to record your screen for free without installing",
      excerpt: "A simple guide to recording your screen and sharing the link.",
      content_html: cuerpo,
      meta_title: "Record your screen free",
      meta_description:
        "A guide to recording your screen from the browser with nothing to install.",
      tags: ["screen", "tutorial"],
    },
    redes: {
      facebook_instagram: {
        titulo: "Graba tu pantalla",
        texto: "Una guía para grabar la pantalla.",
      },
      tiktok: "Graba tu pantalla #tutorial",
      youtube: {
        titulo: "Graba tu pantalla",
        descripcion: "Guía para grabar la pantalla.",
        etiquetas: "pantalla",
      },
      whatsapp: "Graba tu pantalla gratis.",
    },
  };

  it("quita los enlaces del modelo, pone el aviso arriba y el enlace al producto al final", () => {
    const nota = finalizarNotaCasa(valido, p);
    expect(tieneAviso(nota.es.content_html, p, "es")).toBe(true);
    expect(tieneAviso(nota.en.content_html, p, "en")).toBe(true);
    expect(nota.es.content_html).not.toContain("otra.com");
    expect(nota.es.content_html).toContain('rel="sponsored noopener"');
  });

  it("rechaza cifras de usuarios inventadas y llamados a comprar", () => {
    const conCifra = structuredClone(valido);
    conCifra.es.content_html = cuerpo + "<p>Ya lo usan miles de usuarios en todo el mundo.</p>";
    expect(() => finalizarNotaCasa(conCifra, p)).toThrow(NotaCasaRechazada);
    const conCompra = structuredClone(valido);
    conCompra.redes.whatsapp = "¡Cómpralo ya!";
    expect(() => finalizarNotaCasa(conCompra, p)).toThrow(NotaCasaRechazada);
  });
});

describe("buscadores", () => {
  it("la nota de la casa se marca como contenido de anunciante, con Windoce como patrocinador", () => {
    const ld = articleJsonLd(
      "https://losupe.com",
      "es",
      {
        id: "x",
        sectionId: "windoce",
        slug: "s",
        title: "t",
        excerpt: "e",
        contentHtml: "<p>x</p>",
        kind: "evergreen",
        tags: [],
        sources: [],
        authorId: "equipo-losupe",
        authorName: "Equipo",
        lang: "es",
        publishedAt: "2026-11-08T00:00:00.000Z",
        updatedAt: "2026-11-08T00:00:00.000Z",
      } as never,
      "losupe",
    ) as Record<string, unknown>;
    expect(ld["@type"]).toBe("AdvertiserContentArticle");
    expect(ld.sponsor).toMatchObject({ name: "Windoce LLC" });
  });
});

describe("Google Noticias", () => {
  it("el mapa de noticias deja FUERA las notas de la casa y deja las noticias", async () => {
    const { d1, db } = await baseConCasa();
    const ahora = new Date(Date.now() - 60_000).toISOString();
    await setArticleStatus(d1, "art-2026-11-07-casa-1-divoox", "published");
    db.raw
      .prepare(`UPDATE articles SET published_at = ? WHERE id = 'art-2026-11-07-casa-1-divoox'`)
      .run(ahora);
    db.raw.exec(
      `INSERT INTO articles (id, section_id, author_id, status, published_at) VALUES ('n1', 'economia', 'equipo-losupe', 'published', '${ahora}')`,
    );
    db.raw.exec(
      `INSERT INTO article_i18n (article_id, lang, slug, title, content_html) VALUES ('n1', 'es', 'noticia-de-economia', 'Noticia de economía', '<p>x</p>')`,
    );
    dbDeLaPrueba.actual = d1;
    const { GET } = await import("@/app/news-sitemap.xml/route");
    const xml = await (await GET(new Request("https://losupe.com/news-sitemap.xml"))).text();
    expect(xml).toContain("noticia-de-economia");
    expect(xml).not.toContain("desde-windoce");
    expect(xml).not.toContain("divoox");
  });
});
