/**
 * Punto de entrada del robot redactor. Bloque 1: deja constancia de cada corrida y respeta
 * el interruptor `robot_paused`. El pipeline completo (fuentes → curaduría → redacción →
 * imagen → revisión → publicación) entra en el bloque 2 sin cambiar esta interfaz.
 */

export type RunTrigger = "cron" | "manual";

export type RunResult = {
  ok: boolean;
  runId: string;
  status: "skipped" | "pending" | "done" | "error";
  reason?: string;
  startedAt: string;
};

type RobotEnv = Pick<CloudflareEnv, "DB"> & { CRON_SECRET?: string };

export async function isRobotPaused(db: D1Database): Promise<boolean> {
  const row = await db
    .prepare(`SELECT value FROM settings WHERE key = 'robot_paused'`)
    .first<{ value: string }>();
  return !row || row.value !== "0";
}

export async function runScheduled(env: RobotEnv, trigger: RunTrigger): Promise<RunResult> {
  const runId = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  const paused = await isRobotPaused(env.DB);
  const status: RunResult["status"] = paused ? "skipped" : "pending";
  const reason = paused ? "robot_paused" : "pipeline_not_enabled_yet";
  await env.DB.prepare(
    `INSERT INTO runs (id, trigger, status, step, started_at, finished_at, summary_json)
     VALUES (?1, ?2, ?3, ?4, ?5, ?5, ?6)`,
  )
    .bind(
      runId,
      trigger,
      status,
      paused ? "paused" : "discover",
      startedAt,
      JSON.stringify({ reason }),
    )
    .run();
  return { ok: true, runId, status, reason, startedAt };
}

/** ¿Puede esta petición disparar el robot? Solo el programador de YaDominios o la clave manual. */
export function isScheduledRequestAuthorized(request: Request, env: RobotEnv): boolean {
  if (request.headers.has("x-yad-cron")) return true;
  const key = new URL(request.url).searchParams.get("key");
  return Boolean(env.CRON_SECRET && key && timingSafeEqual(key, env.CRON_SECRET));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function handleScheduledRequest(request: Request, env: RobotEnv): Promise<Response> {
  if (!isScheduledRequestAuthorized(request, env)) {
    return new Response("Not found", { status: 404 });
  }
  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    const trigger: RunTrigger = request.headers.has("x-yad-cron") ? "cron" : "manual";
    const result = await runScheduled(env, trigger);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
