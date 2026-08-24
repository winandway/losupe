import { expect, test } from "@playwright/test";

// Prueba de humo: las rutas principales responden 200 en el worker real con la base local.
const ROUTES_200 = [
  "/es",
  "/en",
  "/es/cripto",
  "/en/crypto",
  "/es/economia",
  "/en/economy",
  "/es/autor/kevin-rondon",
  "/en/author/kevin-rondon",
  "/es/buscar?q=bitcoin",
  "/en/search?q=bitcoin",
  "/es/acerca",
  "/en/about",
  "/es/rss.xml",
  "/en/rss.xml",
  "/sitemap.xml",
  "/news-sitemap.xml",
  "/robots.txt",
  "/icon.png",
  "/apple-icon.png",
  "/opengraph-image.png",
  "/favicon.ico",
  "/video/hero-v2.mp4",
  "/video/hero-v2-m.mp4",
  "/video/hero-v2-poster.jpg",
  "/datos/buscar?q=bit&lang=es",
  "/es/autor/andreea-blidar",
  "/es/autor/merry-melina",
  "/es/autor/pedro-llerena",
  "/img/autores/andreea-blidar.jpg",
  "/es/publica",
  "/en/publish",
  "/es/ventas/un-venezolano-lanza-mercatren-tienda-en-linea-1-3-millones-de-productos-estados-unidos",
  "/en/sales/venezuelan-entrepreneur-launches-mercatren-online-store-1-3-million-products-united-states",
  "/img/notas/mercatren/home.jpg",
  "/llms.txt",
  "/manifest.webmanifest",
  "/.well-known/api-catalog",
  "/.well-known/ai-catalog.json",
  "/.well-known/agent-skills/index.json",
  "/.well-known/agent-skills/losupe-news/SKILL.md",
  "/es/politica-editorial",
  "/en/editorial-policy",
  "/es/privacidad",
  "/en/privacy",
  "/es/terminos",
  "/en/terms",
];

for (const route of ROUTES_200) {
  test(`GET ${route} → 200`, async ({ request }) => {
    const res = await request.get(route);
    expect(res.status(), route).toBe(200);
  });
}

test("rutas desconocidas dan 404 de verdad (no la portada)", async ({ request }) => {
  for (const p of ["/auth.md", "/foo.txt", "/cualquier-cosa", "/es/nada-de-nada"]) {
    const res = await request.get(p, { maxRedirects: 5 });
    expect(res.status(), p).toBe(404);
  }
});

test("cada nota lleva al pie la ficha de quien la escribió, con su foto", async ({ page }) => {
  await page.goto("/es");
  const href = await page.locator("main article h2 a").first().getAttribute("href");
  await page.goto(href!);
  const ficha = page.getByRole("complementary").filter({ hasText: "Quién escribió esta nota" });
  await expect(ficha).toBeVisible();
  const firma = await page.locator("article header a[href^='/es/autor/']").first().innerText();
  // Hay dos enlaces a su ficha: la foto y el nombre.
  await expect(ficha.getByRole("link", { name: firma })).toHaveCount(2);
  await expect(ficha.getByRole("img", { name: firma })).toBeVisible();
  await expect(ficha.getByRole("img", { name: firma })).toHaveClass(/rounded-full/);
  await expect(ficha.getByRole("link", { name: /Todas sus notas/ })).toBeVisible();
  // Magaly Molina no aparece en ninguna parte del sitio
  await expect(page.getByText(/Magaly/i)).toHaveCount(0);
});

test("el equipo de redacción: fotos, fichas y la firma de cada nota", async ({ page }) => {
  // Los tres escritores aparecen en «Acerca» con su foto y su ficha
  await page.goto("/es/acerca");
  await expect(page.getByRole("heading", { name: "Quién escribe" })).toBeVisible();
  for (const nombre of ["Andreea Blidar", "Merry Melina", "Pedro Llerena"]) {
    const enlace = page.getByRole("link", { name: nombre });
    await expect(enlace).toBeVisible();
    await expect(page.getByRole("img", { name: nombre })).toBeVisible();
  }
  // Magaly Molina ya no forma parte del equipo
  await expect(page.getByText("Magaly Molina")).toHaveCount(0);

  // Ficha del autor: foto redonda, cargo, biografía y sus notas
  await page.goto("/es/autor/merry-melina");
  await expect(page.getByRole("heading", { level: 1, name: "Merry Melina" })).toBeVisible();
  const foto = page.getByRole("img", { name: "Merry Melina" }).first();
  await expect(foto).toHaveAttribute("src", "/img/autores/merry-melina.jpg");
  await expect(foto).toHaveClass(/rounded-full/);
  await expect(page.getByText(/Artistas, tendencias y negocios/)).toBeVisible();

  // La nota de Mercatren la firma Merry (Pedro Llerena es el protagonista: no puede firmarla)
  const nota =
    "/es/ventas/un-venezolano-lanza-mercatren-tienda-en-linea-1-3-millones-de-productos-estados-unidos";
  await page.goto(nota);
  await expect(page.locator("article").getByRole("link", { name: "Merry Melina" })).toBeVisible();
  await expect(page.locator("article").getByText("Magaly Molina")).toHaveCount(0);
});

test("boletín: alta desde la portada, sin apuntar a nadie sin confirmar", async ({
  page,
  request,
}) => {
  await page.goto("/es");
  const boletin = page.locator("#boletin");
  await boletin.scrollIntoViewIfNeeded();
  await expect(boletin.getByRole("heading", { name: /Recibe las notas/ })).toBeVisible();
  await boletin.getByPlaceholder("Tu correo electrónico").fill(`prueba+${Date.now()}@example.com`);
  await boletin.getByRole("button", { name: "Quiero recibirlas" }).click();
  // Sin correo configurado en local, el sitio lo dice en claro (no falla en silencio)
  await expect(page.getByRole("status")).toBeVisible();
  await expect(page).toHaveURL(/boletin=/);

  // Un correo mal escrito no pasa la validación del servidor
  const malo = await request.post("/datos/boletin", {
    form: { email: "no-es-correo", lang: "es" },
    maxRedirects: 0,
  });
  expect(malo.status()).toBe(303);
  expect(malo.headers()["location"]).toContain("boletin=invalido");

  // Un enlace de confirmación inventado no da de alta a nadie
  const falso = await request.get("/datos/boletin?alta=inventado", { maxRedirects: 0 });
  expect(falso.headers()["location"]).toContain("boletin=invalido");
});

test("panel: se puede escribir una nota a mano y los avisos por correo se configuran", async ({
  page,
}) => {
  await page.goto("/panel/accion/idioma?lang=es");
  await page.goto("/panel/entrar");
  await page.getByLabel("Contraseña", { exact: true }).fill("losupe-panel-local");
  await page.getByRole("button", { name: "Entrar" }).click();

  // La pestaña Escribir existe y el formulario pide lo necesario
  await page.goto("/panel/escribir");
  await expect(page.getByRole("heading", { name: "Escribir una nota" })).toBeVisible();
  await expect(page.getByText("Le doy el tema y mis apuntes")).toBeVisible();
  await expect(page.getByText("Ya la escribí yo")).toBeVisible();
  await expect(page.getByLabel("Titular")).toBeVisible();
  await expect(page.getByLabel("Firma")).toBeVisible();
  // Sin GEMINI_API_KEY en local, avisa claro en vez de fallar en silencio
  await page.getByLabel("Titular").fill("Una nota de prueba escrita a mano por la redacción");
  await page
    .getByLabel("El texto o tus apuntes")
    .fill(
      "Esto es una prueba con texto suficiente para pasar la validación mínima del formulario.",
    );
  await page.getByRole("button", { name: "Crear la nota" }).click();
  await expect(page.getByRole("alert")).toContainText(/GEMINI_API_KEY/);

  // Los correos de aviso se guardan y no se muestran en el sitio público
  await page.goto("/panel");
  const correos = page.getByLabel(/Correos del equipo/);
  await correos.fill("aviso1@example.com, aviso2@example.com");
  await page.getByRole("button", { name: "Guardar correos" }).click();
  await expect(page.getByText("Correos guardados.")).toBeVisible();
  await expect(page.getByLabel(/Correos del equipo/)).toHaveValue(
    "aviso1@example.com\naviso2@example.com",
  );
  await page.goto("/es");
  await expect(page.getByText("aviso1@example.com")).toHaveCount(0);
});

test("los mapas del sitio son válidos para Google (XML, rutas y cabeceras)", async ({
  request,
}) => {
  const res = await request.get("/sitemap.xml", { headers: { "user-agent": "Googlebot/2.1" } });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("xml");
  // Se cachea y NO lleva el `Vary` de Next (confunde a buscadores y cachés)
  expect(res.headers()["cache-control"]).toContain("max-age=600");
  expect(res.headers()["vary"]).toBeUndefined();
  const xml = await res.text();
  expect(xml.startsWith("<?xml")).toBe(true);
  expect(xml).toContain("http://www.sitemaps.org/schemas/sitemap/0.9");
  // Sin caracteres que rompan el XML y sin URLs de otro dominio
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  expect(locs.length).toBeGreaterThan(20);
  expect(new Set(locs).size).toBe(locs.length);
  expect(locs.every((l) => l.startsWith("http"))).toBe(true);
  expect(xml.replace(/&(amp|lt|gt|quot|apos|#\d+);/g, "")).not.toContain("&");
  // Las páginas que dan dinero y las secciones tienen que estar
  for (const path of ["/es", "/en", "/es/publica", "/en/publish", "/es/cripto", "/en/crypto"]) {
    expect(locs.some((l) => l.endsWith(path))).toBe(true);
  }
  // Nada que robots.txt bloquee
  expect(locs.some((l) => l.includes("?q=") || l.includes("/__"))).toBe(false);

  const news = await request.get("/news-sitemap.xml", {
    headers: { "user-agent": "Googlebot-News/1.0" },
  });
  expect(news.status()).toBe(200);
  expect((await news.text()).startsWith("<?xml")).toBe(true);

  const robots = await request.get("/robots.txt");
  const txt = await robots.text();
  expect(txt).toMatch(/^Sitemap: https?:\/\/\S+\/sitemap\.xml$/m);
  expect(txt).toMatch(/^Sitemap: https?:\/\/\S+\/news-sitemap\.xml$/m);
});

test("datos estructurados: la nota se declara como noticia con su editor, autor y fuentes", async ({
  page,
}) => {
  await page.goto("/es");
  const href = await page.locator("main article h2 a").first().getAttribute("href");
  await page.goto(href!);
  const bloques = await page.locator('script[type="application/ld+json"]').allTextContents();
  const datos = bloques.map((b) => JSON.parse(b));
  const nota = datos.find((d) => d["@type"] === "NewsArticle" || d["@type"] === "Article");
  expect(nota).toBeTruthy();
  expect(nota.headline.length).toBeLessThanOrEqual(110);
  expect(nota.publisher["@type"]).toBe("NewsMediaOrganization");
  expect(nota.author.url).toContain("/es/autor/");
  expect(nota.wordCount).toBeGreaterThan(100);
  expect(nota.speakable).toBeTruthy();
  expect(nota.isAccessibleForFree).toBe(true);
  expect(datos.some((d) => d["@type"] === "BreadcrumbList")).toBe(true);
  // Enlace interno dentro del texto («Sigue leyendo»), que reparte autoridad entre nuestras notas
  const dentro = page.locator("article aside a[href^='/es/']");
  if ((await dentro.count()) > 0) {
    await expect(dentro.first()).toBeVisible();
  }

  // Portada y sección declaran su lista de notas
  await page.goto("/es");
  const portada = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
    (b) => JSON.parse(b),
  );
  expect(portada.some((d) => d["@type"] === "NewsMediaOrganization")).toBe(true);
  const lista = portada.find((d) => d["@type"] === "CollectionPage");
  expect(lista?.mainEntity?.itemListElement?.length).toBeGreaterThan(0);
  await page.goto("/es/cripto");
  const seccion = (await page.locator('script[type="application/ld+json"]').allTextContents()).map(
    (b) => JSON.parse(b),
  );
  expect(seccion.some((d) => d["@type"] === "CollectionPage")).toBe(true);
  expect(seccion.some((d) => d["@type"] === "BreadcrumbList")).toBe(true);
});

test("señales para buscadores y agentes de IA", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  const robotsTxt = await robots.text();
  expect(robots.headers()["content-type"]).toContain("text/plain");
  expect(robotsTxt).toContain("Content-Signal: search=yes, ai-input=yes, ai-train=no");
  expect(robotsTxt).toContain("User-agent: GPTBot");
  expect(robotsTxt).toContain("Sitemap: ");

  const llms = await request.get("/llms.txt");
  expect(llms.headers()["content-type"]).toContain("text/plain");
  expect(await llms.text()).toContain("# losupe");

  const catalog = await request.get("/.well-known/api-catalog");
  expect(catalog.headers()["content-type"]).toContain("application/linkset+json");
  expect(((await catalog.json()) as { linkset: unknown[] }).linkset.length).toBe(1);

  const skills = await request.get("/.well-known/agent-skills/index.json");
  expect(((await skills.json()) as { skills: { sha256: string }[] }).skills[0]?.sha256).toMatch(
    /^[0-9a-f]{64}$/,
  );

  const html = await request.get("/es");
  expect(html.headers()["link"]).toContain('rel="api-catalog"');
  expect(html.headers()["link"]).toContain('type="text/markdown"');
  expect(html.headers()["content-security-policy"]).toContain("static.cloudflareinsights.com");

  const md = await request.get("/es", { headers: { accept: "text/markdown" } });
  expect(md.headers()["content-type"]).toContain("text/markdown");
  expect(md.headers()["x-markdown-tokens"]).toMatch(/^\d+$/);
  expect(await md.text()).toContain("# losupe");

  const story = await request.get(
    "/es/ventas/un-venezolano-lanza-mercatren-tienda-en-linea-1-3-millones-de-productos-estados-unidos",
    { headers: { accept: "text/markdown" } },
  );
  expect(story.headers()["content-type"]).toContain("text/markdown");
  expect(await story.text()).toContain("# «Dejamos el miedo a un lado»");

  const img = await request.get("/img/notas/mercatren/home.jpg");
  expect(img.headers()["cache-control"]).toContain("max-age=86400");
});

test("buscador: sugerencias, sinónimos y acentos", async ({ request }) => {
  const bit = (await (await request.get("/datos/buscar?q=bit&lang=es")).json()) as {
    items: { title: string; url: string }[];
  };
  expect(bit.items.length).toBeGreaterThan(0);
  expect(bit.items.some((i) => /bitcoin/i.test(i.title))).toBe(true);
  // "btc" → bitcoin (sinónimo); "dolar" sin acento → "dólares"; "mer" → Mercatren
  const btc = (await (await request.get("/datos/buscar?q=btc&lang=es")).json()) as {
    items: { title: string }[];
  };
  expect(btc.items.some((i) => /bitcoin/i.test(i.title))).toBe(true);
  const dolar = (await (await request.get("/datos/buscar?q=dolar&lang=es")).json()) as {
    items: unknown[];
  };
  expect(dolar.items.length).toBeGreaterThan(0);
  const mer = (await (await request.get("/datos/buscar?q=mer&lang=en")).json()) as {
    items: { url: string }[];
  };
  expect(mer.items.some((i) => i.url.includes("mercatren"))).toBe(true);
  const bad = await request.get("/datos/buscar?q=&lang=es");
  expect(bad.status()).toBe(400);
  const page = await request.get("/es/buscar?q=btc");
  expect(await page.text()).toContain("Bitcoin");
});

/** Candado: la sugerencia tiene que ser lo que está arriba de todo en su punto central (nada la tapa). */
async function topmostIsInside(page: import("@playwright/test").Page, container: string) {
  return page.evaluate((sel) => {
    const box = document.querySelector(sel);
    const opt = box?.querySelector('[role="option"]');
    if (!box || !opt) return { ok: false, why: "sin opción" };
    const r = opt.getBoundingClientRect();
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { ok: !!el && box.contains(el), why: el?.tagName ?? "nada" };
  }, container);
}

test("buscador del frente: escribe y sugiere sin enviar (escritorio: desplegable; celular: hoja completa)", async ({
  page,
  isMobile,
}) => {
  await page.goto("/es");
  // Candado: se simula un navegador con «modo oscuro forzado», que mete un `filter` al hero y a las
  // fotos. Eso convierte al hero en una capa cerrada y fue lo que dejó las sugerencias DEBAJO de la
  // foto de la nota principal en el celular de Richard (23 ago 2026). Con el portal no debe pasar.
  await page.addStyleTag({
    content:
      "main > section:first-of-type { filter: invert(1) hue-rotate(180deg); } main img { filter: invert(1) hue-rotate(180deg); }",
  });
  const box = page.getByRole("combobox").first();
  if (isMobile) {
    // En celular, tocar la caja abre la búsqueda a pantalla completa (sobre todo lo demás).
    await box.click();
    const sheet = page.getByRole("dialog", { name: "Buscar" });
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText("Escribe y te vamos sugiriendo notas.");
    const sheetInput = sheet.getByRole("combobox");
    await expect(sheetInput).toBeFocused();
    await sheetInput.fill("merca");
    const list = sheet.getByRole("listbox");
    await expect(list).toBeVisible();
    await expect(list.getByRole("option").first()).toContainText(/Mercatren/i);
    const vp = page.viewportSize()!;
    const b = (await sheet.boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(vp.width - 1);
    expect(b.height).toBeGreaterThanOrEqual(vp.height - 1);
    expect(await topmostIsInside(page, '[role="dialog"]')).toMatchObject({ ok: true });
    // Cerrar con la flecha y volver a abrir escribiendo
    await sheet.getByRole("button", { name: "Cerrar la búsqueda" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/es$/);
    await box.click();
    await page.getByRole("dialog").getByRole("combobox").fill("merca");
    await page.getByRole("dialog").getByRole("option").first().click();
    await expect(page).toHaveURL(/\/es\/ventas\/un-venezolano-lanza-mercatren/);
    return;
  }
  await box.fill("merca");
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  await expect(list.getByRole("option").first()).toContainText(/Mercatren/i);
  // El desplegable vive fuera del hero (portal en body) y nada lo tapa
  expect(
    await page.evaluate(() => document.querySelector('[role="listbox"]')?.parentElement?.tagName),
  ).toBe("BODY");
  expect(await topmostIsInside(page, '[role="listbox"]')).toMatchObject({ ok: true });
  await box.press("ArrowDown");
  await box.press("Enter");
  await expect(page).toHaveURL(/\/es\/ventas\/un-venezolano-lanza-mercatren/);
});

test("celular: barra fija con logo, menú hamburguesa y secciones", async ({ page, isMobile }) => {
  test.skip(!isMobile, "solo celular");
  await page.goto("/es");
  const menuBtn = page.getByRole("button", { name: "Menú" });
  await expect(menuBtn).toBeVisible();
  // La barra del logo sigue visible después de bajar
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(300);
  await expect(page.getByRole("link", { name: "losupe — Portada" }).first()).toBeInViewport();
  await menuBtn.click();
  const dialog = page.getByRole("dialog", { name: "Menú" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: "English" })).toHaveAttribute("href", "/en");
  await dialog.getByRole("link", { name: "Cripto" }).click();
  await expect(page).toHaveURL(/\/es\/cripto$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("portada en celular: lista compacta de «Lo último» y sin notas repetidas", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "solo celular");
  await page.goto("/es");
  // Las tarjetas de «Lo último» son filas: la miniatura mide poco más de 100 px de ancho
  const thumb = page
    .locator('section[aria-label="Lo último"] article a[aria-hidden="true"]')
    .first();
  const tb = (await thumb.boundingBox())!;
  expect(tb.width).toBeLessThan(130);
  // Ninguna nota aparece dos veces en la portada
  const hrefs = await page
    .locator("main article h2 a, main article h3 a")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(new Set(hrefs).size).toBe(hrefs.length);
});

test("la raíz redirige al idioma del navegador", async ({ request }) => {
  const es = await request.get("/", {
    maxRedirects: 0,
    headers: { "accept-language": "es-CO,es;q=0.9" },
  });
  expect(es.status()).toBe(307);
  expect(es.headers()["location"]).toMatch(/\/es$/);
  const en = await request.get("/", {
    maxRedirects: 0,
    headers: { "accept-language": "en-US,en;q=0.9" },
  });
  expect(en.headers()["location"]).toMatch(/\/en$/);
});

test("cabeceras de seguridad presentes", async ({ request }) => {
  const res = await request.get("/es");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("default-src 'self'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("/__health reporta la base en verde", async ({ request }) => {
  const res = await request.get("/__health");
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { ok: boolean; db: { binding: boolean; articles: number } };
  expect(body.ok).toBe(true);
  expect(body.db.binding).toBe(true);
  expect(body.db.articles).toBeGreaterThan(0);
});

test("el robot solo responde al programador", async ({ request }) => {
  const denied = await request.get("/__scheduled?key=incorrecta");
  expect(denied.status()).toBe(404);
  const ok = await request.get("/__scheduled", { headers: { "x-yad-cron": "1" } });
  expect(ok.status()).toBe(200);
  const body = (await ok.json()) as { ok: boolean; status: string };
  expect(body.ok).toBe(true);
  expect(["skipped", "pending"]).toContain(body.status);
});

test("portada: franja de video, buscador grande y botonera", async ({ page }) => {
  await page.goto("/es");
  await expect(page.locator('video source[src^="/video/hero-v2"]')).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lo que pasa, explicado.");
  await expect(page.getByPlaceholder("¿Qué quieres saber hoy?")).toBeVisible();
  const botonera = page.getByRole("navigation", { name: "Secciones" });
  await expect(botonera.getByRole("link", { name: "Portada" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(botonera.getByRole("link", { name: "Cripto" })).toHaveAttribute(
    "href",
    "/es/cripto",
  );
});

test("portada: noticias heredadas, selector de idioma y artículo abre", async ({ page }) => {
  await page.goto("/es");
  await expect(page.getByRole("link", { name: "English" })).toHaveAttribute("href", /^\/en/);
  await expect(page.getByRole("link", { name: "Windoce LLC" })).toHaveAttribute(
    "href",
    "https://windoce.com",
  );
  const first = page.locator("article h2 a, article h3 a").first();
  await expect(first).toBeVisible();
  const href = await first.getAttribute("href");
  expect(href).toMatch(/^\/es\/[a-z]+\/[a-z0-9-]+$/);
  await page.goto(href!);
  await expect(page.locator("article h1")).toBeVisible();
  await expect(page.locator('script[type="application/ld+json"]').first()).toHaveCount(1);
});

test("la nota de Mercatren es la principal, firmada por el equipo y con aviso de IA", async ({
  page,
}) => {
  await page.goto("/es");
  const hero = page.locator("article").first();
  await expect(hero.locator("h2 a")).toHaveText(/un venezolano lanza Mercatren/);
  await expect(hero.locator("h2 a")).not.toHaveText(/Amazon|Pedro/);
  await expect(hero.getByRole("link", { name: "Merry Melina" })).toHaveAttribute(
    "href",
    "/es/autor/merry-melina",
  );
  await page.goto(
    "/es/ventas/un-venezolano-lanza-mercatren-tienda-en-linea-1-3-millones-de-productos-estados-unidos",
  );
  await expect(page.locator("article h1")).toHaveText(/Dejamos el miedo a un lado/);
  await expect(page.locator("article h1")).not.toHaveText(/Amazon/);
  await expect(page.locator("article .prose figure img").first()).toBeVisible();
  await expect(page.getByText("Redacción asistida por inteligencia artificial")).toBeVisible();
  await expect(page.getByRole("link", { name: "Mercatren — sitio oficial" })).toHaveAttribute(
    "href",
    "https://mercatren.com/es",
  );
});

test("publica tu noticia: el pedido llega al panel y se convierte en encargo", async ({ page }) => {
  await page.goto("/panel/accion/idioma?lang=es");
  await page.goto("/es/publica");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Publica");
  await expect(page.getByText("El más pedido")).toBeVisible();
  const company = `Panadería Prueba ${Date.now()}`;
  await page.getByLabel("Nombre de tu empresa").fill(company);
  await page.getByLabel("Sitio web (con https://)").fill("https://example.com");
  await page.getByLabel("Correo electrónico").fill("prueba@example.com");
  await page.getByLabel("Paquete").selectOption("basica");
  await page.getByLabel("Cuéntanos de tu empresa").fill("Vendemos pan artesanal a domicilio.");
  await page.getByRole("button", { name: "Enviar mi pedido" }).click();
  await expect(page).toHaveURL(/\/es\/publica\?estado=ok$/);
  await expect(page.getByRole("heading", { name: /Recibimos tu pedido/ })).toBeVisible();

  // Aparece en el panel y se manda a la cola
  await page.goto("/panel/entrar");
  await page.getByLabel("Contraseña", { exact: true }).fill("losupe-panel-local");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.goto("/panel/pedidos");
  const row = page.locator("tr", { hasText: company });
  await expect(row).toBeVisible();
  await expect(row.getByText("Nuevo")).toBeVisible();
  await row.getByRole("button", { name: "Marcar pagado" }).click();
  await expect(page.getByText("Pedido marcado como pagado.")).toBeVisible();
  await page
    .locator("tr", { hasText: company })
    .getByRole("button", { name: "Mandar a la cola" })
    .click();
  await expect(page).toHaveURL(/\/panel\/encargos\/[0-9a-f-]+\?ok=created$/);
  await expect(page.getByRole("heading", { name: company })).toBeVisible();
  await expect(page.getByText(/En cola/).first()).toBeVisible();
  // El pedido queda enlazado y el patrocinador se cancela para no ensuciar la cola local
  await page.getByLabel("Estado").selectOption("canceled");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
});

test("el formulario público rechaza datos inválidos sin perder al cliente", async ({ request }) => {
  const res = await request.post("/datos/pedido", {
    form: { company: "X", website: "no-es-url", email: "malo", plan: "basica", lang: "es" },
    maxRedirects: 0,
  });
  expect(res.status()).toBe(303);
  expect(res.headers()["location"]).toContain("estado=error");
});

test("las URL viejas de la nota de Mercatren redirigen (301) a las nuevas", async ({ request }) => {
  const es = await request.get(
    "/es/ventas/pedro-llerena-lanza-mercatren-tienda-1-3-millones-de-productos-competir-amazon",
    { maxRedirects: 0 },
  );
  expect(es.status()).toBe(301);
  expect(es.headers()["location"]).toBe(
    "/es/ventas/un-venezolano-lanza-mercatren-tienda-en-linea-1-3-millones-de-productos-estados-unidos",
  );
  const en = await request.get(
    "/en/sales/pedro-llerena-launches-mercatren-1-3-million-products-store-taking-on-amazon/",
    { maxRedirects: 0 },
  );
  expect(en.status()).toBe(301);
  expect(en.headers()["location"]).toContain(
    "/en/sales/venezuelan-entrepreneur-launches-mercatren",
  );
  const followed = await request.get(
    "/es/ventas/pedro-llerena-lanza-mercatren-tienda-1-3-millones-de-productos-competir-amazon",
  );
  expect(followed.status()).toBe(200);
  expect(await followed.text()).toContain("un venezolano lanza Mercatren");
});

test("el mismo artículo se abre en inglés con aviso de respaldo", async ({ page }) => {
  await page.goto("/en/crypto");
  const first = page.locator("article h3 a").first();
  const href = await first.getAttribute("href");
  expect(href).toMatch(/^\/en\/crypto\//);
  const res = await page.goto(href!);
  expect(res?.status()).toBe(200);
  await expect(page.getByText("This article is available in Spanish only for now.")).toBeVisible();
});

test("404 con página propia y en el idioma correcto", async ({ page }) => {
  const res = await page.goto("/en/crypto/esto-no-existe");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("We couldn't find that page")).toBeVisible();
});

test("/__health incluye el estado del robot (llaves, tope, cola)", async ({ request }) => {
  const res = await request.get("/__health");
  const body = (await res.json()) as {
    robot: {
      paused: boolean;
      keys: Record<string, boolean>;
      missing: string[];
      queue: { queued: number };
    };
  };
  expect(body.robot).toBeTruthy();
  expect(typeof body.robot.paused).toBe("boolean");
  expect(body.robot.keys).toHaveProperty("gemini");
  expect(Array.isArray(body.robot.missing)).toBe(true);
});

/** Abre la barra lateral del panel en celular (reintenta por si el clic llega antes de hidratar). */
async function abrirMenuPanel(page: import("@playwright/test").Page) {
  const boton = page.getByRole("button", { name: "Abrir el menú" });
  const panel = page.getByRole("dialog", { name: "Panel de losupe" });
  await expect(async () => {
    if (!(await panel.isVisible())) await boton.click({ timeout: 2000 });
    await expect(panel).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
}

test("panel: sin sesión manda a entrar; contraseña mala avisa; con la buena entra y sale", async ({
  page,
  isMobile,
}) => {
  // El navegador de prueba pide inglés; el panel obedece a la cookie de idioma.
  await page.goto("/panel/accion/idioma?lang=es");
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/panel\/entrar$/);
  await expect(page.getByRole("heading", { name: "Entrar al panel" })).toBeVisible();
  // Ojito de la contraseña
  const pass = page.getByLabel("Contraseña", { exact: true });
  await pass.fill("mala");
  await expect(pass).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Ver la contraseña" }).click();
  await expect(pass).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("alert")).toContainText("Contraseña incorrecta");
  await page.getByLabel("Contraseña", { exact: true }).fill("losupe-panel-local");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/panel$/);
  await expect(page.getByRole("heading", { name: "Robot redactor" })).toBeVisible();
  await expect(page.getByText("GEMINI_API_KEY").first()).toBeVisible();
  // Barra lateral: navega entre secciones y marca la activa (en celular hay que abrirla)
  if (isMobile) await abrirMenuPanel(page);
  const side = page.getByRole("navigation", { name: "Panel de losupe" }).last();
  await side.getByRole("link", { name: /Encargos/ }).click();
  await expect(page).toHaveURL(/\/panel\/encargos$/);
  if (isMobile) await abrirMenuPanel(page);
  await expect(
    page
      .getByRole("navigation", { name: "Panel de losupe" })
      .last()
      .getByRole("link", { name: /Encargos/ }),
  ).toHaveAttribute("aria-current", "page");
  if (isMobile) await page.getByRole("button", { name: "Cerrar el menú" }).click();
  await page.goto("/panel");
  // Cerrar sesión borra la sesión: /panel vuelve a pedir contraseña
  if (isMobile) await abrirMenuPanel(page);
  await page.getByRole("button", { name: "Cerrar sesión" }).last().click();
  await expect(page).toHaveURL(/\/panel\/entrar$/);
  await page.goto("/panel");
  await expect(page).toHaveURL(/\/panel\/entrar$/);
});

test("desde el sitio público hay una puerta al panel", async ({ page, isMobile }) => {
  await page.goto("/es");
  if (isMobile) {
    await page.getByRole("button", { name: "Menú" }).click();
    const dialog = page.getByRole("dialog", { name: "Menú" });
    await expect(dialog.getByRole("link", { name: "Entrar al panel" })).toHaveAttribute(
      "href",
      "/panel",
    );
    return;
  }
  const link = page.getByRole("link", { name: "Entrar al panel" });
  await expect(link).toHaveAttribute("href", "/panel");
  await link.click();
  await expect(page).toHaveURL(/\/panel\/entrar$/);
});

test("panel: crear patrocinador, encolar ideas, ver cola y ejecutar sin llave avisa claro", async ({
  page,
}) => {
  await page.goto("/panel/accion/idioma?lang=es");
  await page.goto("/panel/entrar");
  await page.getByLabel("Contraseña", { exact: true }).fill("losupe-panel-local");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.goto("/panel/encargos");
  const name = `Empresa Prueba ${Date.now()}`;
  await page.getByLabel("Nombre de la empresa").fill(name);
  await page.getByLabel("Sitio web (con https://)").fill("https://example.com");
  await page.getByLabel("Notas contratadas").fill("3");
  await page
    .getByLabel("Quién es la empresa (brief para el redactor)")
    .fill("Vende software a pymes.");
  await page.getByRole("button", { name: "Crear patrocinador" }).click();
  await expect(page).toHaveURL(/\/panel\/encargos\/[0-9a-f-]+\?ok=created$/);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await page
    .getByLabel("Agregar ideas de titular")
    .fill("Cómo ayuda la empresa a las pymes | enfoque en tiendas\nOtra idea de nota");
  await page.getByRole("button", { name: "Agregar a la cola" }).click();
  await expect(page.getByText("Ideas agregadas a la cola.")).toBeVisible();
  await expect(page.getByText("Cómo ayuda la empresa a las pymes")).toBeVisible();
  await expect(page.getByText("En cola").first()).toBeVisible();
  // Ritmo: la ficha dice cuándo puede salir la siguiente. Una empresa nueva, que nunca publicó,
  // puede de una; y el aviso recuerda el tope (candado 13: un patrocinador no inunda la portada).
  await expect(page.getByText("Siguiente nota de esta empresa")).toBeVisible();
  await expect(page.getByText("ya puede salir")).toBeVisible();
  await expect(page.getByText(/0\/2 esta semana/)).toBeVisible();
  // El resumen de la portada del panel muestra la cola
  await page.goto("/panel");
  await expect(page.getByText(/encargos en cola/)).toBeVisible();
  // Ajustes del robot: se guardan y se reflejan
  await page.getByLabel("Notas por día (robot + encargos)").fill("6");
  await page.getByLabel("Porcentaje de notas duraderas (guías) frente a actualidad").fill("50");
  // El ritmo de los patrocinadores se ajusta desde aquí y se queda guardado
  await page.getByLabel("Horas mínimas entre notas de la misma empresa").fill("72");
  await page.getByLabel("Máximo por semana y empresa").fill("2");
  await page.getByRole("button", { name: "Guardar ajustes" }).click();
  await expect(page.getByText("Ajustes guardados.")).toBeVisible();
  await expect(page.getByLabel("Horas mínimas entre notas de la misma empresa")).toHaveValue("72");
  await expect(page.getByLabel("Máximo por semana y empresa")).toHaveValue("2");
  await expect(
    page.getByLabel("Porcentaje de notas duraderas (guías) frente a actualidad"),
  ).toHaveValue("50");
  // Ejecutar ahora sin GEMINI_API_KEY: la corrida queda en error y lo dice
  await page.getByRole("button", { name: "Ejecutar ahora (1 nota)" }).click();
  await expect(page.getByRole("alert")).toContainText(/GEMINI_API_KEY/);
  await expect(page.getByText("Falta GEMINI_API_KEY", { exact: false }).first()).toBeVisible();
  // Limpieza: cancelar el patrocinador para no ensuciar la cola local
  await page.goto("/panel/encargos");
  await page.getByRole("link", { name }).click();
  await page.getByLabel("Estado").selectOption("canceled");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();
});
