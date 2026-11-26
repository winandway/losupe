import { describe, expect, it } from "vitest";
import { applySchema } from "@/lib/schema-guard";
import { SCHEMA_SQL } from "@/lib/schema-sql";
import { productoMencionado } from "@/lib/casa/aviso";
import { getProducto } from "@/lib/casa/productos";
import { setArticleStatus } from "@/lib/robot/publish";
import { getSection, NEWS_SECTIONS, SECTIONS } from "@/lib/sections";
import { seccionCoherente } from "@/lib/robot/trends";
import { FakeD1 } from "./fake-d1";
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

/**
 * CANDADO 65 — una nota de periodismo no lleva ningún aviso nuestro (26 nov 2026).
 *
 * Durante dos días, toda nota que nombrara un producto del grupo salía con un párrafo arriba
 * diciendo de quién era la empresa. Richard lo tumbó: _«no hay imparcialidad en eso, estás
 * diciendo: mira, somos los dueños… no veo a Bing poniendo una etiqueta porque Windows es de la
 * casa. Me parece ridículo»_. Tenía razón: un recuadro que anuncia la propiedad llama más la
 * atención sobre el vínculo que la propia mención.
 *
 * La propiedad se declara donde la declara un periódico: en la cabecera. La página de política
 * editorial la dice entera, con todos los productos por su nombre, y el pie dice quién edita el
 * medio. Estas pruebas fijan las dos cosas: que la nota sale limpia y que la cabecera no se queda
 * muda.
 */
describe("una nota de periodismo sale sin ningún aviso nuestro", () => {
  it("y si arrastra uno de los dos días que los llevaron, se le quita al publicarla", async () => {
    const { db, d1 } = await base();
    const viejo =
      '<p class="aviso-casa"><strong>Transparencia:</strong> Divoox es de Windoce LLC, la empresa dueña de Losupe.</p>\n<p>En la región compiten Rappi, PedidosYa y Divoox.</p>';
    nota(db, "n-con-aviso-viejo", viejo, viejo);
    await setArticleStatus(d1, "n-con-aviso-viejo", "published");
    for (const lang of ["es", "en"] as const) {
      const fila = db.raw
        .prepare(`SELECT content_html FROM article_i18n WHERE article_id = ? AND lang = ?`)
        .get("n-con-aviso-viejo", lang) as { content_html: string };
      expect(fila.content_html, lang).not.toContain("aviso-casa");
      expect(fila.content_html, lang).not.toContain("Windoce LLC");
      // Pero el texto de la nota no se toca.
      expect(fila.content_html, lang).toContain("Rappi");
    }
  });

  it("una nota que nos nombra se publica tal cual, sin que nadie le añada nada", async () => {
    const { db, d1 } = await base();
    nota(
      db,
      "n-nombra",
      "<p>En la región compiten Rappi, PedidosYa y Divoox.</p>",
      "<p>Rappi, PedidosYa and Divoox compete in the region.</p>",
    );
    await setArticleStatus(d1, "n-nombra", "published");
    const fila = db.raw
      .prepare(`SELECT content_html FROM article_i18n WHERE article_id = ? AND lang = 'es'`)
      .get("n-nombra") as { content_html: string };
    expect(fila.content_html).toBe("<p>En la región compiten Rappi, PedidosYa y Divoox.</p>");
    const art = db.raw.prepare(`SELECT status FROM articles WHERE id = ?`).get("n-nombra") as {
      status: string;
    };
    expect(art.status).toBe("published");
  });

  it("y la nota de la casa SÍ conserva el suyo: ese es otro aviso y es obligatorio", async () => {
    // No se confunden: «Desde Windoce» es contenido de la casa, no periodismo (candado 57).
    const { avisoHtml, tieneAviso } = await import("@/lib/casa/aviso");
    const divoox = getProducto("divoox")!;
    const cuerpo = `${avisoHtml(divoox, "es")}\n<p>Un texto cualquiera.</p>`;
    expect(tieneAviso(cuerpo, divoox, "es")).toBe(true);
    const { sinLineaDePropiedad } = await import("@/lib/casa/aviso");
    // La limpieza existe, pero `quitarLineaDePropiedad` no la aplica a la sección de la casa.
    expect(sinLineaDePropiedad(cuerpo)).not.toContain("aviso-casa");
  });

  it("la propiedad se declara en la cabecera del medio, no en cada nota", async () => {
    const { es } = await import("@/i18n/es");
    const { en } = await import("@/i18n/en");
    const textoEs = JSON.stringify(es);
    const textoEn = JSON.stringify(en);
    // Quién edita el medio, en el pie, en los dos idiomas.
    expect(textoEs).toContain("Windoce LLC");
    expect(textoEn).toContain("Windoce LLC");
    // Y la política editorial nombra los productos, que es la declaración de verdad.
    expect(textoEs).toContain("Divoox");
    expect(textoEn).toContain("Divoox");
  });

  it("reconoce el nombre entero, no trozos de otra palabra", () => {
    expect(productoMencionado("Divoox abre en Caracas")?.id).toBe("divoox");
    expect(productoMencionado("Hablamos de kipuu y de otras")?.id).toBe("kipuu");
    expect(productoMencionado("DoorDash y Uber Eats")).toBeUndefined();
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
    expect(b).toMatch(/Nada de usuarios, de pedidos ni de planes futuros/);
    expect(b).toMatch(/Si no encaja, NO lo menciones/);
    expect(b).toMatch(/Nunca en el titular/);
    // El aviso lo pone el código, siempre. Si lo escribiera el modelo, un día se le olvidaría.
    expect(b).toMatch(/NO escribas ningún aviso de transparencia/);
  });

  /**
   * CANDADO 64 — fuera de la sección de la casa, ninguna pieza fija nombra un producto nuestro.
   *
   * Al pie de «Delivery y logística» hubo primero una ficha sola de Divoox, y después un directorio
   * de seis empresas con la nuestra dentro. Richard tumbó las dos, y con el mejor argumento: «no
   * necesitamos tener una ficha de cada una de ellas… esa etiqueta de la casa no me interesa que
   * esté allí, me parece vanidoso». Una tabla que escribimos nosotros, donde nos ponemos nosotros,
   * repetida en toda la sección, es el escaparate — y encima nos delata ante Google sola.
   *
   * Lo que queda es lo correcto: las fichas de los productos del grupo viven SOLO en «Desde
   * Windoce», que avisa en cada nota; en las secciones de periodismo nuestro producto aparece
   * únicamente cuando una noticia lo trae, y entonces el código pone la línea de transparencia
   * (candado 61, arriba). La transparencia se queda; el escaparate se va.
   */
  it("fuera de la sección de la casa, ninguna pieza fija nombra un producto del grupo", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    const { PRODUCTOS } = await import("@/lib/casa/productos");

    // Los componentes de la casa SÍ los nombran: ese es su trabajo, y van con su aviso.
    const DE_LA_CASA = ["FichasCasa.tsx", "AvisoCasa.tsx"];
    const tsx = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? tsx(`${dir}/${e.name}`)
          : e.name.endsWith(".tsx") && !DE_LA_CASA.includes(e.name)
            ? [`${dir}/${e.name}`]
            : [],
      );
    const archivos = [...tsx("src/app"), ...tsx("src/components")];
    expect(archivos.length).toBeGreaterThan(20);

    for (const archivo of archivos) {
      const fuente = readFileSync(archivo, "utf8");
      // Solo el código, no los comentarios: este candado se explica nombrando a Divoox.
      const codigo = fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      for (const p of PRODUCTOS) {
        expect(codigo, `${archivo} nombra ${p.nombre} en una pieza fija`).not.toContain(p.nombre);
      }
    }

    // Y el directorio del pie no vuelve por la puerta de atrás.
    expect(readdirSync("src/components")).not.toContain("DirectorioDelSector.tsx");
  });

  it("y la sección del sector no tiene ni un tema sobre un producto nuestro", async () => {
    const { ideasDeSeccion } = await import("@/lib/robot/ideas");
    const { PRODUCTOS } = await import("@/lib/casa/productos");
    const ideas = ideasDeSeccion("delivery");
    for (const p of PRODUCTOS) {
      for (const idea of ideas) {
        expect(
          `${idea.titular} ${idea.busqueda}`,
          `el tema «${idea.titular}» es un folleto, no una noticia del sector`,
        ).not.toContain(p.nombre);
      }
    }
    // Pero el sector sí es ancho: no son cinco apps y sus comisiones.
    expect(ideas.length).toBeGreaterThanOrEqual(70);
    const todo = ideas.map((i) => i.titular).join(" | ");
    for (const empresa of ["inDrive", "Grab", "Meituan", "Swiggy"]) {
      expect(todo, `falta ${empresa} en el sector`).toContain(empresa);
    }
  });
});

describe("el turno manda también en qué fuentes se leen", () => {
  it("las fuentes de la sección del turno se leen PRIMERO", async () => {
    // El día del estreno, el turno de delivery llegó con la cola vacía de su tema y publicó una
    // noticia de bolsa: el robot lee seis fuentes por corrida rotando entre veintinueve, y a las
    // del sector no les había tocado turno todavía.
    const { discoverCandidates } = await import("@/lib/robot/universal");
    const fuentes = [
      ...Array.from({ length: 20 }, (_, i) => ({
        id: `otra-${i}`,
        section_id: "economia",
        name: `Otra ${i}`,
        url: `https://ejemplo.com/${i}`,
        kind: "rss",
        lang: "es",
        weight: 1,
        active: 1,
      })),
      ...["foodondemand", "restaurantdive", "gnews-apps-delivery-en"].map((id) => ({
        id,
        section_id: "delivery",
        name: id,
        url: `https://ejemplo.com/${id}`,
        kind: "rss",
        lang: "en",
        weight: 2,
        active: 1,
      })),
    ];
    const db = new FakeD1((sql) => (sql.includes("FROM sources") ? fuentes : []));
    const pedidas: string[] = [];
    const fetchImpl = (async (u: string) => {
      pedidas.push(String(u));
      return new Response("<rss><channel></channel></rss>");
    }) as unknown as typeof fetch;
    await discoverCandidates(db.asD1(), { fetchImpl, seccion: "delivery" });
    for (const id of ["foodondemand", "restaurantdive", "gnews-apps-delivery-en"]) {
      expect(
        pedidas.some((u) => u.includes(id)),
        id,
      ).toBe(true);
    }
  });
});

describe("un borrador rechazado se corrige, no se pierde el turno", () => {
  it("el redactor tiene TRES intentos, y al segundo ya se le dice qué falló", async () => {
    const { writeDraft } = await import("@/lib/robot/writer");
    const prompts: string[] = [];
    let llamadas = 0;
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      llamadas += 1;
      prompts.push(String(init.body));
      // Las dos primeras suenan a máquina; la tercera sale bien.
      const malo = llamadas < 3;
      const cuerpo = malo
        ? `<p>${"It is crucial to showcase this. Furthermore, it is crucial to underscore the pivotal role. ".repeat(45)}</p>`
        : `<p>${"La empresa subió el precio del reparto. Lo dijo su propio aviso a los restaurantes, y ahí están las cifras. ".repeat(40)}</p>`;
      return Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    es: {
                      title: "Las apps de reparto suben sus comisiones en la región",
                      excerpt:
                        "Qué cambia para el restaurante y para quien pide, con las cifras que publicaron las propias empresas esta semana.",
                      content_html: cuerpo,
                      meta_title: "Las apps de reparto suben comisiones",
                      meta_description:
                        "Qué cambia para el restaurante y para quien pide comida, con las cifras de las propias empresas.",
                      tags: ["delivery", "comisiones", "restaurantes"],
                    },
                    en: {
                      title: "Delivery apps raise their fees across the region",
                      excerpt:
                        "What changes for restaurants and for the people ordering, with the figures the companies published this week.",
                      content_html: cuerpo,
                      meta_title: "Delivery apps raise their fees",
                      meta_description:
                        "What changes for restaurants and for people ordering food, with the companies own figures.",
                      tags: ["delivery", "fees", "restaurants"],
                    },
                    kind: "news",
                    image_prompt: "A delivery rider waiting outside a small restaurant at dusk",
                    image_alt_es: "Un repartidor espera fuera de un restaurante",
                    image_alt_en: "A delivery rider waits outside a restaurant",
                    image_keywords: ["delivery", "rider"],
                  }),
                },
              ],
            },
          },
        ],
        usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 10 },
      });
    }) as unknown as typeof fetch;

    const r = await writeDraft("ENCARGO: nota para la sección Delivery y logística.", [], {
      apiKey: "k",
      fetchImpl,
    });
    // Tres intentos disponibles: con dos se perdía el turno entero (25 nov 2026).
    expect(r.attempts).toBe(3);
    // Y al modelo se le dijo QUÉ falló, no se le repitió el mismo encargo.
    expect(prompts[1]).toContain("AVISO IMPORTANTE");
    expect(prompts[1]).toContain("Escríbelo OTRA VEZ desde cero");
    expect(prompts[2]).toContain("ÚLTIMO intento");
  });
});

describe("una nota sobre nada no se publica", () => {
  it("caza el relleno: «no se han detallado» + «probablemente»", async () => {
    const { pareceNotaSobreNada } = await import("@/lib/robot/writer");
    // El texto real de la primera nota del segmento, 25 nov 2026.
    const real =
      "La plataforma Food On Demand ha publicado su Encuesta de la Semana del 24 de noviembre. " +
      "Aunque los resultados específicos no se han detallado, el sondeo probablemente explora las " +
      "tendencias y desafíos del servicio de catering para fiestas.";
    expect(pareceNotaSobreNada(real)).toContain("no se conocen los datos");
    expect(
      pareceNotaSobreNada("Not yet disclosed. The survey likely explores the trends."),
    ).not.toBeNull();
  });

  it("y NO se lleva por delante una nota legítima a la que solo le falta un dato", async () => {
    const { pareceNotaSobreNada } = await import("@/lib/robot/writer");
    const buena =
      "DoorDash subió su comisión al 15 % para los restaurantes de Miami, según el aviso que mandó " +
      "el lunes. No se conoce el monto que esto le suma al año, pero la compañía dijo que afecta a " +
      "unos 4.000 locales y que entra en vigor el 1 de enero. Los dueños consultados calculan entre " +
      "200 y 400 dólares más al mes.";
    expect(pareceNotaSobreNada(buena)).toBeNull();
    expect(pareceNotaSobreNada("Uber Eats llega a Maracaibo con 300 restaurantes.")).toBeNull();
  });
});

describe("la ficha de nuestro producto caduca sola cuando su página cambia", () => {
  it("si la frase vigilada desaparece, la ficha queda marcada como vencida", async () => {
    const { comprobarFicha, vigilarFichas, fichasVencidas } =
      await import("@/lib/casa/vigilar-ficha");
    const { getProducto } = await import("@/lib/casa/productos");
    const divoox = getProducto("divoox")!;
    expect(divoox.vigilar?.url).toContain("venezuela");

    // La página ya NO dice «coming soon»: abrieron.
    const abierta = (async () =>
      new Response("<h1>Divoox ya está en Caracas</h1>")) as unknown as typeof fetch;
    expect(await comprobarFicha(divoox, abierta)).toContain("ya NO dice");

    // Y mientras diga «coming soon», no se marca nada.
    const aun = (async () =>
      new Response("<h1>Coming soon to Venezuela</h1>")) as unknown as typeof fetch;
    expect(await comprobarFicha(divoox, aun)).toBeNull();

    const { db, d1 } = await base();
    const hoy = new Date("2026-11-25T12:00:00Z");
    await vigilarFichas(d1, { fetchImpl: abierta, now: hoy });
    expect(Object.keys(await fichasVencidas(d1))).toContain("divoox");
    // Y cuando alguien relee la ficha y la página vuelve a cuadrar, la marca se va sola.
    await vigilarFichas(d1, { fetchImpl: aun, now: hoy });
    expect(await fichasVencidas(d1)).toEqual({});
    expect(
      db.raw.prepare(`SELECT count(*) AS n FROM settings WHERE key LIKE 'ficha_vencida_%'`).get(),
    ).toEqual({ n: 0 });
  });

  it("si la página no responde, NO se concluye nada (una caída no es un cambio)", async () => {
    const { comprobarFicha } = await import("@/lib/casa/vigilar-ficha");
    const { getProducto } = await import("@/lib/casa/productos");
    const caida = (async () => {
      throw new Error("sin red");
    }) as unknown as typeof fetch;
    expect(await comprobarFicha(getProducto("divoox")!, caida)).toBeNull();
    const error500 = (async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    expect(await comprobarFicha(getProducto("divoox")!, error500)).toBeNull();
  });

  it("con la ficha vencida, el redactor deja de recibir sus datos", async () => {
    const { bloqueCasaEnElSector } = await import("@/lib/robot/writer");
    expect(bloqueCasaEnElSector("delivery")).toContain("Divoox");
    // Antes que escribir datos viejos de nuestro propio producto, no se nombra.
    expect(bloqueCasaEnElSector("delivery", { divoox: "su página cambió" })).toBe("");
  });
});

describe("una ficha también caduca por tiempo, y avisa antes de apagarse", () => {
  it("vale un mes desde que se leyó su página, y una fecha ilegible cuenta como vencida", async () => {
    const { fichaCaduca, DIAS_DE_VIDA_DE_UNA_FICHA } = await import("@/lib/casa/vigilar-ficha");
    const { getProducto } = await import("@/lib/casa/productos");
    const p = getProducto("divoox")!;
    const leida = new Date(`${p.verificado}T00:00:00Z`).getTime();
    const dia = 86_400_000;

    // Recién leída y el día antes de cumplir el mes: sirve.
    expect(fichaCaduca(p, new Date(leida + dia))).toBeNull();
    expect(fichaCaduca(p, new Date(leida + (DIAS_DE_VIDA_DE_UNA_FICHA - 1) * dia))).toBeNull();
    // El día que cumple el mes: vencida, y el motivo dice qué hacer.
    const motivo = fichaCaduca(p, new Date(leida + DIAS_DE_VIDA_DE_UNA_FICHA * dia));
    expect(motivo).toContain("volver a leer");
    expect(motivo).toContain(p.url);
    // Una ficha sin fecha legible no se da por buena.
    expect(fichaCaduca({ ...p, verificado: "cuando sea" }, new Date(leida))).toContain("no dice");
  });

  it("avisa una semana antes, para releerla sin urgencia", async () => {
    const { fichasPorCaducar, DIAS_DE_VIDA_DE_UNA_FICHA, DIAS_DE_AVISO } =
      await import("@/lib/casa/vigilar-ficha");
    const { getProducto } = await import("@/lib/casa/productos");
    const leida = new Date(`${getProducto("divoox")!.verificado}T00:00:00Z`).getTime();
    const dia = 86_400_000;

    // Recién leída, nadie en la lista de aviso.
    expect(fichasPorCaducar(new Date(leida + dia)).divoox).toBeUndefined();
    // En la ventana de aviso, sale con los días que le quedan.
    const casi = new Date(leida + (DIAS_DE_VIDA_DE_UNA_FICHA - DIAS_DE_AVISO) * dia);
    expect(fichasPorCaducar(casi).divoox).toBe(DIAS_DE_AVISO);
    // Ya vencida, deja de ser un aviso: es un fallo, y lo cuenta `fichaCaduca`.
    expect(
      fichasPorCaducar(new Date(leida + (DIAS_DE_VIDA_DE_UNA_FICHA + 5) * dia)).divoox,
    ).toBeUndefined();
  });

  it("la rotación de la casa se salta el producto con ficha vencida", async () => {
    const { siguienteTurno } = await import("@/lib/casa/paso-diario");
    const { PRODUCTOS } = await import("@/lib/casa/productos");
    const primero = siguienteTurno(0)!.producto.id;
    expect(primero).toBe("divoox");
    // Con la ficha vencida le toca al siguiente, no se escribe con datos viejos.
    expect(siguienteTurno(0, { divoox: "vencida" })!.producto.id).toBe(PRODUCTOS[1]!.id);
    // Y si TODAS están vencidas, ese día no se escribe nada de la casa.
    const todas = Object.fromEntries(PRODUCTOS.map((p) => [p.id, "vencida"]));
    expect(siguienteTurno(0, todas)).toBeNull();
  });

  it("no escribe en la base si el estado de la ficha no cambió", async () => {
    const { vigilarFichas } = await import("@/lib/casa/vigilar-ficha");
    const { d1 } = await base();
    const abierta = (async () =>
      new Response("<h1>Divoox ya está en Caracas</h1>")) as unknown as typeof fetch;
    const hoy = new Date("2026-11-25T12:00:00Z");

    // Se cuentan las sentencias que ESCRIBEN: mirar la fecha no sirve, las dos vueltas caen en el
    // mismo segundo. Con diez productos y once corridas al día, un borrado a ciegas por producto
    // serían más de cien escrituras diarias para no decir nada.
    const sentencias: string[] = [];
    const original = d1.prepare.bind(d1);
    const espiado = Object.assign(Object.create(Object.getPrototypeOf(d1) as object), d1, {
      prepare: (sql: string) => {
        sentencias.push(sql);
        return original(sql);
      },
    }) as D1Database;
    const escrituras = () =>
      sentencias.filter((q) => /(INSERT INTO|DELETE FROM|UPDATE)\s+settings/i.test(q)).length;

    await vigilarFichas(espiado, { fetchImpl: abierta, now: hoy });
    const primera = escrituras();
    expect(primera).toBe(1);

    // Segunda vuelta con el mismo resultado: ni una escritura más.
    await vigilarFichas(espiado, { fetchImpl: abierta, now: hoy });
    expect(escrituras()).toBe(primera);
  });

  it("la ficha ya no obliga a decir que todavía no opera en ningún sitio", async () => {
    const { getProducto } = await import("@/lib/casa/productos");
    const { bloqueCasaEnElSector } = await import("@/lib/robot/writer");
    const divoox = getProducto("divoox")!;
    // El fallo: el «cuidado» decía «no decir que ya opera», y el modelo escribía «no opera».
    expect(divoox.cuidado).not.toMatch(/No decir que ya opera/i);
    expect(divoox.cuidado).toMatch(/ni que ya opera ni que todav/i);
    const bloque = bloqueCasaEnElSector("delivery");
    expect(bloque).not.toMatch(/ciudades ya funcionando/);
    expect(bloque).toMatch(/NO digas en qu[ée] etapa est[áa]/);
  });
  it("en una nota del sector, nuestra app no dice en qué etapa está en ningún país", async () => {
    const { bloqueCasaEnElSector } = await import("@/lib/robot/writer");
    const { promptCasa } = await import("@/lib/casa/paso-diario");
    const { getProducto } = await import("@/lib/casa/productos");
    const divoox = getProducto("divoox")!;

    // La etapa vive aparte de los datos, para poder dársela a una y no a la otra.
    expect(divoox.etapa?.es).toMatch(/pr[óo]ximamente/i);
    expect(divoox.datos.es.join(" ")).not.toMatch(/pr[óo]ximamente/i);
    expect(divoox.datos.en.join(" ")).not.toMatch(/coming soon/i);

    // El sector: la frase de la etapa no llega, y se prohíbe decirla en cualquier dirección.
    const sector = bloqueCasaEnElSector("delivery");
    expect(sector).not.toContain(divoox.etapa!.es);
    expect(sector).not.toMatch(/Miami, Orlando, Tampa/);
    expect(sector).not.toMatch(/Caracas/);
    expect(sector).toMatch(/NO digas en qu[ée] etapa est[áa]/);
    expect(sector).toMatch(/por lo que hace, no por d[óo]nde est/);

    // La nota de la casa (un lanzamiento) sí la cuenta: ahí la etapa es el tema.
    expect(promptCasa(divoox, "lanzamiento")).toMatch(
      /En qu[ée] etapa est[áa], seg[úu]n su p[áa]gina/,
    );
  });
});
