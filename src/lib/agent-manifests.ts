/**
 * Manifiestos para agentes de IA servidos desde el worker:
 * - /.well-known/api-catalog           (RFC 9727, linkset)
 * - /.well-known/ai-catalog.json       (ARD — Agentic Resource Discovery)
 * - /.well-known/agent-skills/index.json + /.well-known/agent-skills/losupe-news/SKILL.md
 */
import { buildApiCatalog } from "./agent-discovery";

export { buildApiCatalog };

export function buildAiCatalog(base: string) {
  const origin = base.replace(/\/$/, "");
  const host = new URL(origin).host;
  const urn = (ns: string, name: string) => `urn:air:${host}:${ns}:${name}`;
  return {
    specVersion: "0.1",
    host: {
      name: "losupe",
      url: origin,
      description:
        "Medio digital bilingüe (español/inglés): economía, ventas y emprendimiento, tecnología e IA, cripto y tendencias. Bilingual news site.",
    },
    entries: [
      {
        identifier: urn("content", "llms-txt"),
        displayName: "Guía del sitio para modelos (llms.txt)",
        type: "text/plain",
        url: `${origin}/llms.txt`,
        representativeQueries: [
          "¿Qué es losupe y qué secciones tiene?",
          "What does losupe cover and how do I read it as Markdown?",
          "¿Cuáles son las últimas notas de losupe?",
        ],
      },
      {
        identifier: urn("feeds", "rss-es"),
        displayName: "Últimas notas en español (RSS)",
        type: "application/rss+xml",
        url: `${origin}/es/rss.xml`,
        representativeQueries: [
          "Últimas noticias de economía y emprendimiento en español",
          "¿Qué publicó losupe hoy?",
        ],
      },
      {
        identifier: urn("feeds", "rss-en"),
        displayName: "Latest stories in English (RSS)",
        type: "application/rss+xml",
        url: `${origin}/en/rss.xml`,
        representativeQueries: [
          "Latest losupe stories in English",
          "What did losupe publish today?",
        ],
      },
      {
        identifier: urn("content", "markdown-articles"),
        displayName: "Cualquier nota en Markdown (Accept: text/markdown)",
        type: "text/markdown",
        url: `${origin}/es`,
        representativeQueries: [
          "Dame el texto completo de una nota de losupe en Markdown",
          "Read a losupe article as Markdown",
        ],
      },
      {
        identifier: urn("discovery", "sitemap"),
        displayName: "Sitemap",
        type: "application/xml",
        url: `${origin}/sitemap.xml`,
        representativeQueries: ["Lista de todas las páginas de losupe", "All losupe URLs"],
      },
    ],
  };
}

export const SKILL_NAME = "losupe-news";

export function buildSkillMarkdown(base: string): string {
  const origin = base.replace(/\/$/, "");
  return `---
name: ${SKILL_NAME}
description: Read and search losupe (bilingual Spanish/English news on economy, sales, tech & AI, crypto and trends) as clean Markdown, RSS or sitemap.
---

# losupe news skill

losupe (${origin}) publishes short news and evergreen guides every morning in Spanish (/es) and English (/en).

## How to read content

- Any page or story: request the same URL with the header \`Accept: text/markdown\` and you get Markdown (\`Content-Type: text/markdown\`).
  - Home: \`${origin}/es\` or \`${origin}/en\`
  - Section: \`${origin}/es/economia\`, \`${origin}/en/economy\`, \`/es/ventas\`, \`/en/sales\`, \`/es/tecnologia\`, \`/en/technology\`, \`/es/cripto\`, \`/en/crypto\`, \`/es/artistas\`, \`/en/artists\`
  - Story: \`${origin}/{lang}/{section}/{slug}\`
- Search: \`${origin}/es/buscar?q=TERM\` or \`${origin}/en/search?q=TERM\` (also with \`Accept: text/markdown\`).
- Feeds: \`${origin}/es/rss.xml\`, \`${origin}/en/rss.xml\`. Sitemaps: \`${origin}/sitemap.xml\`, \`${origin}/news-sitemap.xml\`.
- Site guide for models: \`${origin}/llms.txt\`.

## Rules

- Content Signals: search=yes, ai-input=yes, ai-train=no. Cite the story URL when you use it.
- Stories marked as AI-assisted say so at the end; every story lists its sources.
`;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function buildSkillsIndex(base: string) {
  const origin = base.replace(/\/$/, "");
  const md = buildSkillMarkdown(base);
  return {
    $schema: "https://agentskills.io/schemas/discovery/v0.2.0/index.json",
    skills: [
      {
        name: SKILL_NAME,
        type: "skill",
        description:
          "Read and search losupe (bilingual news: economy, sales, tech & AI, crypto, trends) as Markdown, RSS or sitemap.",
        url: `${origin}/.well-known/agent-skills/${SKILL_NAME}/SKILL.md`,
        sha256: await sha256Hex(md),
      },
    ],
  };
}
