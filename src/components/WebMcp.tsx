"use client";

import { useEffect } from "react";
import type { Lang } from "@/i18n/config";

type ToolInput = Record<string, unknown>;
type ModelContext = {
  provideContext: (ctx: {
    tools: {
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
      execute: (input: ToolInput) => Promise<unknown> | unknown;
    }[];
  }) => void;
};

async function fetchMarkdown(url: string): Promise<string> {
  const res = await fetch(url, { headers: { Accept: "text/markdown" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * WebMCP: expone las acciones del sitio a agentes que navegan con el usuario
 * (navigator.modelContext). No hace nada en navegadores sin soporte.
 */
export function WebMcp({ lang }: { lang: Lang }) {
  useEffect(() => {
    const ctx = (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
    if (!ctx || typeof ctx.provideContext !== "function") return;
    const searchPath = lang === "en" ? "/en/search" : "/es/buscar";
    const sections: Record<string, string> =
      lang === "en"
        ? {
            economy: "economy",
            sales: "sales",
            technology: "technology",
            crypto: "crypto",
            artists: "artists",
          }
        : {
            economia: "economia",
            ventas: "ventas",
            tecnologia: "tecnologia",
            cripto: "cripto",
            artistas: "artistas",
          };
    try {
      ctx.provideContext({
        tools: [
          {
            name: "search_losupe",
            description:
              "Search losupe news and guides (economy, sales, tech & AI, crypto, trends). Returns Markdown with titles, links, dates and summaries.",
            inputSchema: {
              type: "object",
              properties: { query: { type: "string", description: "Search term (2–80 chars)" } },
              required: ["query"],
            },
            execute: ({ query }) =>
              fetchMarkdown(`${searchPath}?q=${encodeURIComponent(String(query ?? ""))}`),
          },
          {
            name: "latest_losupe_stories",
            description:
              "Latest losupe stories, optionally for one section. Returns Markdown with titles, links, dates and summaries.",
            inputSchema: {
              type: "object",
              properties: {
                section: {
                  type: "string",
                  enum: Object.keys(sections),
                  description: "Section slug (optional)",
                },
              },
            },
            execute: ({ section }) => {
              const slug = typeof section === "string" ? sections[section] : undefined;
              return fetchMarkdown(slug ? `/${lang}/${slug}` : `/${lang}`);
            },
          },
          {
            name: "read_losupe_story",
            description: "Read a losupe story as Markdown. Pass the story URL or path.",
            inputSchema: {
              type: "object",
              properties: {
                url: { type: "string", description: "Story URL or path on losupe.com" },
              },
              required: ["url"],
            },
            execute: ({ url }) => {
              const u = new URL(String(url ?? ""), window.location.origin);
              if (u.origin !== window.location.origin)
                throw new Error("Only losupe URLs are supported");
              return fetchMarkdown(u.pathname + u.search);
            },
          },
        ],
      });
    } catch {
      /* sin soporte o bloqueado: no pasa nada */
    }
  }, [lang]);
  return null;
}
