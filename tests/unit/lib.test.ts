import { describe, expect, it } from "vitest";
import { isValidSlug, slugify } from "@/lib/slug";
import {
  decodeEntities,
  escapeHtml,
  excerptFrom,
  readingMinutes,
  sanitizeHtml,
  stripHtml,
  wordCount,
} from "@/lib/html";
import { formatDate, todayKey, toIso, toRfc822 } from "@/lib/dates";
import { parseCsv } from "@/lib/csv";
import { buildNewsSitemap, buildRss, escapeXml } from "@/lib/rss";
import { parseEnv } from "@/env";

describe("slugify", () => {
  it("quita acentos, eñes y símbolos", () => {
    expect(slugify("Bitcoin rompe el soporte de $90K ¡Ñandú!")).toBe(
      "bitcoin-rompe-el-soporte-de-90k-nandu",
    );
  });
  it("corta en un guion sin pasarse del máximo", () => {
    const s = slugify("palabra ".repeat(40), 50);
    expect(s.length).toBeLessThanOrEqual(50);
    expect(s.endsWith("-")).toBe(false);
  });
  it("valida slugs limpios", () => {
    expect(isValidSlug("hola-mundo-2")).toBe(true);
    expect(isValidSlug("Hola Mundo")).toBe(false);
    expect(isValidSlug("-mal")).toBe(false);
  });
});

describe("html", () => {
  it("stripHtml deja texto plano y decodifica entidades", () => {
    expect(stripHtml("<p>Hola&nbsp;<b>mundo</b> &amp; m&aacute;s</p>")).toBe(
      "Hola mundo & m&aacute;s",
    );
    expect(decodeEntities("&#8220;x&#8221; &#x41;")).toBe("“x” A");
  });
  it("sanitizeHtml elimina scripts, manejadores, javascript: e imágenes base64", () => {
    const dirty =
      '<p onclick="x()">Hola</p><script>alert(1)</script><a href="javascript:evil()">l</a><img src="data:image/png;base64,AAA"><iframe src="x"></iframe>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("data:image");
    expect(clean).not.toContain("<iframe");
    expect(clean).toContain("<p>Hola</p>");
  });
  it("sanitizeHtml baja los h1 del cuerpo a h2 (un solo h1 por página)", () => {
    expect(sanitizeHtml('<h1 class="x">Sub</h1><h1>Otro</h1><h2>ok</h2>')).toBe(
      '<h2 class="x">Sub</h2><h2>Otro</h2><h2>ok</h2>',
    );
  });
  it("excerpt, palabras y minutos de lectura", () => {
    const text = "palabra ".repeat(450);
    expect(wordCount(text)).toBe(450);
    expect(readingMinutes(text)).toBe(2);
    expect(readingMinutes("hola")).toBe(1);
    const ex = excerptFrom(text, 50);
    expect(ex.length).toBeLessThanOrEqual(51);
    expect(ex.endsWith("…")).toBe(true);
    expect(excerptFrom("corto")).toBe("corto");
  });
  it("escapeHtml", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
    );
  });
});

describe("dates", () => {
  it("normaliza fechas de Postgres a ISO", () => {
    expect(toIso("2025-09-30 20:56:30.456035+00")).toBe("2025-09-30T20:56:30.456Z");
    expect(toIso("")).toBeNull();
    expect(toIso("no es fecha")).toBeNull();
  });
  it("formatea por idioma en hora del este", () => {
    const iso = "2025-11-20T15:00:00.000Z";
    expect(formatDate(iso, "es")).toMatch(/20 de noviembre de 2025/);
    expect(formatDate(iso, "en")).toBe("November 20, 2025");
    expect(formatDate("basura", "en")).toBe("");
  });
  it("rfc822 y clave de día", () => {
    expect(toRfc822("2025-11-20T15:00:00.000Z")).toBe("Thu, 20 Nov 2025 15:00:00 GMT");
    expect(todayKey(new Date("2025-11-20T15:00:00.000Z"))).toBe("2025-11-20");
  });
});

describe("csv", () => {
  it("lee campos con comillas, punto y coma y saltos de línea", () => {
    const text =
      '﻿id;title;content\n1;"Hola; mundo";"<p>línea 1\nlínea 2</p>"\n2;Simple;"con ""comillas"""\n';
    const rows = parseCsv(text, ";");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.title).toBe("Hola; mundo");
    expect(rows[0]?.content).toBe("<p>línea 1\nlínea 2</p>");
    expect(rows[1]?.content).toBe('con "comillas"');
  });
  it("devuelve vacío sin encabezado", () => {
    expect(parseCsv("")).toEqual([]);
  });
});

describe("rss", () => {
  it("escapa xml y arma el canal con sus items", () => {
    expect(escapeXml(`a & <b> "c" 'd'`)).toBe("a &amp; &lt;b&gt; &quot;c&quot; &apos;d&apos;");
    const xml = buildRss(
      {
        title: "losupe",
        link: "https://losupe.com/es",
        description: "d",
        language: "es-us",
        selfUrl: "https://losupe.com/es/rss.xml",
        imageUrl: "https://losupe.com/brand/logo-512.png",
      },
      [
        {
          title: "Nota & más",
          link: "https://losupe.com/es/cripto/nota",
          guid: "https://losupe.com/es/cripto/nota",
          description: "texto",
          pubDate: "2025-11-20T15:00:00.000Z",
          author: "Kevin",
          category: "Cripto",
          imageUrl: "https://losupe.com/img/x.webp",
        },
      ],
    );
    expect(xml).toContain("<title>Nota &amp; más</title>");
    expect(xml).toContain('<media:content url="https://losupe.com/img/x.webp"');
    expect(xml).toContain("<dc:creator>Kevin</dc:creator>");
    expect(xml).toContain("<image>");
  });
  it("arma el news sitemap", () => {
    const xml = buildNewsSitemap("losupe", [
      {
        loc: "https://losupe.com/es/cripto/a",
        title: "A",
        publicationDate: "2025-11-20T15:00:00.000Z",
        language: "es",
      },
    ]);
    expect(xml).toContain("<news:name>losupe</news:name>");
    expect(xml).toContain("<news:title>A</news:title>");
  });
});

describe("env", () => {
  it("acepta URL válida y quita la barra final", () => {
    expect(parseEnv({ NEXT_PUBLIC_SITE_URL: "https://losupe.com/" }).NEXT_PUBLIC_SITE_URL).toBe(
      "https://losupe.com",
    );
  });
  it("permite vacío o ausente", () => {
    expect(parseEnv({}).NEXT_PUBLIC_SITE_URL).toBeUndefined();
    expect(parseEnv({ NEXT_PUBLIC_SITE_URL: "" }).NEXT_PUBLIC_SITE_URL).toBeUndefined();
  });
  it("rechaza basura", () => {
    expect(() => parseEnv({ NEXT_PUBLIC_SITE_URL: "no-es-url" })).toThrow();
  });
});
