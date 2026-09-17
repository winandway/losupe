/**
 * Manifiestos para agentes de IA servidos desde el worker:
 * - /.well-known/api-catalog           (RFC 9727, linkset)
 * - /.well-known/ai-catalog.json       (ARD — Agentic Resource Discovery)
 * - /.well-known/agent-skills/index.json + /.well-known/agent-skills/losupe-news/SKILL.md
 * - /auth.md                           (Auth.md: cómo se identifica un agente; aquí, sin llaves)
 */
import { buildApiCatalog } from "./agent-discovery";
import { MCP_CARD_PATH, MCP_PATH, MCP_SERVER_NAME } from "./mcp";

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
        identifier: urn("mcp", "news-server"),
        displayName: "Servidor MCP de losupe (buscar y leer notas) / losupe MCP server",
        type: "application/json",
        url: `${origin}${MCP_CARD_PATH}`,
        mcp: {
          name: MCP_SERVER_NAME,
          transport: "streamable-http",
          endpoint: `${origin}${MCP_PATH}`,
          serverCard: `${origin}${MCP_CARD_PATH}`,
        },
        representativeQueries: [
          "Conéctame al servidor MCP de losupe para buscar noticias",
          "Connect to the losupe MCP server and read the latest stories",
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

/**
 * `/auth.md`: cómo se identifica un agente ante losupe. La respuesta honesta es «no hace falta
 * nada»: todo lo que servimos es público y de solo lectura, así que no hay OAuth ni registro que
 * publicar. El estándar admite justo este caso —un auth.md autocontenido— y decirlo por escrito
 * evita que un agente pierda tiempo buscando una puerta que no existe.
 */
export function buildAuthMd(base: string): string {
  const origin = base.replace(/\/$/, "");
  return `# auth.md — losupe

Audience: AI agents and automated clients reading ${origin}.

## Do I need credentials?

**No.** Everything losupe serves to agents is published, public and read-only:

- MCP server (Streamable HTTP): \`${origin}${MCP_PATH}\` — no token, no account, no registration.
- Server card: \`${origin}${MCP_CARD_PATH}\`
- Any page as Markdown: send \`Accept: text/markdown\` to any URL.
- Feeds: \`${origin}/es/rss.xml\`, \`${origin}/en/rss.xml\`. Sitemaps: \`${origin}/sitemap.xml\`, \`${origin}/news-sitemap.xml\`.
- Site guide for models: \`${origin}/llms.txt\`. API catalog: \`${origin}/.well-known/api-catalog\`.

There is no OAuth authorization server and no protected resource, so
\`/.well-known/oauth-authorization-server\` and \`/.well-known/oauth-protected-resource\` are not
published. Publishing them empty would send agents to a door that does not open.

## Registration

None. There is nothing to register for and no credential to claim or revoke. If that ever changes
(for example, a paid bulk feed), this file and the OAuth metadata will be published together.

## How to identify yourself

Send a descriptive \`User-Agent\` with a contact URL, e.g.
\`MyAgent/1.0 (+https://example.com/bot)\`. It is not required, but it is what we look at if we
ever need to reach you about traffic.

## Terms of use

- Content Signals (robots.txt): \`search=yes, ai-input=yes, ai-train=no\`.
- You may read, quote and summarize with a link to the story URL. You may **not** use this content
  to train models.
- Be reasonable with request volume. The private dashboard at \`/panel\` is not part of this and is
  off limits.

## Contact

Commercial or bulk access: ${origin}/es/contacto
`;
}
