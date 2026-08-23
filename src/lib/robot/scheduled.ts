/**
 * Punto de entrada del robot redactor (cron de YaDominios → GET /__scheduled con cabecera
 * `x-yad-cron`, o a mano con `?key=<CRON_SECRET>`). Deja constancia de cada corrida en `runs`,
 * respeta el interruptor `robot_paused` y delega el trabajo al pipeline (encargos + universales).
 */

import { runPipeline, type RobotEnv, type RunSummary } from "./pipeline";

export type RunTrigger = "cron" | "manual";

export type RunResult = {
  ok: boolean;
  runId: string;
  status: "skipped" | "done" | "error";
  reason?: string;
  startedAt: string;
  notes?: RunSummary["notes"];
  spentUsd?: number;
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
  return {
    ok: summary.ok,
    runId: summary.runId,
    status: summary.status,
    reason: summary.reason,
    startedAt: summary.startedAt,
    notes: summary.notes,
    spentUsd: summary.spentUsd,
  };
}

/** ¿Puede esta petición disparar el robot? Solo el programador de YaDominios o la clave manual. */
export function isScheduledRequestAuthorized(request: Request, env: ScheduledEnv): boolean {
  if (request.headers.has("x-yad-cron")) return true;
  const key = new URL(request.url).searchParams.get("key");
  return Boolean(env.CRON_SECRET && key && timingSafeEqual(key, env.CRON_SECRET));
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function handleScheduledRequest(
  request: Request,
  env: ScheduledEnv,
): Promise<Response> {
  if (!isScheduledRequestAuthorized(request, env)) {
    return new Response("Not found", { status: 404 });
  }
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const trigger: RunTrigger = request.headers.has("x-yad-cron") ? "cron" : "manual";
    const result = await runScheduled(env, trigger, { base: baseFrom(env, request) });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
