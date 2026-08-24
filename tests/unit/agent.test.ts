import { describe, expect, it } from "vitest";
import { articleToMarkdown, htmlToMarkdown, listToMarkdown } from "@/lib/markdown";
import {
  AI_BOTS,
  buildApiCatalog,
  buildLinkHeader,
  buildLlmsTxt,
  buildRobotsTxt,
  CONTENT_SIGNALS,
} from "@/lib/agent-discovery";
import {
  buildAiCatalog,
  buildSkillMarkdown,
  buildSkillsIndex,
  SKILL_NAME,
} from "@/lib/agent-manifests";
import { renderMarkdown, wantsMarkdown } from "@/lib/agent-markdown";
import { INDEXNOW_KEY, indexNowKeyPath, pingIndexNow } from "@/lib/indexnow";
import { langRedirectTarget } from "@/lib/lang-redirect";
import { personJsonLd } from "@/lib/seo";
import { FakeD1, sampleCardRow, sampleFullRow } from "./fake-d1";

const BASE = "https://losupe.com";

describe("htmlToMarkdown", () => {
  it("convierte párrafos, títulos, listas, énfasis, enlaces y figuras", () => {
    const html = `
<p>Hola <strong>mundo</strong> y <em>más</em>, ver <a href="https://x.com/a">el sitio</a>.</p>
<h2>Sección</h2>
<ul><li>Uno</li><li>Dos &amp; tres</li></ul>
<figure><img src="/img/a.jpg" alt="Foto A" width="10" height="5" /><figcaption>Pie de <b>foto</b></figcaption></figure>
<blockquote>Cita</blockquote>
<h1>Otro</h1>`;
    const md = htmlToMarkdown(html);
    expect(md).toContain("Hola **mundo** y *más*, ver [el sitio](https://x.com/a).");
    expect(md).toContain("## Sección");
    expect(md).toContain("- Uno\n- Dos & tres");
    expect(md).toContain("![Foto A](/img/a.jpg)\n\n*Pie de foto*");
    expect(md).toContain("> Cita");
    expect(md).toContain("## Otro");
    expect(md).not.toContain("<");
  });
  it("articleToMarkdown arma cabecera, cuerpo y fuentes", () => {
    const md = articleToMarkdown({
      title: "Título",
      excerpt: "Bajada",
      contentHtml: "<p>Cuerpo</p>",
      authorName: "Magaly Molina",
      publishedAt: "2026-08-23T04:00:00.000Z",
      updatedAt: "2026-08-23T04:00:00.000Z",
      sectionName: "Ventas y motivación",
      url: "https://losupe.com/es/ventas/x",
      imageUrl: "https://losupe.com/img/x.jpg",
      sources: [{ title: "Fuente", url: "https://f.com" }],
      tags: ["a", "b"],
      aiAssisted: true,
      lang: "es",
    });
    expect(md.startsWith("# Título\n\n> Bajada\n")).toBe(true);
    expect(md).toContain("- Autora: Magaly Molina");
    expect(md).toContain("- Temas: a, b");
    expect(md).toContain("redacción asistida por inteligencia artificial");
    expect(md).toContain("![Título](https://losupe.com/img/x.jpg)");
    expect(md).toContain("## Fuentes\n\n- [Fuente](https://f.com)");
  });
  it("listToMarkdown", () => {
    const md = listToMarkdown("T", "Intro", [
      { title: "A", url: "https://l/a", excerpt: "x", date: "2026-08-23T04:00:00.000Z" },
    ]);
    expect(md).toBe("# T\n\nIntro\n\n- [A](https://l/a) — 2026-08-23\n  x\n");
  });
});

describe("robots, llms.txt, catálogos y Link", () => {
  it("robots.txt trae Content Signals, bots de IA, sitemaps y host", () => {
    const txt = buildRobotsTxt(`${BASE}/`);
    expect(txt).toContain(`Content-Signal: ${CONTENT_SIGNALS}`);
    expect(txt).toContain("Disallow: /__scheduled");
    for (const bot of AI_BOTS) expect(txt).toContain(`User-agent: ${bot}`);
    expect(txt).toContain(`Sitemap: ${BASE}/sitemap.xml`);
    expect(txt).toContain(`Host: ${BASE}`);
    expect(txt).not.toContain("losupe.com//");
  });
  it("llms.txt describe el medio, secciones, feeds y últimas notas", () => {
    const txt = buildLlmsTxt(BASE, {
      es: [{ title: "Nota", url: `${BASE}/es/cripto/nota`, excerpt: "r", date: "2026-08-23" }],
      en: [],
    });
    expect(txt.startsWith("# losupe")).toBe(true);
    expect(txt).toContain("Accept: text/markdown");
    expect(txt).toContain(`${BASE}/es/economia`);
    expect(txt).toContain(`${BASE}/en/rss.xml`);
    expect(txt).toContain("## Últimas notas (español)");
    expect(txt).toContain("[Nota]");
    expect(txt).not.toContain("Latest stories (English)");
  });
  it("api-catalog, ai-catalog y agent-skills", async () => {
    const cat = buildApiCatalog(BASE);
    expect(cat.linkset[0]?.anchor).toBe(`${BASE}/`);
    expect(cat.linkset[0]?.["service-desc"]?.[0]?.href).toBe(`${BASE}/llms.txt`);
    const ai = buildAiCatalog(BASE);
    expect(ai.entries.length).toBeGreaterThanOrEqual(4);
    for (const e of ai.entries) {
      expect(e.identifier.startsWith("urn:air:losupe.com:")).toBe(true);
      expect(e.representativeQueries.length).toBeGreaterThanOrEqual(2);
    }
    const idx = await buildSkillsIndex(BASE);
    expect(idx.skills[0]?.name).toBe(SKILL_NAME);
    expect(idx.skills[0]?.url).toBe(`${BASE}/.well-known/agent-skills/${SKILL_NAME}/SKILL.md`);
    expect(idx.skills[0]?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(buildSkillMarkdown(BASE)).toContain("Accept: text/markdown");
  });
  it("cabecera Link con relaciones útiles", () => {
    const withLang = buildLinkHeader(BASE, "/es/cripto/nota", "es");
    expect(withLang).toContain('rel="api-catalog"');
    expect(withLang).toContain('rel="sitemap"');
    expect(withLang).toContain(`<${BASE}/es/cripto/nota>; rel="alternate"; type="text/markdown"`);
    const noLang = buildLinkHeader(BASE, "/robots.txt", null);
    expect(noLang).not.toContain("text/markdown");
  });
});

describe("Markdown para agentes", () => {
  const req = (accept?: string) =>
    new Request("https://losupe.com/es", accept ? { headers: { accept } } : undefined);
  it("detecta cuándo el cliente prefiere Markdown", () => {
    expect(wantsMarkdown(req("text/markdown"))).toBe(true);
    expect(wantsMarkdown(req("text/markdown, text/html;q=0.5"))).toBe(true);
    expect(wantsMarkdown(req("text/html, text/markdown;q=0.8"))).toBe(false);
    expect(wantsMarkdown(req("text/html,application/xhtml+xml,*/*;q=0.8"))).toBe(false);
    expect(wantsMarkdown(req())).toBe(false);
  });
  it("renderiza portada, sección, búsqueda y nota; null para rutas sin versión", async () => {
    const db = new FakeD1((sql) => {
      if (sql.includes("FROM article_i18n WHERE slug")) return [{ article_id: "a1", lang: "es" }];
      if (sql.includes("SELECT lang, slug FROM article_i18n"))
        return [{ lang: "es", slug: "bitcoin-sube" }];
      if (sql.includes("content_html")) return [sampleFullRow];
      return [sampleCardRow];
    });
    const home = await renderMarkdown(db.asD1(), BASE, "/es");
    expect(home).toContain("# losupe — Lo que pasa, explicado.");
    expect(home).toContain(`[Bitcoin sube](${BASE}/es/cripto/bitcoin-sube)`);
    const section = await renderMarkdown(db.asD1(), BASE, "/en/crypto");
    expect(section).toContain("# Crypto · losupe");
    const search = await renderMarkdown(
      db.asD1(),
      BASE,
      "/es/buscar",
      new URLSearchParams("q=btc"),
    );
    expect(search).toContain("Resultados para “btc”");
    const short = await renderMarkdown(db.asD1(), BASE, "/en/search", new URLSearchParams("q=a"));
    expect(short).toContain("at least 2 characters");
    const article = await renderMarkdown(db.asD1(), BASE, "/es/cripto/bitcoin-sube");
    expect(article).toContain("# Bitcoin sube");
    expect(article).toContain("Hola **mundo**");
    expect(await renderMarkdown(db.asD1(), BASE, "/es/acerca")).toBeNull();
    expect(await renderMarkdown(db.asD1(), BASE, "/fr")).toBeNull();
    expect(await renderMarkdown(new FakeD1().asD1(), BASE, "/es/cripto/nada")).toBeNull();
  });
});

describe("IndexNow", () => {
  it("clave pública y su ruta", () => {
    expect(INDEXNOW_KEY).toMatch(/^[a-f0-9]{32}$/);
    expect(indexNowKeyPath()).toBe(`/${INDEXNOW_KEY}.txt`);
  });
  it("envía la lista y reporta el resultado; tolera errores", async () => {
    const calls: { url: string; body: string }[] = [];
    const okFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body) });
      return new Response("", { status: 202 });
    }) as unknown as typeof fetch;
    const r = await pingIndexNow(BASE, [`${BASE}/a`, `${BASE}/a`, `${BASE}/b`], okFetch);
    expect(r).toEqual({ ok: true, status: 202, sent: 2 });
    expect(calls[0]?.url).toContain("api.indexnow.org");
    const body = JSON.parse(calls[0]?.body ?? "{}") as {
      host: string;
      key: string;
      urlList: string[];
    };
    expect(body.host).toBe("losupe.com");
    expect(body.key).toBe(INDEXNOW_KEY);
    expect(body.urlList).toHaveLength(2);
    expect(await pingIndexNow(BASE, [], okFetch)).toEqual({ ok: true, status: 0, sent: 0 });
    const badFetch = (async () => {
      throw new Error("red caída");
    }) as unknown as typeof fetch;
    expect((await pingIndexNow(BASE, [`${BASE}/a`], badFetch)).ok).toBe(false);
  });
});

describe("otros", () => {
  it("las rutas de descubrimiento no se redirigen por idioma", () => {
    for (const p of [
      "/.well-known/api-catalog",
      "/llms.txt",
      `/${INDEXNOW_KEY}.txt`,
      "/manifest.webmanifest",
      "/panel",
      "/panel/entrar",
      "/panel/accion/entrar",
      "/media/notas/x.jpg",
      "/datos/buscar",
    ]) {
      expect(langRedirectTarget(new URL(`${BASE}${p}`), "en"), p).toBeNull();
    }
  });
  it("JSON-LD de autora (ProfilePage/Person)", () => {
    const ld = personJsonLd(
      BASE,
      "es",
      {
        id: "andreea-blidar",
        name: "Andreea Blidar",
        kind: "person",
        bio: "Editora",
        role: "Editora",
        avatarUrl: null,
        expertise: null,
        links: { linkedin: null, x: null, email: null },
      },
      "losupe",
    ) as { "@type": string; mainEntity: { "@type": string; url: string } };
    expect(ld["@type"]).toBe("ProfilePage");
    expect(ld.mainEntity["@type"]).toBe("Person");
    expect(ld.mainEntity.url).toBe(`${BASE}/es/autor/andreea-blidar`);
  });
});
