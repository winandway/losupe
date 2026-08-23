/**
 * Señales para buscadores y agentes de IA: robots.txt con Content Signals y reglas por bot,
 * llms.txt, catálogo de APIs (RFC 9727) y cabeceras Link (RFC 8288).
 */
import { LANGS, type Lang } from "../i18n/config";
import { SECTIONS } from "./sections";
import { aboutPath, homePath, rssPath, sectionPath } from "./urls";

/** Bots de IA conocidos a los que se les habla explícitamente en robots.txt. */
export const AI_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "Bytespider",
  "CCBot",
  "meta-externalagent",
  "cohere-ai",
  "DuckAssistBot",
  "MistralAI-User",
] as const;

/**
 * Preferencias de uso del contenido (Content Signals):
 * search = sí (queremos salir en buscadores y respuestas con enlace),
 * ai-input = sí (los asistentes pueden leer y citar),
 * ai-train = no (no se autoriza entrenar modelos con nuestro contenido).
 */
export const CONTENT_SIGNALS = "search=yes, ai-input=yes, ai-train=no";

export function buildRobotsTxt(base: string): string {
  const origin = base.replace(/\/$/, "");
  const lines: string[] = [
    "# losupe — robots.txt",
    "# Content Signals (https://contentsignals.org): search=yes, ai-input=yes, ai-train=no.",
    "# Se permite rastrear, indexar y citar con enlace. No se autoriza entrenar modelos con este contenido.",
    "",
    "User-agent: *",
    `Content-Signal: ${CONTENT_SIGNALS}`,
    "Allow: /",
    "Disallow: /__scheduled",
    "Disallow: /__health",
    "Disallow: /*?q=",
    "",
  ];
  for (const bot of AI_BOTS) {
    lines.push(`User-agent: ${bot}`, `Content-Signal: ${CONTENT_SIGNALS}`, "Allow: /", "");
  }
  lines.push(
    `Sitemap: ${origin}/sitemap.xml`,
    `Sitemap: ${origin}/news-sitemap.xml`,
    `Host: ${origin}`,
    "",
  );
  return lines.join("\n");
}

export type LlmsArticle = { title: string; url: string; excerpt?: string; date?: string };

export function buildLlmsTxt(base: string, latest: Record<Lang, LlmsArticle[]>): string {
  const origin = base.replace(/\/$/, "");
  const abs = (p: string) => `${origin}${p}`;
  const lines: string[] = [
    "# losupe",
    "",
    "> losupe es un medio digital bilingüe (español e inglés) con noticias y guías de economía, ventas y emprendimiento, tecnología e inteligencia artificial, criptomonedas y tendencias, explicadas en claro cada mañana.",
    "> losupe is a bilingual (Spanish/English) digital publication covering the economy, sales and entrepreneurship, technology and AI, crypto, and trends, explained clearly every morning.",
    "",
    "Cada nota está disponible en HTML y en Markdown: pide la misma URL con la cabecera `Accept: text/markdown`.",
    "Every story is available as HTML and as Markdown: request the same URL with `Accept: text/markdown`.",
    "",
    "## Portadas / Home",
    "",
    `- [Portada en español](${abs(homePath("es"))})`,
    `- [Home in English](${abs(homePath("en"))})`,
    "",
    "## Secciones / Sections",
    "",
  ];
  for (const s of SECTIONS) {
    lines.push(`- [${s.name.es}](${abs(sectionPath("es", s.id))}): ${s.description.es}`);
    lines.push(`- [${s.name.en}](${abs(sectionPath("en", s.id))}): ${s.description.en}`);
  }
  lines.push("", "## Feeds y mapas / Feeds and sitemaps", "");
  for (const lang of LANGS) lines.push(`- [RSS ${lang}](${abs(rssPath(lang))})`);
  lines.push(
    `- [Sitemap](${abs("/sitemap.xml")})`,
    `- [News sitemap](${abs("/news-sitemap.xml")})`,
    "",
  );
  lines.push("## Sobre el medio / About", "");
  lines.push(
    `- [Acerca de losupe](${abs(aboutPath("es"))})`,
    `- [About losupe](${abs(aboutPath("en"))})`,
    "",
  );
  for (const lang of LANGS) {
    const items = latest[lang];
    if (!items || items.length === 0) continue;
    lines.push(lang === "es" ? "## Últimas notas (español)" : "## Latest stories (English)", "");
    for (const a of items) {
      lines.push(
        `- [${a.title}](${a.url})${a.date ? ` — ${a.date.slice(0, 10)}` : ""}${a.excerpt ? `: ${a.excerpt}` : ""}`,
      );
    }
    lines.push("");
  }
  lines.push(
    "## Optional",
    "",
    `- [Política editorial](${abs("/es/politica-editorial")})`,
    `- [Editorial policy](${abs("/en/editorial-policy")})`,
    "",
  );
  return lines.join("\n");
}

/** Catálogo de APIs/recursos públicos (RFC 9727, formato linkset). */
export function buildApiCatalog(base: string) {
  const origin = base.replace(/\/$/, "");
  return {
    linkset: [
      {
        anchor: `${origin}/`,
        "service-desc": [{ href: `${origin}/llms.txt`, type: "text/plain" }],
        "service-doc": [{ href: `${origin}/es/acerca`, type: "text/html" }],
        item: [
          { href: `${origin}/sitemap.xml`, type: "application/xml", title: "Sitemap" },
          { href: `${origin}/news-sitemap.xml`, type: "application/xml", title: "News sitemap" },
          { href: `${origin}/es/rss.xml`, type: "application/rss+xml", title: "RSS (es)" },
          { href: `${origin}/en/rss.xml`, type: "application/rss+xml", title: "RSS (en)" },
          {
            href: `${origin}/es/{section}/{slug}`,
            type: "text/markdown",
            title: "Cualquier nota en Markdown con Accept: text/markdown",
          },
        ],
      },
    ],
  };
}

/** Cabecera Link (RFC 8288) para respuestas HTML: sitemap, llms.txt, feed y versión Markdown. */
export function buildLinkHeader(base: string, pathname: string, lang: Lang | null): string {
  const origin = base.replace(/\/$/, "");
  const parts = [
    `<${origin}/sitemap.xml>; rel="sitemap"; type="application/xml"`,
    `<${origin}/llms.txt>; rel="llms-txt"; type="text/plain"`,
    `<${origin}/.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"`,
  ];
  if (lang) {
    parts.push(`<${origin}${rssPath(lang)}>; rel="alternate"; type="application/rss+xml"`);
    parts.push(`<${origin}${pathname}>; rel="alternate"; type="text/markdown"`);
  }
  return parts.join(", ");
}
