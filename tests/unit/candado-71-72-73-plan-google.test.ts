import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applySchema } from "@/lib/schema-guard";
import { SCHEMA_SQL } from "@/lib/schema-sql";
import { cupoDiario } from "@/lib/robot/pipeline";
import { finalizeDraft, tieneFuenteNombrada } from "@/lib/robot/writer";
import { getArticleBySlug, listForSitemap, listRecentForNews } from "@/lib/queries";
import { SqliteD1 } from "./sqlite-d1";

/**
 * EL PLAN DE GOOGLE DEL 26 NOV 2026 (docs/REVISION-GOOGLE-2026-11-26.md).
 *
 * Search Console: las páginas indexadas cayeron de 236 a 63 y quedaron 313 «rastreadas, sin
 * indexar», casi todas efemérides, listas de curiosidades y guías genéricas. Google Noticias, cero
 * impresiones en tres meses. Tres candados:
 *   71 — el relleno no se vuelve a escribir.
 *   72 — cuatro notas al día, todas de actualidad y con su fuente nombrada.
 *   73 — el relleno viejo sale de los mapas y lleva noindex, sin borrar nada.
 */

async function base() {
  const db = new SqliteD1();
  const d1 = db.asD1();
  await applySchema(d1, SCHEMA_SQL);
  return { db, d1 };
}

const ajuste = (db: SqliteD1, key: string) =>
  (db.raw.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as { value: string }).value;

describe("candado 71: el relleno queda apagado también en la base", () => {
  it("una base nueva nace con las efemérides y las piezas propias en cero", async () => {
    const { db } = await base();
    expect(ajuste(db, "evergreen_ratio")).toBe("0");
    expect(ajuste(db, "mesa_efemerides")).toBe("0");
    expect(ajuste(db, "mesa_ratio_propias")).toBe("0");
  });

  it("una base que venía encendida se apaga en la siguiente publicación", async () => {
    const { db, d1 } = await base();
    db.raw.exec(`UPDATE settings SET value = '1' WHERE key = 'mesa_efemerides'`);
    db.raw.exec(`UPDATE settings SET value = '0.5' WHERE key = 'evergreen_ratio'`);
    db.raw.exec(`UPDATE settings SET value = '0.4' WHERE key = 'mesa_ratio_propias'`);
    await applySchema(d1, SCHEMA_SQL);
    expect(ajuste(db, "mesa_efemerides")).toBe("0");
    expect(ajuste(db, "evergreen_ratio")).toBe("0");
    expect(ajuste(db, "mesa_ratio_propias")).toBe("0");
  });

  it("el panel ya no tiene con qué encender las piezas propias", () => {
    const ruta = readFileSync("src/app/panel/accion/robot/route.ts", "utf8");
    expect(ruta).not.toContain("mesa_ratio_propias");
    expect(ruta).not.toContain("evergreen_ratio");
  });

  it("un tema apartado deja su motivo: la columna existe (fallaba en silencio)", async () => {
    const { db } = await base();
    db.raw.exec(
      `INSERT INTO candidates (id, section_id, url, title) VALUES ('c', 'delivery', 'https://x.example/a', 'Tema')`,
    );
    db.raw.exec(`UPDATE candidates SET status = 'skipped', error = 'motivo' WHERE id = 'c'`);
    const fila = db.raw.prepare(`SELECT error FROM candidates WHERE id = 'c'`).get() as {
      error: string;
    };
    expect(fila.error).toBe("motivo");
  });
});

describe("candado 72: cuatro notas al día, todas con su fuente", () => {
  it("el cupo nunca pasa de los cuatro turnos, diga lo que diga el ajuste", () => {
    expect(cupoDiario("11")).toBe(4);
    expect(cupoDiario("24")).toBe(4);
    expect(cupoDiario("3")).toBe(3);
    expect(cupoDiario(null)).toBe(4);
    expect(cupoDiario("basura")).toBe(4);
  });

  it("una base con once notas al día baja a cuatro, y Delivery queda con la mitad", async () => {
    const { db, d1 } = await base();
    db.raw.exec(`UPDATE settings SET value = '11' WHERE key = 'notes_per_day'`);
    db.raw.exec(
      `UPDATE sections SET notes_per_day = 3 WHERE id IN ('delivery', 'tecnologia', 'artistas')`,
    );
    await applySchema(d1, SCHEMA_SQL);
    expect(ajuste(db, "notes_per_day")).toBe("4");
    const cupo = (id: string) =>
      (
        db.raw.prepare(`SELECT notes_per_day AS n FROM sections WHERE id = ?`).get(id) as {
          n: number;
        }
      ).n;
    expect(cupo("delivery")).toBe(2);
    expect(cupo("tecnologia")).toBe(1);
    expect(cupo("artistas")).toBe(1);
  });

  it("si Richard lo baja a tres, se respeta", async () => {
    const { db, d1 } = await base();
    db.raw.exec(`UPDATE settings SET value = '3' WHERE key = 'notes_per_day'`);
    await applySchema(d1, SCHEMA_SQL);
    expect(ajuste(db, "notes_per_day")).toBe("3");
  });

  it("una noticia sin fuente enlazada no se publica, y un enlace propio no cuenta", () => {
    expect(
      tieneFuenteNombrada('<p>Según <a href="https://www.reuters.com/x">Reuters</a>.</p>'),
    ).toBe(true);
    expect(
      tieneFuenteNombrada('<p>Lee <a href="https://losupe.com/es/economia/otra">esto</a>.</p>'),
    ).toBe(false);
    expect(tieneFuenteNombrada('<p>Lee <a href="/es/economia/otra">esto</a>.</p>')).toBe(false);
    expect(tieneFuenteNombrada("<p>Sin enlaces.</p>")).toBe(false);
  });

  it("el redactor rechaza el borrador de una noticia que no nombra su fuente", () => {
    const parrafos = Array.from(
      { length: 40 },
      (_, i) =>
        `<p>Párrafo ${i} con palabras propias ${i * 7} sobre el reparto número ${i} hoy.</p>`,
    ).join("");
    const borrador = {
      es: {
        title: "Una empresa de reparto cambia sus tarifas en tres ciudades",
        excerpt:
          "La compañía ajusta lo que cobra en tres ciudades y lo explica en su sitio oficial, con fechas y cifras.",
        content_html: parrafos,
        meta_title: "Una empresa de reparto cambia sus tarifas",
        meta_description:
          "La compañía ajusta lo que cobra en tres ciudades y lo explica en su sitio oficial, con fechas y cifras.",
        tags: ["reparto", "tarifas", "ciudades"],
      },
      en: {
        title: "A delivery company changes its fees in three cities",
        excerpt:
          "The company is adjusting what it charges in three cities and explains it on its website, with dates and figures.",
        content_html: parrafos.replace(/Párrafo/g, "Paragraph"),
        meta_title: "A delivery company changes its fees",
        meta_description:
          "The company is adjusting what it charges in three cities and explains it on its website, with dates and figures.",
        tags: ["delivery", "fees", "cities"],
      },
      kind: "news",
      image_prompt: "Wide editorial photo of a delivery scooter",
      image_alt_es: "Moto de reparto",
      image_alt_en: "Delivery scooter",
      image_keywords: ["delivery"],
    };
    expect(() => finalizeDraft(borrador, [], { exigirFuente: true })).toThrow(
      /sin fuente nombrada/,
    );
    const conFuente = {
      ...borrador,
      es: {
        ...borrador.es,
        content_html: `${parrafos}<p>Según <a href="https://empresa.example/precios">la empresa</a>.</p>`,
      },
      en: {
        ...borrador.en,
        content_html: `${borrador.en.content_html}<p>According to <a href="https://empresa.example/precios">the company</a>.</p>`,
      },
    };
    expect(() => finalizeDraft(conFuente, [], { exigirFuente: true })).not.toThrow();
  });
});

describe("candado 73: el relleno viejo sale de los mapas, sin borrar nada", () => {
  const AYER = "2026-11-25T12:00:00.000Z";

  function nota(
    db: SqliteD1,
    id: string,
    slug: string,
    o: { kind?: string; origin?: string; seccion?: string } = {},
  ) {
    db.raw
      .prepare(
        `INSERT INTO articles (id, section_id, author_id, status, kind, origin, published_at, created_at, updated_at)
         VALUES (?, ?, 'equipo-losupe', 'published', ?, ?, ?, ?, ?)`,
      )
      .run(id, o.seccion ?? "artistas", o.kind ?? "news", o.origin ?? "robot", AYER, AYER, AYER);
    for (const lang of ["es", "en"]) {
      db.raw
        .prepare(
          `INSERT INTO article_i18n (article_id, lang, slug, title, excerpt, content_html)
           VALUES (?, ?, ?, ?, 'Resumen', '<p>Cuerpo</p>')`,
        )
        .run(id, lang, lang === "es" ? slug : `${slug}-en`, `Título ${id}`);
    }
  }

  async function archivo() {
    const { db, d1 } = await base();
    // Lo que Google leyó y no indexó (ejemplos reales del informe del 26 nov 2026).
    nota(db, "efe", "7-curiosidades-de-leon-gieco-a-75-anos-de-su-nacimiento");
    nota(db, "lista", "10-datos-curiosos-sobre-mercados-y-ferias", { seccion: "ventas" });
    nota(db, "rgpd", "10-datos-sorprendentes-del-rgpd-que-cambiaron-tu-privacidad-digital", {
      seccion: "tecnologia",
    });
    nota(db, "guia", "como-los-paises-aseguran-respaldo-financiero-internacional", {
      kind: "evergreen",
      seccion: "economia",
    });
    // Lo que se queda: noticias, lo pagado, y las tres que sí trajeron impresiones.
    nota(db, "noticia", "target-adelanta-sus-ofertas-de-black-friday-2026", { seccion: "ventas" });
    nota(db, "errores-ia", "greptile-expande-la-deteccion-de-errores-mas-alla-del-codigo", {
      seccion: "tecnologia",
    });
    nota(db, "pagada", "publica-tu-pagina-web-en-la-nube-sin-ser-experto", {
      kind: "evergreen",
      origin: "sponsored",
      seccion: "tecnologia",
    });
    nota(db, "rob", "6-curiosidades-de-rob-james-collier-a-sus-50-anos");
    // La siguiente publicación aplica el esquema y marca el archivo.
    await applySchema(d1, SCHEMA_SQL);
    return { db, d1 };
  }

  const marcadas = (db: SqliteD1) =>
    (
      db.raw.prepare(`SELECT id FROM articles WHERE noindex = 1 ORDER BY id`).all() as {
        id: string;
      }[]
    ).map((r) => r.id);

  it("marca efemérides, listas y guías genéricas, y deja en paz lo demás", async () => {
    const { db } = await archivo();
    expect(marcadas(db)).toEqual(["efe", "guia", "lista", "rgpd"]);
  });

  it("no borra ni archiva nada: todo sigue publicado", async () => {
    const { db } = await archivo();
    const n = db.raw
      .prepare(`SELECT COUNT(*) AS n FROM articles WHERE status = 'published'`)
      .get() as { n: number };
    expect(n.n).toBe(8);
  });

  it("es idempotente: otra publicación no vuelve a escribir ni una fila", async () => {
    const { db, d1 } = await archivo();
    const antes = db.raw.prepare(`SELECT id, updated_at FROM articles ORDER BY id`).all();
    await applySchema(d1, SCHEMA_SQL);
    expect(db.raw.prepare(`SELECT id, updated_at FROM articles ORDER BY id`).all()).toEqual(antes);
  });

  it("las marcadas salen del mapa del sitio y del de noticias", async () => {
    const { d1 } = await archivo();
    const mapa = new Set((await listForSitemap(d1)).map((r) => r.id));
    for (const id of ["efe", "lista", "rgpd", "guia"]) expect(mapa.has(id)).toBe(false);
    for (const id of ["noticia", "errores-ia", "pagada", "rob"]) expect(mapa.has(id)).toBe(true);
    const noticias = new Set(
      (await listRecentForNews(d1, "2026-11-01T00:00:00.000Z")).map((r) => r.id),
    );
    expect(noticias.has("efe")).toBe(false);
    expect(noticias.has("noticia")).toBe(true);
  });

  it("su enlace sigue respondiendo, con la marca de noindex", async () => {
    const { d1 } = await archivo();
    const efe = await getArticleBySlug(
      d1,
      "es",
      "7-curiosidades-de-leon-gieco-a-75-anos-de-su-nacimiento",
    );
    expect(efe?.noindex).toBe(true);
    const buena = await getArticleBySlug(
      d1,
      "es",
      "target-adelanta-sus-ofertas-de-black-friday-2026",
    );
    expect(buena?.noindex).toBe(false);
  });

  it("la página de la nota pide noindex cuando la nota es de relleno", () => {
    const src = readFileSync("src/app/[lang]/[section]/[slug]/page.tsx", "utf8");
    expect(src).toMatch(
      /article\.fallback \|\| article\.noindex \? \{ index: false, follow: true \}/,
    );
  });
});

describe("candado 74: el día se apoya en Delivery y logística", () => {
  it("Delivery tiene más turnos que cualquier otra sección, y abre la mañana y la tarde", async () => {
    const { FRANJAS } = await import("@/lib/robot/franjas");
    const cuenta = new Map<string, number>();
    for (const f of FRANJAS) cuenta.set(f.seccion ?? "", (cuenta.get(f.seccion ?? "") ?? 0) + 1);
    const delivery = cuenta.get("delivery") ?? 0;
    for (const [id, n] of cuenta) if (id !== "delivery") expect(delivery).toBeGreaterThan(n);
    const horas = FRANJAS.filter((f) => f.seccion === "delivery").map((f) => f.hour);
    expect(Math.min(...horas)).toBeLessThan(12);
    expect(Math.max(...horas)).toBeGreaterThanOrEqual(12);
  });

  it("Delivery tiene el cupo más alto de la base", async () => {
    const { db } = await base();
    const filas = db.raw
      .prepare(`SELECT id, notes_per_day AS n FROM sections WHERE active = 1`)
      .all() as { id: string; n: number }[];
    const delivery = filas.find((f) => f.id === "delivery")!.n;
    for (const f of filas) if (f.id !== "delivery") expect(delivery).toBeGreaterThan(f.n);
  });

  it("en cada turno de Delivery se mira primero si Divoox publicó algo nuevo (candado 67)", () => {
    const src = readFileSync("src/lib/robot/pipeline.ts", "utf8");
    expect(src).toMatch(/seccion === "delivery"\) \{\s*await leerNovedadesPropias/);
  });

  it("y sigue siendo solo última milla: la fuente de carga pesada está apagada (candado 70)", async () => {
    const { db } = await base();
    const f = db.raw.prepare(`SELECT active FROM sources WHERE id = 'supplychaindive'`).get() as {
      active: number;
    };
    expect(f.active).toBe(0);
  });
});
