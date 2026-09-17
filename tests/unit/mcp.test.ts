import { describe, expect, it } from "vitest";
import {
  buildServerCard,
  handleMcpRequest,
  MCP_PATH,
  MCP_PROTOCOL_VERSIONS,
  mcpTools,
} from "@/lib/mcp";
import { buildAuthMd } from "@/lib/agent-manifests";
import { FakeD1, sampleCardRow, sampleFullRow } from "./fake-d1";

/**
 * Candado 54 — el servidor MCP público de losupe (17 sep 2026). Por aquí entra un asistente de IA
 * a buscar y leer notas; si se rompe, los asistentes dejan de poder citarnos.
 */

const BASE = "https://losupe.com";

const pedir = (body: unknown, init: RequestInit = {}) =>
  new Request(`${BASE}${MCP_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    ...init,
  });

const baseDatos = () =>
  new FakeD1((sql) => {
    if (sql.includes("MATCH")) return [{ article_id: sampleCardRow.id }];
    if (sql.includes("a.id IN (")) return [sampleCardRow];
    if (sql.includes("FROM article_i18n")) return [sampleFullRow];
    if (sql.includes("FROM articles")) return [sampleFullRow];
    return [];
  });

async function llamar(metodo: string, params: unknown = {}, db = baseDatos()) {
  const res = await handleMcpRequest(
    pedir({ jsonrpc: "2.0", id: 1, method: metodo, params }),
    db.asD1(),
    BASE,
  );
  return { res, cuerpo: (await res.json()) as Record<string, never> };
}

describe("servidor MCP: el saludo", () => {
  it("responde con la versión del protocolo, sus herramientas y quién es", async () => {
    const { res, cuerpo } = await llamar("initialize", { protocolVersion: "2025-06-18" });
    expect(res.status).toBe(200);
    const result = cuerpo.result as never as {
      protocolVersion: string;
      capabilities: { tools: unknown };
      serverInfo: { name: string; version: string };
      instructions: string;
    };
    expect(result.protocolVersion).toBe("2025-06-18");
    expect(result.capabilities.tools).toBeDefined();
    expect(result.serverInfo.name).toBe("com.losupe/news");
    expect(result.serverInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
    // Lo primero que lee el asistente: que cite el enlace y que no entrene con esto.
    expect(result.instructions).toContain("cite");
  });

  it("si el cliente pide una versión que no entendemos, se le ofrece la nuestra", async () => {
    const { cuerpo } = await llamar("initialize", { protocolVersion: "1999-01-01" });
    expect((cuerpo.result as never as { protocolVersion: string }).protocolVersion).toBe(
      MCP_PROTOCOL_VERSIONS[0],
    );
  });

  it("un aviso no lleva respuesta (202) y los lotes se rechazan", async () => {
    const aviso = await handleMcpRequest(
      pedir({ jsonrpc: "2.0", method: "notifications/initialized" }),
      baseDatos().asD1(),
      BASE,
    );
    expect(aviso.status).toBe(202);
    const lote = await handleMcpRequest(
      pedir([{ jsonrpc: "2.0", id: 1, method: "ping" }]),
      baseDatos().asD1(),
      BASE,
    );
    expect(lote.status).toBe(400);
  });

  it("GET no sirve (no hay canal de eventos) y OPTIONS deja pasar al navegador", async () => {
    const get = await handleMcpRequest(new Request(`${BASE}${MCP_PATH}`), undefined, BASE);
    expect(get.status).toBe(405);
    expect(get.headers.get("Allow")).toContain("POST");
    const options = await handleMcpRequest(
      new Request(`${BASE}${MCP_PATH}`, { method: "OPTIONS" }),
      undefined,
      BASE,
    );
    expect(options.status).toBe(204);
    expect(options.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("un método que no existe devuelve error de protocolo, no una caída", async () => {
    const { cuerpo } = await llamar("resources/list");
    expect((cuerpo.error as never as { code: number }).code).toBe(-32601);
  });

  it("un cuerpo que no es JSON no tumba el servidor", async () => {
    const res = await handleMcpRequest(
      new Request(`${BASE}${MCP_PATH}`, { method: "POST", body: "{" }),
      undefined,
      BASE,
    );
    expect(res.status).toBe(400);
  });
});

describe("servidor MCP: las herramientas", () => {
  it("las cuatro se anuncian con su esquema de entrada", async () => {
    const { cuerpo } = await llamar("tools/list");
    const tools = (cuerpo.result as never as { tools: { name: string; inputSchema: unknown }[] })
      .tools;
    expect(tools.map((t) => t.name).sort()).toEqual([
      "latest_news",
      "list_sections",
      "read_article",
      "search_news",
    ]);
    for (const t of tools) expect(t.inputSchema).toMatchObject({ type: "object" });
    expect(mcpTools()).toHaveLength(4);
  });

  it("buscar devuelve titular, fecha y SIEMPRE el enlace completo de la nota", async () => {
    const { cuerpo } = await llamar("tools/call", {
      name: "search_news",
      arguments: { query: "bitcoin", lang: "es", limit: 5 },
    });
    const texto = (cuerpo.result as never as { content: { text: string }[] }).content[0]!.text;
    expect(texto).toContain("https://losupe.com/es/");
    // Sin el enlace el asistente no puede citarnos, que es justo lo que buscamos.
    expect(texto).toMatch(/Cita el enlace|Cite the story URL/);
  });

  it("las últimas notas se pueden pedir por sección, y una sección inventada avisa", async () => {
    const { cuerpo } = await llamar("tools/call", {
      name: "latest_news",
      arguments: { lang: "es", section: "cripto" },
    });
    expect((cuerpo.result as never as { isError?: boolean }).isError).toBeUndefined();
    const malo = await llamar("tools/call", {
      name: "latest_news",
      arguments: { section: "deportes" },
    });
    const r = malo.cuerpo.result as never as { isError: boolean; content: { text: string }[] };
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toContain("deportes");
  });

  it("leer una nota exige url o slug", async () => {
    const { cuerpo } = await llamar("tools/call", { name: "read_article", arguments: {} });
    const r = cuerpo.result as never as { isError: boolean; content: { text: string }[] };
    expect(r.isError).toBe(true);
    expect(r.content[0]!.text).toContain("slug");
  });

  it("las secciones se listan sin tocar la base (funciona aunque la base no esté)", async () => {
    const res = await handleMcpRequest(
      pedir({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name: "list_sections" } }),
      undefined,
      BASE,
    );
    const cuerpo = (await res.json()) as { result: { content: { text: string }[] } };
    const texto = cuerpo.result.content[0]!.text;
    expect(texto).toContain("https://losupe.com/es/economia");
    expect(texto).toContain("https://losupe.com/en/economy");
  });

  it("si la base no responde, se avisa como resultado de la herramienta, no como caída", async () => {
    const rota = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [] }) }) }) };
    const res = await handleMcpRequest(
      pedir({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "search_news", arguments: { query: "x" } },
      }),
      rota as unknown as D1Database,
      BASE,
    );
    const cuerpo = (await res.json()) as { result: { isError?: boolean } };
    expect(cuerpo.result.isError).toBe(true);
  });

  it("una herramienta que no existe no se ejecuta", async () => {
    const { cuerpo } = await llamar("tools/call", { name: "borrar_todo", arguments: {} });
    expect((cuerpo.error as never as { code: number }).code).toBe(-32602);
  });
});

describe("tarjeta del servidor y auth.md", () => {
  it("la tarjeta dice quién es, dónde conectarse y qué sabe hacer", () => {
    const card = buildServerCard(BASE);
    expect(card.$schema).toContain("server-card.schema.json");
    expect(card.name).toMatch(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/);
    expect(card.serverInfo.name).toBe(card.name);
    expect(card.transport.endpoint).toBe("https://losupe.com/mcp");
    expect(card.remotes[0]).toMatchObject({
      type: "streamable-http",
      url: card.transport.endpoint,
    });
    expect(card.capabilities.tools).toBeDefined();
    expect(card.description.length).toBeLessThanOrEqual(100);
  });

  it("auth.md dice la verdad: no hace falta ninguna llave, y por qué no hay OAuth", () => {
    const md = buildAuthMd(BASE);
    expect(md.split("\n")[0]).toMatch(/^# .*auth\.md/i);
    expect(md).toContain("https://losupe.com/mcp");
    expect(md).toContain("ai-train=no");
    // Nada de prometer una puerta que no existe.
    expect(md).toMatch(/no OAuth authorization server|not published/);
  });
});
