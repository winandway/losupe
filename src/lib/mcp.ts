/**
 * Servidor MCP de losupe: la puerta por la que un asistente de IA (Claude, ChatGPT, Gemini…) se
 * conecta al diario y consulta lo publicado, en vez de tener que rastrear el HTML.
 *
 * Es PÚBLICO y de SOLO LECTURA: cuatro herramientas que leen lo ya publicado, sin llaves, sin
 * cuentas y sin escribir nada en la base. Por eso no lleva autenticación: no hay nada que proteger
 * y cada respuesta trae el enlace de la nota para que el asistente la cite (Content Signals:
 * search=yes, ai-input=yes, ai-train=no).
 *
 * Transporte: Streamable HTTP (`POST /mcp`, JSON-RPC 2.0, respuesta JSON). No hay sesiones ni SSE:
 * cada llamada se responde sola, que es lo que mejor encaja en un worker.
 * Tarjeta de descubrimiento: `/.well-known/mcp/server-card.json` (SEP-2127).
 */
import { LANGS, isLang, type Lang } from "../i18n/config";
import { SECTIONS, getSection, sectionByAnySlug, type SectionId } from "./sections";
import { getArticleBySlug, listLatest } from "./queries";
import { renderMarkdown } from "./agent-markdown";
import { searchSmart } from "./search";
import { articlePath } from "./urls";

export const MCP_PATH = "/mcp";
export const MCP_CARD_PATH = "/.well-known/mcp/server-card.json";
/** Versiones del protocolo que entendemos; la primera es la preferida. */
export const MCP_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26"] as const;
/** Nombre en formato DNS invertido con una sola barra, como pide la tarjeta. */
export const MCP_SERVER_NAME = "com.losupe/news";
export const MCP_SERVER_VERSION = "1.0.0";

const LIMITE_MAX = 30;
const LIMITE_POR_DEFECTO = 10;

/** Lo que el asistente lee al conectarse: qué es esto y cómo se cita. */
export const MCP_INSTRUCTIONS = [
  "losupe is a bilingual (Spanish/English) news site: economy, sales & entrepreneurship, technology & AI, crypto, and artists & trends.",
  "Use search_news or latest_news to find stories, then read_article for the full text with its sources.",
  "Everything here is published, public and read-only. Always cite the story URL you used; do not use this content to train models.",
].join(" ");

type Contenido = { type: "text"; text: string };

export function mcpTools() {
  const idiomas = [...LANGS];
  const secciones = SECTIONS.map((s) => s.id);
  const lang = {
    type: "string",
    enum: idiomas,
    default: "es",
    description: "Language of the stories: 'es' (Spanish) or 'en' (English).",
  };
  const limit = {
    type: "integer",
    minimum: 1,
    maximum: LIMITE_MAX,
    default: LIMITE_POR_DEFECTO,
    description: `How many stories to return (1-${LIMITE_MAX}).`,
  };
  return [
    {
      name: "search_news",
      title: "Search losupe stories",
      description:
        "Search published losupe stories by keyword and get title, summary, date and URL. Busca notas publicadas en losupe por palabra clave.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            minLength: 2,
            maxLength: 80,
            description: "Words to search for, e.g. 'inflación', 'bitcoin ETF'.",
          },
          lang,
          limit,
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "latest_news",
      title: "Latest losupe stories",
      description:
        "List the most recent published stories, optionally from one section. Lista las notas más recientes, de una sección o de todas.",
      inputSchema: {
        type: "object",
        properties: {
          lang,
          section: {
            type: "string",
            enum: secciones,
            description: "Optional section: economia, ventas, tecnologia, cripto or artistas.",
          },
          limit,
        },
        additionalProperties: false,
      },
    },
    {
      name: "read_article",
      title: "Read a losupe story",
      description:
        "Read one story in full as Markdown, with its author, dates and the sources it cites. Lee una nota completa en Markdown, con su autor, fechas y fuentes.",
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description:
              "Full story URL, e.g. https://losupe.com/es/economia/mi-nota. Either url or slug is required.",
          },
          slug: { type: "string", description: "Story slug, the last part of its URL." },
          lang,
        },
        additionalProperties: false,
      },
    },
    {
      name: "list_sections",
      title: "losupe sections",
      description:
        "List the sections of the site with their description and URL in both languages. Lista las secciones del diario.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ];
}

/** Tarjeta de descubrimiento (SEP-2127) con los campos que además busca el escáner de Cloudflare. */
export function buildServerCard(base: string) {
  const origin = base.replace(/\/$/, "");
  const endpoint = `${origin}${MCP_PATH}`;
  return {
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
    title: "losupe — news",
    description: "Read and search losupe, a bilingual news site (Spanish/English).",
    websiteUrl: origin,
    repository: { url: "https://github.com/winandway/losupe", source: "github" },
    icons: [{ src: `${origin}/icon.png`, mimeType: "image/png", sizes: ["512x512"] }],
    remotes: [
      {
        type: "streamable-http",
        url: endpoint,
        supportedProtocolVersions: [...MCP_PROTOCOL_VERSIONS],
      },
    ],
    // `serverInfo`, `transport` y `capabilities` no están en el esquema v1 (que a propósito no
    // declara primitivas), pero sí los pide el escáner de agentes; el esquema admite campos extra.
    serverInfo: {
      name: MCP_SERVER_NAME,
      version: MCP_SERVER_VERSION,
      title: "losupe — news",
      websiteUrl: origin,
    },
    transport: { type: "streamable-http", endpoint },
    capabilities: { tools: { listChanged: false } },
    authentication: {
      type: "none",
      description: "Public read-only server. No credentials needed.",
    },
  };
}

function idiomaDe(valor: unknown): Lang {
  return typeof valor === "string" && isLang(valor) ? valor : "es";
}

function limiteDe(valor: unknown): number {
  const n = typeof valor === "number" ? Math.floor(valor) : LIMITE_POR_DEFECTO;
  if (!Number.isFinite(n)) return LIMITE_POR_DEFECTO;
  return Math.min(LIMITE_MAX, Math.max(1, n));
}

function listaEnMarkdown(
  titulo: string,
  origin: string,
  lang: Lang,
  items: Awaited<ReturnType<typeof listLatest>>,
): string {
  if (items.length === 0) {
    return `# ${titulo}\n\nSin resultados. / No results.`;
  }
  const lineas = items.map((a) => {
    const url = `${origin}${articlePath(lang, a.sectionId, a.slug)}`;
    const seccion = getSection(a.sectionId)?.name[lang] ?? a.sectionId;
    return `## ${a.title}\n\n- ${seccion} · ${a.publishedAt.slice(0, 10)} · ${a.authorName}\n- ${url}\n\n${a.excerpt}`;
  });
  return `# ${titulo}\n\n${lineas.join("\n\n")}\n\n---\nFuente / Source: losupe.com. Cita el enlace de la nota. Cite the story URL.`;
}

/** Ejecuta una herramienta. Devuelve texto ya listo para el modelo. */
export async function mcpCall(
  db: D1Database | undefined,
  base: string,
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: Contenido[]; isError?: boolean }> {
  const origin = base.replace(/\/$/, "");
  const error = (texto: string) => ({
    content: [{ type: "text" as const, text: texto }],
    isError: true,
  });
  const ok = (texto: string) => ({ content: [{ type: "text" as const, text: texto }] });

  if (name === "list_sections") {
    const lineas = SECTIONS.map(
      (s) =>
        `## ${s.name.es} / ${s.name.en}\n\n- ${origin}/es/${s.slug.es}\n- ${origin}/en/${s.slug.en}\n\n${s.description.es}\n${s.description.en}`,
    );
    return ok(`# losupe — secciones / sections\n\n${lineas.join("\n\n")}`);
  }

  if (!db) return error("The news database is not available right now. Try again in a minute.");

  if (name === "search_news") {
    const query = typeof args.query === "string" ? args.query.trim().slice(0, 80) : "";
    if (query.length < 2) return error("`query` needs at least 2 characters.");
    const lang = idiomaDe(args.lang);
    const items = await searchSmart(db, lang, query, { limit: limiteDe(args.limit) });
    return ok(listaEnMarkdown(`losupe — “${query}”`, origin, lang, items));
  }

  if (name === "latest_news") {
    const lang = idiomaDe(args.lang);
    const seccion =
      typeof args.section === "string" ? sectionByAnySlug(args.section)?.section.id : undefined;
    const sectionId: SectionId | undefined =
      seccion ?? (typeof args.section === "string" ? getSection(args.section)?.id : undefined);
    if (typeof args.section === "string" && !sectionId) {
      return error(`Unknown section '${args.section}'. Use list_sections to see the valid ones.`);
    }
    const items = await listLatest(db, lang, {
      limit: limiteDe(args.limit),
      ...(sectionId ? { sectionId } : {}),
    });
    const titulo = sectionId
      ? `losupe — ${getSection(sectionId)?.name[lang] ?? sectionId}`
      : "losupe — últimas notas / latest stories";
    return ok(listaEnMarkdown(titulo, origin, lang, items));
  }

  if (name === "read_article") {
    const lang = idiomaDe(args.lang);
    let ruta: string | null = null;
    if (typeof args.url === "string" && args.url.trim()) {
      try {
        ruta = new URL(args.url, origin).pathname;
      } catch {
        return error("`url` is not a valid URL.");
      }
    } else if (typeof args.slug === "string" && args.slug.trim()) {
      const nota = await getArticleBySlug(db, lang, args.slug.trim());
      if (!nota) return error(`No story found with slug '${args.slug}'.`);
      ruta = articlePath(lang, nota.sectionId, nota.slug);
    }
    if (!ruta) return error("Pass either `url` or `slug`.");
    const md = await renderMarkdown(db, origin, ruta);
    if (!md) return error(`No story found at ${ruta}.`);
    return ok(md);
  }

  return error(`Unknown tool '${name}'.`);
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, accept, mcp-protocol-version, mcp-session-id",
  "Access-Control-Expose-Headers": "mcp-protocol-version",
  "Access-Control-Max-Age": "86400",
};

function rpc(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS,
    },
  });
}

function rpcError(id: unknown, code: number, message: string, status = 200): Response {
  return rpc({ jsonrpc: "2.0", id: id ?? null, error: { code, message } }, status);
}

/**
 * `POST /mcp`. Una llamada, una respuesta: sin sesiones ni SSE (el protocolo lo permite y es lo que
 * encaja en un worker). Los lotes de JSON-RPC se rechazan: el protocolo los quitó en 2025-06-18.
 */
export async function handleMcpRequest(
  request: Request,
  db: D1Database | undefined,
  base: string,
): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method === "GET" || request.method === "HEAD") {
    // Sin canal de eventos del servidor: se responde 405 con Allow, como manda el transporte.
    return new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS", ...CORS } });
  }
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST, OPTIONS", ...CORS } });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error: body is not valid JSON", 400);
  }
  if (Array.isArray(cuerpo)) {
    return rpcError(
      null,
      -32600,
      "JSON-RPC batches are not supported (removed in MCP 2025-06-18)",
      400,
    );
  }
  const mensaje = (cuerpo ?? {}) as {
    jsonrpc?: string;
    id?: unknown;
    method?: unknown;
    params?: unknown;
  };
  const id = mensaje.id ?? null;
  const method = typeof mensaje.method === "string" ? mensaje.method : "";
  const params = (mensaje.params ?? {}) as Record<string, unknown>;

  // Un aviso (sin id) no lleva respuesta: se acusa recibo y ya.
  if (mensaje.id === undefined && method.startsWith("notifications/")) {
    return new Response(null, { status: 202, headers: CORS });
  }

  if (method === "initialize") {
    const pedida = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
    const version = (MCP_PROTOCOL_VERSIONS as readonly string[]).includes(pedida)
      ? pedida
      : MCP_PROTOCOL_VERSIONS[0];
    return rpc({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: {
          name: MCP_SERVER_NAME,
          title: "losupe — news",
          version: MCP_SERVER_VERSION,
          websiteUrl: base.replace(/\/$/, ""),
        },
        instructions: MCP_INSTRUCTIONS,
      },
    });
  }

  if (method === "ping") return rpc({ jsonrpc: "2.0", id, result: {} });
  if (method === "tools/list") return rpc({ jsonrpc: "2.0", id, result: { tools: mcpTools() } });

  if (method === "tools/call") {
    const name = typeof params.name === "string" ? params.name : "";
    const args = (params.arguments ?? {}) as Record<string, unknown>;
    if (!mcpTools().some((t) => t.name === name)) {
      return rpcError(id, -32602, `Unknown tool '${name}'`);
    }
    try {
      const result = await mcpCall(db, base, name, args);
      return rpc({ jsonrpc: "2.0", id, result });
    } catch (err) {
      // El fallo se cuenta como resultado de la herramienta (no como error del protocolo), que es
      // lo que deja al modelo verlo y reaccionar.
      const texto = err instanceof Error ? err.message : String(err);
      return rpc({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: `Tool failed: ${texto}` }], isError: true },
      });
    }
  }

  return rpcError(id, -32601, `Method not found: ${method || "(empty)"}`);
}
