import { decodeEntities, stripHtml } from "@/lib/html";

/**
 * Investigación del robot: lee páginas web (la del patrocinador, las fuentes de una noticia) y
 * deja texto plano limpio para que el redactor trabaje con datos reales y cite de dónde salen.
 * Nunca se pega a servicios pagos desde aquí salvo Brave (opcional, con llave).
 */

export const BOT_USER_AGENT = "losupe-bot/1.0 (+https://losupe.com/es/politica-editorial)";

export type FetchedPage = {
  url: string;
  title: string;
  description: string;
  text: string;
  status: number;
};

export type Research = {
  site: string;
  pages: FetchedPage[];
  totalChars: number;
  errors: string[];
  fetchedAt: string;
};

type FetchOpts = { fetchImpl?: typeof fetch; timeoutMs?: number; maxChars?: number };

const SKIP_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|zip|mp4|mp3|css|js|xml|json|ico|woff2?)(\?|$)/i;

function pickMain(html: string): string {
  const noNoise = html
    .replace(/<(script|style|noscript|svg|iframe|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const main = noNoise.match(/<(main|article)[^>]*>([\s\S]*?)<\/\1>/i);
  return main?.[2] ?? noNoise;
}

function metaContent(html: string, name: string): string {
  // Se recorren todas las <meta> con un patrón literal y se compara el nombre por igualdad.
  const want = name.toLowerCase();
  for (const m of html.matchAll(/<meta\s[^>]*>/gi)) {
    const tag = m[0];
    const key = (tag.match(/\s(?:name|property)\s*=\s*["']([^"']*)["']/i)?.[1] ?? "").toLowerCase();
    if (key !== want) continue;
    const content = tag.match(/\scontent\s*=\s*["']([^"']*)["']/i)?.[1];
    if (content) return decodeEntities(content).trim();
  }
  return "";
}

/** Descarga una página y devuelve su texto útil (o null si no es HTML o falló). */
export async function fetchPage(url: string, opts: FetchOpts = {}): Promise<FetchedPage | null> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  try {
    const res = await fetchImpl(url, {
      headers: { "User-Agent": BOT_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !/html|xml/i.test(type)) {
      return { url, title: "", description: "", text: "", status: res.status };
    }
    const html = await res.text();
    const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const description = metaContent(html, "description") || metaContent(html, "og:description");
    const text = stripHtml(pickMain(html)).slice(0, opts.maxChars ?? 12_000);
    return { url: res.url || url, title, description, text, status: res.status };
  } catch {
    return null;
  }
}

/** Enlaces internos (mismo dominio) de una página, sin repetidos ni archivos. */
export function extractLinks(html: string, baseUrl: string, limit = 60): string[] {
  const base = new URL(baseUrl);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    try {
      const u = new URL(m[1] ?? "", base);
      if (!/^https?:$/.test(u.protocol)) continue;
      if (u.host !== base.host) continue;
      if (SKIP_EXT.test(u.pathname)) continue;
      u.hash = "";
      const key = u.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(key);
      if (out.length >= limit) break;
    } catch {
      /* enlace inválido */
    }
  }
  return out;
}

const USEFUL = [
  /about|nosotros|quienes|somos|empresa|company/i,
  /como-funciona|how-it-works|funciona/i,
  /servicio|service|producto|product|catalogo|catalog|soluci/i,
  /precio|pricing|plan|tarifa|comision/i,
  /faq|preguntas|ayuda|help|docs|documentacion/i,
  /prensa|press|noticias|news|blog/i,
  /contacto|contact|vender|sell/i,
];

/** Ordena los enlaces de un sitio: primero los que suelen explicar la empresa. */
export function rankSiteLinks(links: readonly string[], home: string): string[] {
  const homeUrl = new URL(home);
  const score = (u: string) => {
    const path = new URL(u).pathname;
    let s = 0;
    USEFUL.forEach((re, i) => {
      if (re.test(path)) s += 20 - i;
    });
    s -= Math.min(path.split("/").filter(Boolean).length, 5);
    if (new URL(u).search) s -= 5;
    return s;
  };
  return [...links]
    .filter((u) => new URL(u).pathname !== homeUrl.pathname)
    .sort((a, b) => score(b) - score(a));
}

export type ResearchOpts = FetchOpts & {
  extraUrls?: readonly string[];
  maxPages?: number;
  maxCharsPerPage?: number;
};

/** Lee la portada de un sitio, elige sus páginas más explicativas y las fuentes extra. */
export async function researchSite(website: string, opts: ResearchOpts = {}): Promise<Research> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxPages = opts.maxPages ?? 6;
  const maxChars = opts.maxCharsPerPage ?? 8_000;
  const errors: string[] = [];
  const pages: FetchedPage[] = [];
  const seen = new Set<string>();

  const add = async (url: string) => {
    if (seen.has(url) || pages.length >= maxPages) return;
    seen.add(url);
    const page = await fetchPage(url, { fetchImpl, maxChars, timeoutMs: opts.timeoutMs });
    if (!page) {
      errors.push(`No se pudo leer ${url}`);
      return;
    }
    if (page.status >= 400 || !page.text) {
      errors.push(`${url} respondió ${page.status || "sin texto"}`);
      return;
    }
    pages.push(page);
  };

  let home: string;
  try {
    home = new URL(website).toString();
  } catch {
    return {
      site: website,
      pages: [],
      totalChars: 0,
      errors: [`Sitio inválido: ${website}`],
      fetchedAt: new Date().toISOString(),
    };
  }

  // Portada (con su HTML para descubrir enlaces).
  let links: string[] = [];
  try {
    const res = await fetchImpl(home, {
      headers: { "User-Agent": BOT_USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
    });
    if (res.ok) {
      const html = await res.text();
      const title = decodeEntities(
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
      ).trim();
      const description = metaContent(html, "description") || metaContent(html, "og:description");
      const text = stripHtml(pickMain(html)).slice(0, maxChars);
      seen.add(home);
      if (text) pages.push({ url: res.url || home, title, description, text, status: res.status });
      links = rankSiteLinks(extractLinks(html, res.url || home), res.url || home);
    } else {
      errors.push(`${home} respondió ${res.status}`);
    }
  } catch {
    errors.push(`No se pudo leer ${home}`);
  }

  for (const u of opts.extraUrls ?? []) await add(u);
  for (const u of links) {
    if (pages.length >= maxPages) break;
    await add(u);
  }

  return {
    site: home,
    pages,
    totalChars: pages.reduce((n, p) => n + p.text.length, 0),
    errors,
    fetchedAt: new Date().toISOString(),
  };
}

export type WebResult = { title: string; url: string; description: string; age?: string };

/** Búsqueda de noticias con Brave (opcional: solo si hay BRAVE_API_KEY). */
export async function braveNewsSearch(
  query: string,
  apiKey: string | undefined,
  opts: { count?: number; lang?: "es" | "en"; fetchImpl?: typeof fetch } = {},
): Promise<WebResult[]> {
  if (!apiKey) return [];
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = new URL("https://api.search.brave.com/res/v1/news/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(opts.count ?? 5));
  url.searchParams.set("search_lang", opts.lang ?? "es");
  url.searchParams.set("freshness", "pw");
  try {
    const res = await fetchImpl(url, {
      headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as {
      results?: { title?: string; url?: string; description?: string; age?: string }[];
    };
    return (body.results ?? [])
      .filter((r) => r.url && r.title)
      .map((r) => ({
        title: r.title ?? "",
        url: r.url ?? "",
        description: stripHtml(r.description ?? ""),
        age: r.age,
      }));
  } catch {
    return [];
  }
}
