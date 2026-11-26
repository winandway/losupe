import { describe, expect, it } from "vitest";
import { applySchema } from "@/lib/schema-guard";
import { SCHEMA_SQL } from "@/lib/schema-sql";
import {
  direccionesDelMapa,
  FUENTE_PROPIA,
  leerNovedadesPropias,
} from "@/lib/robot/novedades-propias";
import { pickCandidate } from "@/lib/robot/universal";
import { SqliteD1 } from "./sqlite-d1";

/**
 * Candado 67 — la nota nuestra del día sale sola, y como mucho una (Richard, 26 nov 2026).
 *
 * «Con veintiséis empresas, nosotros saldríamos cada veintiséis días… eso no es un SEO». Dos notas
 * del sector por relevancia, y la tercera puede ser nuestra cuando Divoox publica una guía nueva.
 */
const guia = (n: number) => `https://divoox.com/es/docs/drivers/guia-${n}`;
const mapa = (urls: string[]) =>
  `<?xml version="1.0"?><urlset>${urls.map((u) => `<url><loc>${u}</loc></url>`).join("")}<url><loc>https://divoox.com/docs/drivers/en-ingles</loc></url><url><loc>https://divoox.com/es/docs</loc></url></urlset>`;

function fetchFalso(urls: string[]): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("sitemap.xml")) return new Response(mapa(urls), { status: 200 });
    return new Response(
      `<html><head><title>Función nueva ${url.slice(-2)} | Divoox</title><meta name="description" content="Lo que hace la función nueva."></head><body><main><p>${"Texto de la guía. ".repeat(40)}</p></main></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } },
    );
  }) as typeof fetch;
}

async function base() {
  const db = new SqliteD1();
  const d1 = db.asD1();
  await applySchema(d1, SCHEMA_SQL);
  return { db, d1 };
}

describe("de dónde sale el material nuestro", () => {
  it("solo cuentan las guías en español de Docs (cada una tiene su par en inglés)", () => {
    expect(direccionesDelMapa(mapa([guia(1), guia(2)]))).toEqual([guia(1), guia(2)]);
  });

  it("la primera vez se siembra todo y NO se propone nada (si no, saldrían 614 notas)", async () => {
    const { db, d1 } = await base();
    const urls = Array.from({ length: 614 }, (_, i) => guia(i));
    const r = await leerNovedadesPropias(d1, { fetchImpl: fetchFalso(urls) });
    expect(r).toMatchObject({ sembradas: 614, propuestas: 0 });
    const c = db.raw.prepare(`SELECT COUNT(*) AS n FROM candidates`).get() as { n: number };
    expect(c.n).toBe(0);
  });

  it("una guía que antes no existía entra como candidata del sector, con su título", async () => {
    const { db, d1 } = await base();
    await leerNovedadesPropias(d1, { fetchImpl: fetchFalso([guia(1), guia(2)]) });
    const r = await leerNovedadesPropias(d1, {
      fetchImpl: fetchFalso([guia(1), guia(2), guia(33)]),
    });
    expect(r).toMatchObject({ nuevas: 1, propuestas: 1 });
    const fila = db.raw
      .prepare(`SELECT section_id, source_id, title FROM candidates WHERE url = ?`)
      .get(guia(33)) as { section_id: string; source_id: string; title: string };
    expect(fila).toEqual({
      section_id: "delivery",
      source_id: FUENTE_PROPIA,
      title: "Función nueva 33",
    });
    // Y un día sin novedades no escribe nada.
    const otra = await leerNovedadesPropias(d1, {
      fetchImpl: fetchFalso([guia(1), guia(2), guia(33)]),
    });
    expect(otra).toMatchObject({ nuevas: 0, propuestas: 0 });
  });

  it("una reorganización de Docs (decenas de direcciones nuevas de golpe) no propone nada", async () => {
    const { d1 } = await base();
    await leerNovedadesPropias(d1, { fetchImpl: fetchFalso([guia(1)]) });
    const muchas = Array.from({ length: 40 }, (_, i) => guia(100 + i));
    const r = await leerNovedadesPropias(d1, { fetchImpl: fetchFalso([guia(1), ...muchas]) });
    expect(r).toMatchObject({ nuevas: 40, propuestas: 0 });
  });
});

describe("como mucho una nuestra al día, y nunca dos días seguidos", () => {
  const ahora = new Date("2026-11-27T15:00:00Z");

  function candidata(db: SqliteD1, id: string, fuente: string, score: number) {
    db.raw
      .prepare(
        `INSERT INTO candidates (id, source_id, section_id, url, title, summary, lang, published_at, score) VALUES (?, ?, 'delivery', ?, ?, 'Resumen del tema.', 'es', ?, ?)`,
      )
      .run(
        id,
        fuente,
        `https://ejemplo.com/${id}`,
        `Tema ${id} del reparto`,
        ahora.toISOString(),
        score,
      );
  }

  it("si ayer salió una nuestra, hoy se elige la del sector aunque la nuestra puntúe más", async () => {
    const { db, d1 } = await base();
    candidata(db, "propia-hoy", FUENTE_PROPIA, 100);
    candidata(db, "sector-1", "otra-fuente", 5);
    db.raw.exec(
      `INSERT INTO articles (id, section_id, author_id, status, published_at) VALUES ('nota-ayer', 'delivery', 'pedro-llerena', 'published', '2026-11-26T14:00:00Z')`,
    );
    db.raw
      .prepare(
        `INSERT INTO candidates (id, source_id, section_id, url, title, lang, score, status, article_id) VALUES ('propia-ayer', ?, 'delivery', 'https://divoox.com/es/docs/x/y', 'Vieja', 'es', 100, 'used', 'nota-ayer')`,
      )
      .run(FUENTE_PROPIA);
    const elegida = await pickCandidate(d1, ahora, [], { seccion: "delivery" });
    expect(elegida?.id).toBe("sector-1");
  });

  it("sin una nuestra ayer ni hoy, la nuestra sale primero", async () => {
    const { db, d1 } = await base();
    candidata(db, "propia-hoy", FUENTE_PROPIA, 100);
    candidata(db, "sector-1", "otra-fuente", 5);
    const elegida = await pickCandidate(d1, ahora, [], { seccion: "delivery" });
    expect(elegida?.id).toBe("propia-hoy");
  });
});
