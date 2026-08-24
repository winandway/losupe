import { describe, expect, it } from "vitest";
import {
  assertImageModelAllowed,
  assertTextModelAllowed,
  BLOCKED_IMAGE_MODELS,
  IMAGE_MODELS,
  MAX_IMAGE_COST_USD,
  ModelBlockedError,
  textCostUsd,
} from "@/lib/robot/model-guard";
import {
  assertBudget,
  BudgetExceededError,
  getSpendToday,
  recordSpend,
  todayKey,
} from "@/lib/robot/budget";
import { extractJson, generateJson, GeminiError } from "@/lib/robot/gemini";
import {
  buildSponsoredPrompt,
  buildUniversalPrompt,
  cleanEditorialHtml,
  copyRatio,
  DraftRejectedError,
  finalizeDraft,
  shingles,
  writeDraft,
} from "@/lib/robot/writer";
import { extractLinks, fetchPage, rankSiteLinks, researchSite } from "@/lib/robot/research";
import { parseFeed, unwrapTrackingUrl } from "@/lib/robot/universal";
import { FakeD1 } from "./fake-d1";

const ok = (body: unknown, headers: Record<string, string> = {}) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": typeof body === "string" ? "text/html" : "application/json",
      ...headers,
    },
  });

describe("bloqueo de modelos caros (candado en código)", () => {
  it("deja pasar solo la lista blanca y frena cualquier modelo caro o desconocido", () => {
    for (const m of Object.keys(IMAGE_MODELS))
      expect(() => assertImageModelAllowed(m)).not.toThrow();
    for (const m of BLOCKED_IMAGE_MODELS)
      expect(() => assertImageModelAllowed(m)).toThrow(ModelBlockedError);
    expect(() => assertImageModelAllowed("algun-modelo-nuevo")).toThrow(/lista blanca/);
    expect(() => assertTextModelAllowed("gpt-5")).toThrow(ModelBlockedError);
    // La lista blanca nunca debe contener algo que pase el tope por imagen
    for (const cost of Object.values(IMAGE_MODELS))
      expect(cost).toBeLessThanOrEqual(MAX_IMAGE_COST_USD);
    expect(textCostUsd("gemini-2.5-flash", 1_000_000, 1_000_000)).toBeCloseTo(2.8, 5);
  });
});

describe("presupuesto diario", () => {
  it("anota el gasto y frena al llegar al tope", async () => {
    let total = 0;
    const db = new FakeD1((sql, params) => {
      if (sql.includes("FROM settings")) return [{ value: "1.00" }];
      if (sql.includes("SUM(cost_usd)")) return [{ total }];
      if (sql.startsWith("INSERT INTO spend_log")) {
        total += Number(params[4]);
        return [];
      }
      return [];
    });
    await recordSpend(db.asD1(), {
      provider: "gemini",
      model: "gemini-2.5-flash",
      units: 1000,
      costUsd: 0.4,
    });
    expect(await getSpendToday(db.asD1())).toBeCloseTo(0.4);
    await expect(assertBudget(db.asD1(), 0.5)).resolves.toMatchObject({ limit: 1 });
    await recordSpend(db.asD1(), { provider: "fal", units: 1, costUsd: 0.7 });
    await expect(assertBudget(db.asD1())).rejects.toBeInstanceOf(BudgetExceededError);
    expect(todayKey(new Date("2026-08-23T10:00:00Z"))).toBe("2026-08-23");
  });
});

describe("Gemini (simulado)", () => {
  it("manda la llave en cabecera, parsea JSON y calcula el costo", async () => {
    let seen: Request | null = null;
    const fetchImpl: typeof fetch = async (input, init) => {
      seen = new Request(input, init);
      return ok({
        candidates: [{ content: { parts: [{ text: '```json\n{"hola":"mundo"}\n```' }] } }],
        usageMetadata: { promptTokenCount: 1000, candidatesTokenCount: 500 },
      });
    };
    const r = await generateJson<{ hola: string }>({
      apiKey: "k",
      model: "gemini-2.5-flash-lite",
      system: "s",
      prompt: "p",
      fetchImpl,
    });
    expect(r.data.hola).toBe("mundo");
    expect(seen!.headers.get("x-goog-api-key")).toBe("k");
    expect(seen!.url).not.toContain("k=");
    expect(r.costUsd).toBeCloseTo(0.0003, 6);
    expect(extractJson('texto {"a":1} basura')).toBe('{"a":1}');
  });
  it("explica los errores: sin llave, 403, respuesta vacía, JSON roto", async () => {
    await expect(
      generateJson({ apiKey: "", model: "gemini-2.5-flash", system: "", prompt: "" }),
    ).rejects.toThrow(/GEMINI_API_KEY/);
    const f403: typeof fetch = async () => new Response("nope", { status: 403 });
    await expect(
      generateJson({
        apiKey: "k",
        model: "gemini-2.5-flash",
        system: "",
        prompt: "",
        fetchImpl: f403,
      }),
    ).rejects.toThrow(GeminiError);
    const empty: typeof fetch = async () => ok({ promptFeedback: { blockReason: "SAFETY" } });
    await expect(
      generateJson({
        apiKey: "k",
        model: "gemini-2.5-flash",
        system: "",
        prompt: "",
        fetchImpl: empty,
      }),
    ).rejects.toThrow(/SAFETY/);
    const broken: typeof fetch = async () =>
      ok({ candidates: [{ content: { parts: [{ text: "{no" }] } }] });
    await expect(
      generateJson({
        apiKey: "k",
        model: "gemini-2.5-flash",
        system: "",
        prompt: "",
        fetchImpl: broken,
      }),
    ).rejects.toThrow(/JSON/);
  });
});

const para = (n: number, seed: string) =>
  Array.from(
    { length: n },
    (_, i) =>
      `<p>${seed} párrafo ${i} con palabras distintas ${i * 7} para sumar longitud y sentido en la nota de prueba número ${i}.</p>`,
  ).join("");

function goodDraft() {
  const mk = (lang: string) => ({
    title: `Título de prueba suficientemente largo en ${lang} para pasar`,
    excerpt: `Extracto de prueba ${lang} que resume la nota en dos frases completas y claras para el lector.`,
    content_html: `<h2>Sección</h2>${para(40, lang)}<script>alert(1)</script><img src="x"><a href="https://fuente.com/a" onclick="x()">fuente</a>`,
    meta_title: `Meta título de prueba ${lang}`,
    meta_description: `Meta descripción de prueba ${lang} con la longitud mínima necesaria para pasar la validación del esquema.`,
    tags: ["uno", "dos", "tres"],
  });
  return {
    es: mk("es"),
    en: mk("en"),
    kind: "news",
    image_prompt: "A wide editorial photo of a city skyline at dusk",
    image_alt_es: "Ciudad al atardecer",
    image_alt_en: "City at dusk",
    image_keywords: ["city", "business"],
  };
}

describe("redactor: validación, limpieza y anticopia", () => {
  it("acepta un borrador válido y limpia el HTML (sin scripts, sin img, enlaces seguros)", () => {
    const d = finalizeDraft(goodDraft(), ["texto fuente sin relación"]);
    expect(d.es.content_html).not.toContain("<script");
    expect(d.es.content_html).not.toContain("<img");
    expect(d.es.content_html).toContain('rel="noopener noreferrer nofollow"');
    expect(d.es.content_html).not.toContain("onclick");
  });
  it("rechaza formato inválido, notas cortas y copia de fuentes", () => {
    expect(() => finalizeDraft({ es: {} }, [])).toThrow(DraftRejectedError);
    // El mensaje dice QUÉ vino mal: sin eso, en el panel no hay forma de diagnosticar.
    expect(() => finalizeDraft({ es: {} }, [])).toThrow(/es\.|en:|raíz/);
    const tituloCorto = goodDraft();
    tituloCorto.es.title = "corto";
    expect(() => finalizeDraft(tituloCorto, [])).toThrow(/es\.title/);
    const short = goodDraft();
    short.es.content_html = `<p>${"palabra ".repeat(200)}</p>`;
    expect(() => finalizeDraft(short, [])).toThrow(/muy corto/);
    const copied = goodDraft();
    const source = para(40, "es").replace(/<[^>]+>/g, " ");
    expect(copyRatio(source, [source])).toBeGreaterThan(0.9);
    expect(() => finalizeDraft(copied, [source])).toThrow(/copia fuentes/);
    expect(shingles("a b c d e f g h i", 8).size).toBe(2);
    expect(cleanEditorialHtml('<a href="javascript:x">x</a><p>ok</p>')).toBe("x<p>ok</p>");
    // El sitio ya pone la firma con foto: si el modelo la escribe dentro del texto, se quita.
    expect(cleanEditorialHtml("<p>Texto.</p><p>Por Magaly Molina</p>")).toBe("<p>Texto.</p>");
    expect(cleanEditorialHtml("<p>Texto.</p><p>By Andreea Blidar</p>")).toBe("<p>Texto.</p>");
    expect(cleanEditorialHtml("<p>Texto.</p><p>Por  Pedro Llerena .</p>")).toBe("<p>Texto.</p>");
    // No se lleva por delante frases normales que empiezan por «Por»
    expect(
      cleanEditorialHtml("<p>Por eso el mercado subió con fuerza durante la semana.</p>"),
    ).toBe("<p>Por eso el mercado subió con fuerza durante la semana.</p>");
  });
  it("los prompts llevan la idea, el brief, las reglas de tono y el material", () => {
    const p = buildSponsoredPrompt({
      sponsorName: "Empresa",
      website: "https://empresa.com",
      titleIdea: "Cómo ayuda Empresa a las pymes",
      brief: "enfoque en tiendas",
      sponsorBrief: "vende software",
      sectionId: "ventas",
      pages: [
        {
          url: "https://empresa.com",
          title: "Inicio",
          description: "",
          text: "texto del sitio",
          status: 200,
        },
      ],
    });
    expect(p).toContain("Cómo ayuda Empresa a las pymes");
    expect(p).toContain("enfoque en tiendas");
    expect(p).toContain("texto del sitio");
    expect(p).toContain("contenido patrocinado");
    const u = buildUniversalPrompt({
      sectionId: "cripto",
      topicTitle: "Bitcoin sube",
      kind: "evergreen",
      sources: [{ title: "F", url: "https://f.com", text: "t" }],
    });
    expect(u).toContain("GUÍA DURADERA");
    expect(u).toContain("https://f.com");
  });
  it("si el primer borrador copia, se pide otra vez con la advertencia (y si vuelve a copiar, se descarta)", async () => {
    // Fuente con vocabulario propio: el borrador «bueno» no la toca, el «copiado» la reproduce.
    const fuenteHtml = Array.from(
      { length: 40 },
      (_, i) =>
        `<p>La agencia informó que el organismo revisará ${i} medidas antes del cierre trimestral, según documentos entregados esta semana a los reguladores del sector ${i * 3}.</p>`,
    ).join("");
    const fuente = fuenteHtml.replace(/<[^>]+>/g, " ");
    const copiado = goodDraft();
    copiado.es.content_html = fuenteHtml;
    const bueno = goodDraft();
    let intentos = 0;
    const prompts: string[] = [];
    const fetchImpl: typeof fetch = async (_i, init) => {
      intentos += 1;
      prompts.push(JSON.parse(String(init?.body)).contents[0].parts[0].text);
      return ok({
        candidates: [
          { content: { parts: [{ text: JSON.stringify(intentos === 1 ? copiado : bueno) }] } },
        ],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 100 },
      });
    };
    // `retries: 1` a propósito: en el robot el reintento va un piso más arriba (el turno de la
    // franja se vuelve a reclamar en una invocación nueva), pero el mecanismo tiene que seguir
    // funcionando para quien lo pida.
    const r = await writeDraft("prompt", [fuente], { apiKey: "k", fetchImpl, retries: 1 });
    expect(intentos).toBe(2);
    expect(r.attempts).toBe(2);
    expect(prompts[0]).not.toContain("AVISO IMPORTANTE");
    expect(prompts[1]).toContain("AVISO IMPORTANTE");
    expect(prompts[1]).toContain("DESDE CERO");

    // Si copia las dos veces, no se publica nada: el listón no se baja.
    const siempreCopia: typeof fetch = async () =>
      ok({
        candidates: [{ content: { parts: [{ text: JSON.stringify(copiado) }] } }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 100 },
      });
    await expect(
      writeDraft("prompt", [fuente], { apiKey: "k", fetchImpl: siempreCopia, retries: 1 }),
    ).rejects.toThrow(/copia fuentes/);
  });

  it("POR DEFECTO no reintenta dentro de la misma corrida (el worker no llega a dos llamadas)", async () => {
    let intentos = 0;
    const fetchImpl: typeof fetch = async () => {
      intentos += 1;
      return ok({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    ...goodDraft(),
                    es: { ...goodDraft().es, content_html: "<p>corto</p>" },
                  }),
                },
              ],
            },
          },
        ],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 100 },
      });
    };
    await expect(writeDraft("prompt", ["fuente"], { apiKey: "k", fetchImpl })).rejects.toThrow();
    expect(intentos).toBe(1);
  });

  it("writeDraft: llama al modelo, valida y devuelve costo", async () => {
    const fetchImpl: typeof fetch = async () =>
      ok({
        candidates: [{ content: { parts: [{ text: JSON.stringify(goodDraft()) }] } }],
        usageMetadata: { promptTokenCount: 5000, candidatesTokenCount: 3000 },
      });
    const { draft, usage } = await writeDraft("prompt", ["fuente"], { apiKey: "k", fetchImpl });
    expect(draft.kind).toBe("news");
    expect(usage.costUsd).toBeGreaterThan(0);
  });
});

describe("investigación web", () => {
  const site = (path: string) =>
    `<html><head><title>Empresa ${path}</title><meta name="description" content="Somos Empresa"></head><body><nav>menu</nav><main><h1>Hola</h1><p>Texto de ${path} con contenido útil.</p><a href="/nosotros">Nosotros</a><a href="/precios?x=1">Precios</a><a href="https://otro.com/x">Fuera</a><a href="/foto.jpg">img</a></main><footer>pie</footer></body></html>`;
  const fetchImpl: typeof fetch = async (input) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,
    );
    if (url.pathname === "/roto")
      return new Response("x", { status: 500, headers: { "content-type": "text/html" } });
    return ok(site(url.pathname));
  };
  it("lee una página, quita navegación y saca enlaces internos ordenados", async () => {
    const page = await fetchPage("https://empresa.com/", { fetchImpl });
    expect(page?.title).toBe("Empresa /");
    expect(page?.description).toBe("Somos Empresa");
    expect(page?.text).toContain("Texto de /");
    expect(page?.text).not.toContain("menu");
    const links = extractLinks(site("/"), "https://empresa.com/");
    expect(links).toEqual(["https://empresa.com/nosotros", "https://empresa.com/precios?x=1"]);
    expect(rankSiteLinks(links, "https://empresa.com/")[0]).toContain("nosotros");
  });
  it("researchSite junta portada + páginas útiles + extras y reporta errores sin explotar", async () => {
    const r = await researchSite("https://empresa.com", {
      fetchImpl,
      extraUrls: ["https://empresa.com/roto"],
      maxPages: 3,
    });
    expect(r.pages.length).toBe(3);
    expect(r.errors.some((e) => e.includes("/roto"))).toBe(true);
    expect(r.totalChars).toBeGreaterThan(0);
    const bad = await researchSite("no-es-url", { fetchImpl });
    expect(bad.pages).toEqual([]);
    expect(bad.errors[0]).toContain("inválido");
  });
});

describe("fuentes RSS", () => {
  it("parsea RSS y Atom, deshace el rastreo de Bing y descarta basura", () => {
    const rss = `<?xml version="1.0"?><rss><channel><item><title><![CDATA[Nota &amp; uno]]></title><link>https://www.bing.com/news/apiclick.aspx?ref=x&amp;url=https%3A%2F%2Fmedio.com%2Fa</link><description><![CDATA[<p>Resumen</p>]]></description><pubDate>Sun, 23 Aug 2026 10:00:00 GMT</pubDate></item><item><title>sin link</title></item></channel></rss>`;
    const items = parseFeed(rss);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Nota & uno",
      url: "https://medio.com/a",
      summary: "Resumen",
    });
    expect(items[0]?.publishedAt).toBe("2026-08-23T10:00:00.000Z");
    const atom = `<feed><entry><title>Atom</title><link href="https://a.com/x"/><summary>S</summary><updated>2026-08-22T00:00:00Z</updated></entry></feed>`;
    expect(parseFeed(atom)[0]).toMatchObject({ title: "Atom", url: "https://a.com/x" });
    expect(unwrapTrackingUrl("https://medio.com/b")).toBe("https://medio.com/b");
    expect(unwrapTrackingUrl("no url")).toBe("no url");
  });
});
