// Worker de producción: envuelve el servidor Next (OpenNext) y agrega lo que Next no puede hacer
// en esta plataforma:
// - Garantiza el esquema de la base (por si la plataforma no ejecutó schema.sql).
// - Redirección de idioma (/ → /es o /en según Accept-Language) antes de llegar a Next.
// - GET /__health    → estado de la base (diagnóstico, sin datos sensibles).
// - GET /__scheduled → lo llama el programador de YaDominios Cloud (cabecera x-yad-cron).
// - scheduled()      → por si el worker corre con Cron Triggers nativos de Cloudflare.

// @ts-ignore `.open-next/worker.js` se genera en el build (opennextjs-cloudflare build)
import { default as nextHandler } from "./.open-next/worker.js";
import { SCHEMA_SQL } from "./src/lib/schema-sql";
import { CONTENT_SEEDS } from "./src/lib/seed-content";
import { buildHealthReport } from "./src/lib/health";
import { langRedirectTarget } from "./src/lib/lang-redirect";
import { handleScheduledRequest, runScheduled } from "./src/lib/robot/scheduled";
import { createSchemaGuard } from "./src/lib/schema-guard";

// Esquema + semillas (archivo de MundosCrypto y notas editoriales) viajan dentro del worker:
// la base se crea y se siembra sola, sin pasos manuales.
const schemaGuard = createSchemaGuard(SCHEMA_SQL, { seeds: CONTENT_SEEDS });

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const isHealth = url.pathname === "/__health";
    const schema = await schemaGuard.ensure(env.DB, { force: isHealth });

    if (isHealth) {
      const report = await buildHealthReport(env.DB, schema);
      return Response.json(report, {
        status: report.ok ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (url.pathname === "/__scheduled") {
      return handleScheduledRequest(request, env);
    }

    const target = langRedirectTarget(url, request.headers.get("accept-language"));
    if (target) {
      return new Response(null, {
        status: 307,
        headers: { Location: target, Vary: "Accept-Language", "Cache-Control": "no-store" },
      });
    }

    return nextHandler.fetch(request, env, ctx);
  },

  async scheduled(_event: ScheduledController, env: CloudflareEnv, ctx: ExecutionContext) {
    ctx.waitUntil(schemaGuard.ensure(env.DB).then(() => runScheduled(env, "cron")));
  },
} satisfies ExportedHandler<CloudflareEnv>;

// Reexportes que OpenNext espera (cola de revalidación y caché de etiquetas).
// @ts-ignore `.open-next/worker.js` se genera en el build (opennextjs-cloudflare build)
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
