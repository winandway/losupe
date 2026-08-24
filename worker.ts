// Worker de producción: envuelve el servidor Next (OpenNext) y agrega lo que Next no puede hacer
// en esta plataforma:
// - Garantiza el esquema de la base y siembra el contenido empaquetado.
// - Redirección de idioma (/ → /es o /en según Accept-Language) antes de llegar a Next.
// - Markdown para agentes (Accept: text/markdown) y cabeceras Link (RFC 8288).
// - Manifiestos de descubrimiento en /.well-known/* y clave de IndexNow.
// - GET /__health    → estado de la base y del robot (diagnóstico, sin datos sensibles).
// - GET /__scheduled → lo llama el programador de YaDominios Cloud (cabecera x-yad-cron).
// - GET /media/*     → imágenes de las notas guardadas en R2 (env.BUCKET).

// @ts-ignore `.open-next/worker.js` se genera en el build (opennextjs-cloudflare build)
import { default as nextHandler } from "./.open-next/worker.js";
import { SCHEMA_SQL } from "./src/lib/schema-sql";
import { CONTENT_SEEDS } from "./src/lib/seed-content";
import { buildLinkHeader } from "./src/lib/agent-discovery";
import { renderMarkdown, wantsMarkdown } from "./src/lib/agent-markdown";
import {
  buildAiCatalog,
  buildApiCatalog,
  buildSkillMarkdown,
  buildSkillsIndex,
  SKILL_NAME,
} from "./src/lib/agent-manifests";
import { buildHealthReport } from "./src/lib/health";
import { INDEXNOW_KEY, indexNowKeyPath, pingIndexNow } from "./src/lib/indexnow";
import { isLang } from "./src/i18n/config";
import { langRedirectTarget } from "./src/lib/lang-redirect";
import { legacyRedirectTarget } from "./src/lib/legacy-redirects";
import { claimTick, closeStaleRuns, getTickToken } from "./src/lib/robot/heartbeat";
import { robotStatus } from "./src/lib/robot/pipeline";
import { handleScheduledRequest, runScheduled } from "./src/lib/robot/scheduled";
import { createSchemaGuard } from "./src/lib/schema-guard";
import { rebuildSearchIndex } from "./src/lib/search";

// Esquema + semillas (archivo de MundosCrypto y notas editoriales) viajan dentro del worker:
// la base se crea y se siembra sola, sin pasos manuales.
const schemaGuard = createSchemaGuard(SCHEMA_SQL, { seeds: CONTENT_SEEDS });

const STATIC_PREFIXES = ["/img/", "/video/", "/brand/"];
const STATIC_CACHE = "public, max-age=86400, stale-while-revalidate=604800";
// Mapas del sitio y robots: se cachean 10 minutos y se les quita el `Vary` de Next (son XML/texto
// planos, iguales para todos; el `Vary: rsc, next-router-...` solo estorba a buscadores y cachés).
const FEED_PATHS = new Set(["/sitemap.xml", "/news-sitemap.xml", "/robots.txt", "/llms.txt"]);
const FEED_CACHE = "public, max-age=600, stale-while-revalidate=86400";

function json(data: unknown, contentType = "application/json; charset=utf-8"): Response {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function text(body: string, contentType = "text/plain; charset=utf-8"): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function originOf(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;
    const base = originOf(request);
    const isHealth = pathname === "/__health";
    const schema = await schemaGuard.ensure(env.DB, { force: isHealth });

    // Avisar a los buscadores (IndexNow) cuando se siembra una nota editorial nueva.
    const freshSeeds = (schema.seeds ?? []).filter(
      (s) => s.applied && s.id !== "legacy-mundoscrypto",
    );
    if (freshSeeds.length > 0) {
      ctx.waitUntil(pingIndexNow(base, [`${base}/sitemap.xml`, `${base}/news-sitemap.xml`]));
    }
    // Índice del buscador: se reconstruye cuando cambió el esquema o entró contenido nuevo.
    if (env.DB && (schema.applied || freshSeeds.length > 0)) {
      ctx.waitUntil(rebuildSearchIndex(env.DB).catch(() => undefined));
    }

    if (isHealth) {
      const report = await buildHealthReport(env.DB, schema);
      let robot: unknown = null;
      if (env.DB) {
        robot = await robotStatus(env).catch((e: unknown) => ({
          error: e instanceof Error ? e.message : String(e),
        }));
      }
      return Response.json(
        { ...report, robot },
        {
          status: report.ok ? 200 : 503,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

    // Imágenes de las notas (R2). Clave = ruta sin el prefijo /media/.
    if (pathname.startsWith("/media/") && request.method === "GET" && env.BUCKET) {
      const key = decodeURIComponent(pathname.slice("/media/".length));
      const object = key ? await env.BUCKET.get(key) : null;
      if (!object) return new Response("Not found", { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      if (!headers.has("Cache-Control")) headers.set("Cache-Control", STATIC_CACHE);
      return new Response(object.body, { headers });
    }

    if (pathname === "/__scheduled") {
      // El `ctx` es lo que permite responder ya y escribir la nota por detrás (ver el comentario
      // de handleScheduledRequest): sin él, quien llama puede matar la corrida al colgar.
      return handleScheduledRequest(request, env, ctx);
    }

    // Descubrimiento para agentes.
    if (pathname === indexNowKeyPath()) return text(INDEXNOW_KEY);
    if (pathname === "/.well-known/api-catalog") {
      return json(buildApiCatalog(base), "application/linkset+json; charset=utf-8");
    }
    if (pathname === "/.well-known/ai-catalog.json") return json(buildAiCatalog(base));
    if (pathname === "/.well-known/agent-skills/index.json") {
      return json(await buildSkillsIndex(base));
    }
    if (pathname === `/.well-known/agent-skills/${SKILL_NAME}/SKILL.md`) {
      return text(buildSkillMarkdown(base), "text/markdown; charset=utf-8");
    }

    // URLs viejas de notas que cambiaron de slug → 301 a la nueva.
    const legacy = legacyRedirectTarget(pathname);
    if (legacy) {
      return new Response(null, {
        status: 301,
        headers: { Location: legacy + url.search, "Cache-Control": "public, max-age=86400" },
      });
    }

    // Piloto automático por tráfico: si el programador de la plataforma falla, el propio sitio se
    // encarga. Solo en páginas HTML (no en imágenes ni en el panel) y sin frenar la respuesta.
    if (
      env.DB &&
      request.method === "GET" &&
      !pathname.startsWith("/panel") &&
      !pathname.startsWith("/datos/") &&
      !STATIC_PREFIXES.some((p) => pathname.startsWith(p)) &&
      !FEED_PATHS.has(pathname)
    ) {
      ctx.waitUntil(
        (async () => {
          // Una corrida que se cortó no debe quedar «en marcha» para siempre.
          await closeStaleRuns(env.DB);
          const decision = await claimTick(env.DB);
          if (!decision.run) return;
          // El trabajo NO se hace aquí: se pide a /__scheduled, que corre en su propia invocación
          // con su propio presupuesto de tiempo. Si esta petición se corta, aquella ya arrancó.
          const token = await getTickToken(env.DB);
          if (!token) return;
          await fetch(`${base}/__scheduled?key=${encodeURIComponent(token)}`, {
            headers: { "user-agent": "losupe-heartbeat/1.0" },
          }).catch(() => undefined);
        })(),
      );
    }

    const target = langRedirectTarget(url, request.headers.get("accept-language"));
    if (target) {
      return new Response(null, {
        status: 307,
        headers: { Location: target, Vary: "Accept-Language", "Cache-Control": "no-store" },
      });
    }

    // Markdown para agentes: misma URL, Accept: text/markdown.
    const first = pathname.split("/")[1] ?? "";
    const lang = isLang(first) ? first : null;
    if (lang && request.method === "GET" && wantsMarkdown(request) && env.DB) {
      const md = await renderMarkdown(env.DB, base, pathname, url.searchParams);
      if (md) {
        return new Response(md, {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "x-markdown-tokens": String(Math.ceil(md.length / 4)),
            Vary: "Accept",
            "Cache-Control": "public, max-age=300",
            Link: buildLinkHeader(base, pathname, lang),
          },
        });
      }
    }

    const response: Response = await nextHandler.fetch(request, env, ctx);

    // Cabeceras útiles para agentes y caché de estáticos.
    const contentType = response.headers.get("content-type") ?? "";
    const isHtml = contentType.includes("text/html");
    const isStatic = STATIC_PREFIXES.some((p) => pathname.startsWith(p));
    if (!isHtml && !isStatic && !FEED_PATHS.has(pathname)) return response;

    const headers = new Headers(response.headers);
    if (isHtml) {
      headers.set("Link", buildLinkHeader(base, pathname, lang));
      const vary = headers.get("Vary");
      if (lang) headers.set("Vary", vary ? `${vary}, Accept` : "Accept");
    }
    if (isStatic && response.status === 200) headers.set("Cache-Control", STATIC_CACHE);
    if (FEED_PATHS.has(pathname) && response.status === 200) {
      headers.set("Cache-Control", FEED_CACHE);
      headers.delete("Vary");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },

  async scheduled(_event: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    ctx.waitUntil(schemaGuard.ensure(env.DB).then(() => runScheduled(env, "cron")));
  },
} satisfies ExportedHandler<CloudflareEnv>;

// Reexportes que OpenNext espera (cola de revalidación y caché de etiquetas).
// @ts-ignore `.open-next/worker.js` se genera en el build (opennextjs-cloudflare build)
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
