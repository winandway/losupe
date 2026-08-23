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
  "/es/autor/magaly-molina",
  "/es/ventas/pedro-llerena-lanza-mercatren-tienda-1-3-millones-de-productos-competir-amazon",
  "/en/sales/pedro-llerena-launches-mercatren-1-3-million-products-store-taking-on-amazon",
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
    "/es/ventas/pedro-llerena-lanza-mercatren-tienda-1-3-millones-de-productos-competir-amazon",
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
    await expect(page).toHaveURL(/\/es\/ventas\/pedro-llerena-lanza-mercatren/);
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
  await expect(page).toHaveURL(/\/es\/ventas\/pedro-llerena-lanza-mercatren/);
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

test("la nota de Mercatren es la principal, firmada por Magaly Molina y con aviso de IA", async ({
  page,
}) => {
  await page.goto("/es");
  const hero = page.locator("article").first();
  await expect(hero.locator("h2 a")).toHaveText(/Pedro Llerena lanza Mercatren/);
  await expect(hero.getByRole("link", { name: "Magaly Molina" })).toHaveAttribute(
    "href",
    "/es/autor/magaly-molina",
  );
  await page.goto(
    "/es/ventas/pedro-llerena-lanza-mercatren-tienda-1-3-millones-de-productos-competir-amazon",
  );
  await expect(page.locator("article h1")).toHaveText(/Dejamos el miedo a un lado/);
  await expect(page.locator("article .prose figure img").first()).toBeVisible();
  await expect(page.getByText("Redacción asistida por inteligencia artificial")).toBeVisible();
  await expect(page.getByRole("link", { name: "Mercatren — sitio oficial" })).toHaveAttribute(
    "href",
    "https://mercatren.com/es",
  );
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
