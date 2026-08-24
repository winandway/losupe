import { describe, expect, it } from "vitest";
import { bestTrendArticle, classifyTrend, parseTrendsFeed, TRENDS_FEEDS } from "@/lib/robot/trends";
import { sourceDisplayName, SYSTEM_PROMPT, draftSchema } from "@/lib/robot/writer";
import { SOURCE_NAMES, trustLevel } from "@/lib/robot/trusted-sources";
import { embedVideo, findPexelsVideo } from "@/lib/robot/images";
import { discoverCandidates } from "@/lib/robot/universal";
import { FakeD1 } from "./fake-d1";

const TRENDS_XML = `<?xml version="1.0"?><rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0"><channel>
<item><title>sport boys - cienciano</title><ht:approx_traffic>500+</ht:approx_traffic><link>https://trends.google.com/trending/rss?geo=US</link><pubDate>Sun, 23 Aug 2026 11:00:00 -0700</pubDate>
<ht:news_item><ht:news_item_title>Sport Boys - Cienciano | Pronóstico y cuotas</ht:news_item_title><ht:news_item_url>https://as.com/apuestas/x</ht:news_item_url><ht:news_item_source>Diario AS</ht:news_item_source></ht:news_item></item>
<item><title>inflación agosto</title><ht:approx_traffic>20,000+</ht:approx_traffic><link>https://trends.google.com/trending/rss?geo=US</link><pubDate>Sun, 23 Aug 2026 10:00:00 -0700</pubDate>
<ht:news_item><ht:news_item_title>La inflación sube en agosto</ht:news_item_title><ht:news_item_url>https://blogdesconocido.com/a</ht:news_item_url><ht:news_item_source>Blog</ht:news_item_source></ht:news_item>
<ht:news_item><ht:news_item_title>Inflation rises in August, Fed watches</ht:news_item_title><ht:news_item_url>https://www.reuters.com/markets/us/inflation-august</ht:news_item_url><ht:news_item_source>Reuters</ht:news_item_source></ht:news_item></item>
<item><title>taylor swift</title><ht:approx_traffic>100,000+</ht:approx_traffic><link>x</link><pubDate>bad</pubDate>
<ht:news_item><ht:news_item_title>Taylor Swift anuncia gira</ht:news_item_title><ht:news_item_url>https://www.billboard.com/x</ht:news_item_url><ht:news_item_source>Billboard</ht:news_item_source></ht:news_item></item>
</channel></rss>`;

describe("tendencias de Google", () => {
  it("parsea el RSS (tendencia, tráfico, artículos) y elige la fuente más confiable", () => {
    const items = parseTrendsFeed(TRENDS_XML);
    expect(items).toHaveLength(3);
    expect(items[1]).toMatchObject({ trend: "inflación agosto", traffic: 20000 });
    expect(items[1]?.publishedAt).toBe("2026-08-23T17:00:00.000Z");
    expect(items[2]?.publishedAt).toBeNull();
    expect(bestTrendArticle(items[1]!)?.url).toContain("reuters.com");
    expect(bestTrendArticle({ trend: "x", traffic: 0, publishedAt: null, news: [] })).toBeNull();
    expect(TRENDS_FEEDS.es).toContain("hl=es-419");
  });
  it("clasifica por sección y descarta deportes, apuestas y sucesos", () => {
    expect(classifyTrend("sport boys - cienciano pronóstico y cuotas")).toBeNull();
    expect(classifyTrend("powerball jackpot")).toBeNull();
    expect(classifyTrend("inflación agosto Fed")).toBe("economia");
    expect(classifyTrend("bitcoin cae")).toBe("cripto");
    expect(classifyTrend("chatgpt nueva versión")).toBe("tecnologia");
    expect(classifyTrend("amazon prime day deals")).toBe("ventas");
    expect(classifyTrend("taylor swift anuncia gira")).toBe("artistas");
  });
  it("discoverCandidates convierte tendencias en candidatos con sección y puntaje alto", async () => {
    const inserted: unknown[][] = [];
    class Db extends FakeD1 {
      async batch(stmts: { run: () => Promise<unknown> }[]) {
        const out = [];
        for (const st of stmts) {
          await st.run();
          out.push({ success: true, results: [], meta: { changes: 1 } });
        }
        return out;
      }
    }
    const db = new Db((sql, params) => {
      if (sql.includes("FROM sources WHERE active")) {
        return [
          {
            id: "google-trends-us-es",
            section_id: "artistas",
            name: "Trends",
            url: "https://trends.google.com/trending/rss?geo=US&hl=es-419",
            kind: "trends",
            lang: "es",
            weight: 3,
            active: 1,
          },
        ];
      }
      if (sql.startsWith("INSERT OR IGNORE INTO candidates")) inserted.push(params);
      return [];
    });
    const fetchImpl: typeof fetch = async () =>
      new Response(TRENDS_XML, { headers: { "content-type": "application/rss+xml" } });
    const r = await discoverCandidates(db.asD1(), { fetchImpl });
    expect(r.fetched).toBe(1);
    expect(r.added).toBe(2); // deportes fuera
    const sections = inserted.map((p) => p[2]);
    expect(sections).toEqual(["economia", "artistas"]);
    expect(String(inserted[0]?.[3])).toContain("reuters.com");
    expect(String(inserted[0]?.[5])).toContain("Tendencia en Google");
    expect(Number(inserted[0]?.[8])).toBeGreaterThan(40);
  });
});

describe("fuentes confiables y nombre para citar", () => {
  it("trustLevel y sourceDisplayName", () => {
    expect(trustLevel("https://www.nytimes.com/2026/x")).toBe(3);
    expect(trustLevel("https://techcrunch.com/x")).toBe(2);
    expect(trustLevel("https://blogdesconocido.com/x")).toBe(1);
    expect(trustLevel("no-url")).toBe(1);
    expect(sourceDisplayName("https://www.nytimes.com/2026/x")).toBe("The New York Times");
    expect(sourceDisplayName("https://www.mercatren.com/es")).toBe("Mercatren");
    expect(Object.keys(SOURCE_NAMES).length).toBeGreaterThan(40);
  });
  it("el prompt del redactor lleva la voz humana, la regla de citar y el video opcional", () => {
    expect(SYSTEM_PROMPT).toMatch(/calidez y humanidad/);
    expect(SYSTEM_PROMPT).toMatch(/según The New York Times/);
    expect(SYSTEM_PROMPT).toMatch(/fuente MÁS confiable/);
    // El prompt no nombra a nadie del equipo, pero sí exige que la nota esté a la altura de una
    // firma con nombre y cara, y prohíbe firmar dentro del texto.
    expect(SYSTEM_PROMPT).not.toMatch(/Magaly/i);
    expect(SYSTEM_PROMPT).toMatch(/NUNCA escribas la firma dentro del texto/);
    expect(SYSTEM_PROMPT).toMatch(/wants_video/);
    expect(SYSTEM_PROMPT).toMatch(/contenido patrocinado/);
    const parsed = draftSchema.safeParse({
      es: {
        title: "Título de prueba suficientemente largo para pasar",
        excerpt:
          "Extracto de prueba que resume la nota en dos frases completas y claras para el lector.",
        content_html: "<p>" + "texto ".repeat(400) + "</p>",
        meta_title: "Meta título de prueba",
        meta_description:
          "Meta descripción de prueba con la longitud mínima necesaria para pasar la validación del esquema.",
        tags: ["uno", "dos", "tres"],
      },
      en: {
        title: "English test title long enough to pass validation",
        excerpt:
          "English excerpt that summarizes the story in two complete sentences for the reader today.",
        content_html: "<p>" + "text ".repeat(400) + "</p>",
        meta_title: "English meta title",
        meta_description:
          "English meta description with the minimum length needed to pass the schema validation today.",
        tags: ["one", "two", "three"],
      },
      kind: "news",
      image_prompt: "A wide editorial photo of a skyline",
      image_alt_es: "Ciudad de noche",
      image_alt_en: "City skyline",
      image_keywords: ["city"],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.wants_video).toBe(false);
      expect(parsed.data.video_keywords).toEqual([]);
    }
  });
});

describe("video de archivo (Pexels)", () => {
  it("elige un HD apaisado de 5–40 s y lo incrusta tras el primer párrafo", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      expect(url).toContain("api.pexels.com/videos/search");
      return new Response(
        JSON.stringify({
          videos: [
            {
              url: "https://www.pexels.com/video/1",
              image: "https://img/1.jpg",
              duration: 120,
              user: { name: "Ana" },
              video_files: [
                { link: "https://cdn/1.mp4", width: 1920, height: 1080, file_type: "video/mp4" },
              ],
            },
            {
              url: "https://www.pexels.com/video/2",
              image: "https://img/2.jpg",
              duration: 12,
              user: { name: "Luis" },
              video_files: [
                { link: "https://cdn/2-4k.mp4", width: 3840, height: 2160, file_type: "video/mp4" },
                { link: "https://cdn/2-hd.mp4", width: 1280, height: 720, file_type: "video/mp4" },
                { link: "https://cdn/2-v.mp4", width: 720, height: 1280, file_type: "video/mp4" },
              ],
            },
          ],
        }),
        { headers: { "content-type": "application/json" } },
      );
    };
    const v = await findPexelsVideo(["city", "night"], "k", fetchImpl);
    expect(v).toMatchObject({
      src: "https://cdn/2-hd.mp4",
      credit: "Video: Luis / Pexels",
      duration: 12,
      width: 1280,
    });
    expect(await findPexelsVideo(["x"], undefined, fetchImpl)).toBeNull();
    const html = embedVideo(
      "<p>Primero.</p><h2>Sección</h2><p>Segundo.</p>",
      v!,
      "Video de archivo",
    );
    expect(html.indexOf("<figure")).toBeGreaterThan(html.indexOf("Primero."));
    expect(html.indexOf("<figure")).toBeLessThan(html.indexOf("<h2>"));
    expect(html).toContain('poster="https://img/2.jpg"');
    expect(html).toContain("Video: Luis / Pexels");
    expect(embedVideo("sin parrafos", v!, "V")).toContain("<figure");
  });
});
