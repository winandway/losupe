import { describe, expect, it } from "vitest";
import { applySchema } from "@/lib/schema-guard";
import { SCHEMA_SQL } from "@/lib/schema-sql";
import {
  assertTransparencia,
  AVISO_RELACION,
  CasaSinAvisoError,
  conTransparencia,
  productoMencionado,
  tieneTransparencia,
} from "@/lib/casa/aviso";
import { getProducto } from "@/lib/casa/productos";
import { setArticleStatus } from "@/lib/robot/publish";
import { getSection, NEWS_SECTIONS, SECTIONS } from "@/lib/sections";
import { seccionCoherente } from "@/lib/robot/trends";
import { SqliteD1 } from "./sqlite-d1";

/**
 * Candado 61 — el segmento de delivery y logística (25 nov 2026).
 *
 * Richard lo pidió así: «todos los días vamos a sacar nuestro segmento… vamos a hablar de Uber, de
 * DoorDash, de Rappi… y que Google no sienta que es un SEO especial de Divoox».
 *
 * Eso último es lo que fija esta prueba, y no es un detalle de estilo: la política de Google
 * Noticias saca de sus superficies al medio que presenta contenido propio como independiente. Un
 * segmento de delivery escrito por el dueño de una app de delivery solo se sostiene de una forma —
 * diciéndolo— y decirlo no puede depender de que alguien se acuerde.
 */

async function base() {
  const db = new SqliteD1();
  const d1 = db.asD1();
  await applySchema(d1, SCHEMA_SQL);
  return { db, d1 };
}

/** Deja una nota de delivery lista para publicar, con el cuerpo que diga la prueba. */
function nota(db: SqliteD1, id: string, cuerpoEs: string, cuerpoEn: string) {
  db.raw.exec(
    `INSERT INTO articles (id, section_id, author_id, status) VALUES ('${id}', 'delivery', 'pedro-llerena', 'draft')`,
  );
  for (const [lang, html] of [
    ["es", cuerpoEs],
    ["en", cuerpoEn],
  ] as const) {
    db.raw
      .prepare(
        `INSERT INTO article_i18n (article_id, lang, slug, title, excerpt, content_html) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, lang, `${id}-${lang}`, "Las apps de reparto en la región", "Resumen.", html);
  }
}

describe("la sección existe y es periodismo del sector, no la sección de la casa", () => {
  it("está publicada, sale tres veces al día y SÍ es una sección de noticias", () => {
    const s = getSection("delivery");
    expect(s?.name.es).toBe("Delivery y logística");
    expect(s?.perDay).toBe(3);
    // Esto es lo que la separa de «Desde Windoce»: va a Google Noticias como cualquier otra.
    expect(s?.house).toBeUndefined();
    expect(NEWS_SECTIONS.map((x) => x.id)).toContain("delivery");
    // Y la dirección es la misma en los dos idiomas, que es como la busca la gente.
    expect(s?.slug).toEqual({ es: "delivery", en: "delivery" });
    expect(SECTIONS.filter((x) => x.id === "delivery")).toHaveLength(1);
  });

  it("el sector se clasifica en su sección y no se lo lleva Tecnología", () => {
    // El feed de tecnología trae «app» y «robot» por todas partes: sin su propia regla, media
    // sección de reparto terminaba en Tecnología (es el fallo del candado 59 con el deporte).
    for (const t of [
      "DoorDash sube la paga de sus repartidores",
      "Uber Eats llega a tres ciudades más",
      "Los repartidores de Rappi protestan en Bogotá",
      "Amazon Flex abre bloques en Miami",
      "Last-mile delivery costs keep climbing",
    ]) {
      expect(seccionCoherente("tecnologia", t), t).toBe("delivery");
    }
    // Y al revés: una noticia de IA que llegue por una fuente del sector no se queda en delivery.
    expect(seccionCoherente("delivery", "OpenAI lanza un modelo nuevo de razonamiento")).toBe(
      "tecnologia",
    );
  });
});

describe("si una nota nombra un producto de la casa, lo dice — o no se publica", () => {
  it("al publicarla, la línea se le pone SOLA en los dos idiomas", async () => {
    // Un candado que solo rechazara dejaría sin publicar justo las notas que Richard quiere (las
    // que comparan a Divoox con el resto del sector). Así que primero se pone y después se exige.
    const { db, d1 } = await base();
    nota(
      db,
      "n-sin-aviso",
      "<p>En la región compiten Rappi, PedidosYa y Divoox.</p>",
      "<p>Rappi, PedidosYa and Divoox compete in the region.</p>",
    );
    await setArticleStatus(d1, "n-sin-aviso", "published");
    const divoox = getProducto("divoox")!;
    for (const lang of ["es", "en"] as const) {
      const fila = db.raw
        .prepare(`SELECT content_html FROM article_i18n WHERE article_id = ? AND lang = ?`)
        .get("n-sin-aviso", lang) as { content_html: string };
      expect(tieneTransparencia(fila.content_html, divoox, lang), lang).toBe(true);
    }
  });

  it("y si alguien la quitara a mano, esa nota ya no se publica", async () => {
    const { db, d1 } = await base();
    nota(
      db,
      "n-pelada",
      "<p>En la región compiten Rappi, PedidosYa y Divoox.</p>",
      "<p>Rappi, PedidosYa and Divoox compete in the region.</p>",
    );
    await expect(assertTransparencia(d1, "n-pelada")).rejects.toBeInstanceOf(CasaSinAvisoError);
    const fila = db.raw.prepare(`SELECT status FROM articles WHERE id = ?`).get("n-pelada") as {
      status: string;
    };
    expect(fila.status).toBe("draft");
  });

  it("con la línea puesta, sale sin problema", async () => {
    const { db, d1 } = await base();
    nota(
      db,
      "n-con-aviso",
      conTransparencia(
        "<p>En la región compiten Rappi, PedidosYa y Divoox.</p>",
        { nombre: "Divoox" } as never,
        "es",
      ),
      conTransparencia(
        "<p>Rappi, PedidosYa and Divoox compete in the region.</p>",
        { nombre: "Divoox" } as never,
        "en",
      ),
    );
    await setArticleStatus(d1, "n-con-aviso", "published");
    const fila = db.raw.prepare(`SELECT status FROM articles WHERE id = ?`).get("n-con-aviso") as {
      status: string;
    };
    expect(fila.status).toBe("published");
  });

  it("una nota del sector que no nombra nada nuestro sale tal cual", async () => {
    const { db, d1 } = await base();
    nota(
      db,
      "n-neutra",
      "<p>DoorDash y Uber Eats cambian sus comisiones.</p>",
      "<p>DoorDash and Uber Eats change their fees.</p>",
    );
    await setArticleStatus(d1, "n-neutra", "published");
    const fila = db.raw.prepare(`SELECT status FROM articles WHERE id = ?`).get("n-neutra") as {
      status: string;
    };
    expect(fila.status).toBe("published");
  });

  it("el aviso dice de quién es la empresa, en los dos idiomas", () => {
    expect(AVISO_RELACION.es("Divoox")).toContain("Windoce LLC, la empresa dueña de Losupe");
    expect(AVISO_RELACION.en("Divoox")).toContain("Windoce LLC, the company that owns Losupe");
  });

  it("reconoce el nombre entero, no trozos de otra palabra", () => {
    expect(productoMencionado("Divoox abre en Caracas")?.id).toBe("divoox");
    expect(productoMencionado("Hablamos de kipuu y de otras")?.id).toBe("kipuu");
    expect(productoMencionado("DoorDash y Uber Eats")).toBeUndefined();
    // Nada de falsos positivos por una palabra que CONTIENE el nombre.
    expect(productoMencionado("divooxmania es otra cosa")).toBeUndefined();
  });
});

describe("la firma del segmento", () => {
  it("Pedro Llerena lleva delivery y su perfil público va en la ficha", async () => {
    const { db } = await base();
    const a = db.raw
      .prepare(
        `SELECT sections_json, linkedin_url, role_es, bio_es FROM authors WHERE id = 'pedro-llerena'`,
      )
      .get() as {
      sections_json: string;
      linkedin_url: string | null;
      role_es: string;
      bio_es: string;
    };
    expect(JSON.parse(a.sections_json)).toContain("delivery");
    expect(a.linkedin_url).toBe("https://www.linkedin.com/in/pedro-llerena-montes/");
    expect(a.role_es).toContain("Delivery");
    // Y la biografía DICE que es el dueño del grupo: si no lo dijera, el segmento entero sería
    // sospechoso para Google y para cualquier lector que lo averigüe por su cuenta.
    expect(a.bio_es).toContain("Windoce LLC");
    expect(a.bio_es).toContain("Divoox");
  });

  it("el segmento tiene fuentes propias del sector, no prestadas de otra sección", async () => {
    const { db } = await base();
    const filas = db.raw
      .prepare(`SELECT id, url FROM sources WHERE section_id = 'delivery' AND active = 1`)
      .all() as { id: string; url: string }[];
    // Nueve el día que se montó, todas comprobadas una por una antes de sembrarlas.
    expect(filas.length).toBeGreaterThanOrEqual(8);
    expect(filas.map((f) => f.id)).toContain("foodondemand");
    for (const f of filas) expect(f.url).toMatch(/^https:\/\//);
  });
});

describe("estrenar un turno el mismo día", () => {
  it("el reloj acepta `?franja=` y la escaleta reconoce el turno de la noche", async () => {
    const { FRANJAS } = await import("@/lib/robot/franjas");
    // Sin esto, una sección montada por la tarde no publica hasta el día siguiente, y un turno que
    // se pierde por una caída del proveedor se pierde entero.
    const noche = FRANJAS.find((f) => f.key === "noche-3");
    expect(noche?.seccion).toBe("delivery");
    const { handleScheduledRequest } = await import("@/lib/robot/scheduled");
    expect(typeof handleScheduledRequest).toBe("function");
    // El parámetro se lee de la URL, no del cuerpo: el reloj llama con GET.
    const src = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/robot/scheduled.ts", "utf8"),
    );
    expect(src).toContain('searchParams.get("franja")');
  });
});

describe("nuestra propia app aparece en el segmento, declarada", () => {
  it("el redactor SÍ sabe que Divoox existe cuando escribe de delivery", async () => {
    const { bloqueCasaEnElSector, buildUniversalPrompt } = await import("@/lib/robot/writer");
    const bloque = bloqueCasaEnElSector("delivery");
    expect(bloque).toContain("Divoox");
    expect(bloque).toContain("Windoce LLC");
    // Y le llega dentro del encargo de verdad, no solo como función suelta.
    const prompt = buildUniversalPrompt({
      sectionId: "delivery",
      topicTitle: "Las comisiones de las apps de reparto en América Latina",
      kind: "news",
      sources: [],
    } as never);
    expect(prompt).toContain("Divoox");
  });

  it("y NO se lo cuela en las secciones donde no pinta nada", async () => {
    const { bloqueCasaEnElSector } = await import("@/lib/robot/writer");
    for (const s of ["tecnologia", "artistas", "economia", "cripto", "ventas"] as const) {
      expect(bloqueCasaEnElSector(s), s).toBe("");
    }
  });

  it("le prohíbe inventar y le prohíbe escribir el aviso él mismo", async () => {
    const { bloqueCasaEnElSector } = await import("@/lib/robot/writer");
    const b = bloqueCasaEnElSector("delivery");
    // Lo que hunde a un medio nuevo es decir de su producto más de lo que se puede comprobar.
    expect(b).toMatch(/Nada de usuarios, pedidos, ciudades ya funcionando/);
    expect(b).toMatch(/Si no encaja, NO lo menciones/);
    expect(b).toMatch(/Nunca en el titular/);
    // El aviso lo pone el código, siempre. Si lo escribiera el modelo, un día se le olvidaría.
    expect(b).toMatch(/NO escribas ningún aviso de transparencia/);
  });

  it("la sección lleva su ficha al pie, con enlace marcado como de la casa", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { FichaDelSector } = await import("@/components/FichaDelSector");
    const { es } = await import("@/i18n/es");
    const html = renderToStaticMarkup(
      <FichaDelSector sectionId="delivery" lang="es" dict={es as never} />,
    );
    expect(html).toContain("Divoox");
    expect(html).toContain("Windoce LLC");
    // `rel="sponsored"`: es de la casa y Google tiene que saberlo.
    expect(html).toMatch(/rel="sponsored/);
    // En una sección donde no tenemos producto, no se pinta nada.
    expect(
      renderToStaticMarkup(<FichaDelSector sectionId="artistas" lang="es" dict={es as never} />),
    ).toBe("");
  });
});
