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
  "/video/hero.mp4",
  "/video/hero-poster.jpg",
  "/es/autor/magaly-molina",
  "/es/ventas/pedro-llerena-lanza-mercatren-tienda-1-3-millones-de-productos-competir-amazon",
  "/en/sales/pedro-llerena-launches-mercatren-1-3-million-products-store-taking-on-amazon",
  "/img/notas/mercatren/home.jpg",
];

for (const route of ROUTES_200) {
  test(`GET ${route} → 200`, async ({ request }) => {
    const res = await request.get(route);
    expect(res.status(), route).toBe(200);
  });
}

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
  await expect(page.locator('video source[src="/video/hero.mp4"]')).toHaveCount(1);
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
