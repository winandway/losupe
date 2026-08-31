/**
 * Punto de entrada del robot redactor (cron de YaDominios → GET /__scheduled con cabecera
 * `x-yad-cron`, o a mano con `?key=<CRON_SECRET>`). Deja constancia de cada corrida en `runs`,
 * respeta el interruptor `robot_paused` y delega el trabajo al pipeline (encargos + universales).
 */

import { runPipeline, type RobotEnv, type RunSummary } from "./pipeline";
import { rescatarImagenes } from "./rescate-imagenes";

export type RunTrigger = "cron" | "manual";

export type RunResult = {
  ok: boolean;
  runId: string;
  status: "skipped" | "done" | "error";
  reason?: string;
  startedAt: string;
  notes?: RunSummary["notes"];
  spentUsd?: number;
  /** Notas que estaban sin foto y quedaron ilustradas en esta corrida. */
  imagenesRescatadas?: number;
  /** Las que siguen sin foto. Se ve en el panel: un rescate mudo es como no tenerlo. */
  imagenesPendientes?: number;
};

export { isRobotPaused } from "./pipeline";

type ScheduledEnv = RobotEnv & { NEXTJS_ENV?: string };

function baseFrom(env: ScheduledEnv, request?: Request): string {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (request) return new URL(request.url).origin;
  return "https://losupe.com";
}

export async function runScheduled(
  env: ScheduledEnv,
  trigger: RunTrigger,
  opts: { base?: string; maxNotes?: number; force?: boolean; fetchImpl?: typeof fetch } = {},
): Promise<RunResult> {
  const summary = await runPipeline(env, {
    trigger,
    base: opts.base ?? baseFrom(env),
    maxNotes: opts.maxNotes,
    force: opts.force,
    fetchImpl: opts.fetchImpl,
  });
  // Antes de cerrar, se le pone foto a cualquier nota que se haya quedado sin ella —venga del robot,
  // de una semilla del repositorio o del panel—. Una nota sin foto al lado de otras con foto se lee
  // como un error del sitio, aunque el texto sea impecable (lo vio Richard el 30 ago 2026).
  const rescate = await rescatarImagenes(env.DB, env, { fetchImpl: opts.fetchImpl }).catch(() => ({
    encontradas: 0,
    ilustradas: 0,
    errores: ["rescate de imágenes: fallo inesperado"],
  }));

  return {
    ok: summary.ok,
    runId: summary.runId,
    status: summary.status,
    reason: summary.reason,
    startedAt: summary.startedAt,
    notes: summary.notes,
    spentUsd: summary.spentUsd,
    ...(rescate.encontradas > 0 || rescate.errores.length > 0
      ? {
          imagenesRescatadas: rescate.ilustradas,
          imagenesPendientes: rescate.encontradas - rescate.ilustradas,
        }
      : {}),
  };
}

/**
 * ¿Puede esta petición disparar el robot? Tres formas: el programador de YaDominios (su cabecera),
 * la clave manual (`CRON_SECRET`) o el secreto interno que el propio sitio usa para llamarse a sí
 * mismo (el latido). Cualquier otra cosa recibe un 404.
 */
export async function isScheduledRequestAuthorized(
  request: Request,
  env: ScheduledEnv,
): Promise<boolean> {
  if (request.headers.has("x-yad-cron")) return true;
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return false;
  if (env.CRON_SECRET && timingSafeEqual(key, env.CRON_SECRET)) return true;
  try {
    const row = await env.DB.prepare(
      `SELECT value FROM settings WHERE key = 'robot_tick_token'`,
    ).first<{ value: string }>();
    return Boolean(row?.value && timingSafeEqual(key, row.value));
  } catch {
    return false;
  }
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * LA RESPUESTA SALE ANTES QUE EL TRABAJO, Y ES A PROPÓSITO.
 *
 * Antes esto era `await runScheduled(...)` dentro de la respuesta: la petición HTTP se quedaba
 * abierta los 30-90 segundos que tarda escribir una nota. Y quien la llamaba era el latido, desde el
 * `waitUntil` de la visita de un lector cualquiera. Cuando a esa visita se le acababa su tiempo,
 * **cancelaba la petición y mataba la corrida a media escritura** — sin error, sin gasto, sin rastro.
 * El 24 ago 2026 así se perdieron once corridas seguidas y el diario no publicó en todo el día.
 *
 * Ahora el trabajo va en el `waitUntil` de ESTA invocación, que tiene su propio presupuesto y a la
 * que ya no le cuelga nadie: se responde «arrancada» en milisegundos y la nota se escribe sola.
 *
 * Con `?wait=1` se espera el resultado completo (para diagnosticar a mano y ver qué salió).
 */
export async function handleScheduledRequest(
  request: Request,
  env: ScheduledEnv,
  ctx?: { waitUntil(p: Promise<unknown>): void },
): Promise<Response> {
  if (!(await isScheduledRequestAuthorized(request, env))) {
    return new Response("Not found", { status: 404 });
  }
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const trigger: RunTrigger = request.headers.has("x-yad-cron") ? "cron" : "manual";
  const base = baseFrom(env, request);
  const esperar = new URL(request.url).searchParams.get("wait") === "1";

  if (ctx && !esperar) {
    ctx.waitUntil(runScheduled(env, trigger, { base }).catch(() => undefined));
    return Response.json(
      { ok: true, started: true, trigger },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await runScheduled(env, trigger, { base });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
