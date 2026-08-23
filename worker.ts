// Worker de producción: envuelve el servidor Next (OpenNext) y agrega lo que Next no puede hacer
// en esta plataforma:
// - Redirección de idioma (/ → /es o /en según Accept-Language) antes de llegar a Next.
// - GET /__scheduled → lo llama el programador de YaDominios Cloud (cabecera x-yad-cron).
// - scheduled()     → por si el worker corre con Cron Triggers nativos de Cloudflare.

// @ts-ignore `.open-next/worker.js` se genera en el build (opennextjs-cloudflare build)
import { default as nextHandler } from "./.open-next/worker.js";
import { langRedirectTarget } from "./src/lib/lang-redirect";
import { handleScheduledRequest, runScheduled } from "./src/lib/robot/scheduled";

export default {
  async fetch(request: Request, env: CloudflareEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

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
    ctx.waitUntil(runScheduled(env, "cron"));
  },
} satisfies ExportedHandler<CloudflareEnv>;

// Reexportes que OpenNext espera (cola de revalidación y caché de etiquetas).
// @ts-ignore `.open-next/worker.js` se genera en el build (opennextjs-cloudflare build)
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
