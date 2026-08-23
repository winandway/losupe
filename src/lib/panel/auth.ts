import { timingSafeEqual } from "@/lib/robot/scheduled";

/**
 * Entrada al panel: una contraseña (ADMIN_PASSWORD en las variables del sitio), sesión guardada en
 * la base (cerrar sesión la borra de verdad), límite de intentos por IP y Turnstile opcional.
 */

export const SESSION_COOKIE = "losupe_panel";
export const SESSION_DAYS = 7;
export const MAX_FAILED_ATTEMPTS = 5;
export const ATTEMPT_WINDOW_MIN = 15;

export type PanelEnv = {
  DB: D1Database;
  ADMIN_PASSWORD?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
};

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0"
  );
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function sessionCookie(id: string, secure: boolean, maxAgeSeconds = SESSION_DAYS * 86_400) {
  return `${SESSION_COOKIE}=${id}; Path=/panel; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(secure: boolean) {
  return `${SESSION_COOKIE}=; Path=/panel; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function isSecure(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

export async function recentFailures(
  db: D1Database,
  ip: string,
  now = new Date(),
): Promise<number> {
  const since = new Date(now.getTime() - ATTEMPT_WINDOW_MIN * 60_000).toISOString();
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ?1 AND ok = 0 AND at >= ?2`)
    .bind(ip, since)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}

export async function recordAttempt(db: D1Database, ip: string, ok: boolean, now = new Date()) {
  await db
    .prepare(`INSERT INTO login_attempts (ip, ok, at) VALUES (?1, ?2, ?3)`)
    .bind(ip, ok ? 1 : 0, now.toISOString())
    .run();
  if (ok) {
    // Al entrar bien, se limpian los fallos de esa IP.
    await db.prepare(`DELETE FROM login_attempts WHERE ip = ?1 AND ok = 0`).bind(ip).run();
  }
}

export async function createSession(
  db: D1Database,
  meta: { ip: string; userAgent: string | null },
  now = new Date(),
): Promise<string> {
  const id = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const expires = new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString();
  await db
    .prepare(
      `INSERT INTO panel_sessions (id, created_at, expires_at, ip, user_agent) VALUES (?1, ?2, ?3, ?4, ?5)`,
    )
    .bind(id, now.toISOString(), expires, meta.ip, meta.userAgent?.slice(0, 200) ?? null)
    .run();
  return id;
}

export async function getSession(db: D1Database, id: string | undefined, now = new Date()) {
  if (!id || id.length < 32 || id.length > 120) return null;
  const row = await db
    .prepare(`SELECT id, expires_at FROM panel_sessions WHERE id = ?1`)
    .bind(id)
    .first<{ id: string; expires_at: string }>();
  if (!row) return null;
  if (row.expires_at < now.toISOString()) {
    await destroySession(db, id);
    return null;
  }
  return row;
}

export async function destroySession(db: D1Database, id: string): Promise<void> {
  await db.prepare(`DELETE FROM panel_sessions WHERE id = ?1`).bind(id).run();
}

/** ¿La petición trae una sesión válida? (para route handlers del panel). */
export async function sessionFromRequest(db: D1Database, request: Request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  return getSession(db, cookies[SESSION_COOKIE]);
}

export type LoginOutcome =
  | { ok: true; sessionId: string }
  | { ok: false; reason: "not_configured" | "too_many" | "wrong" | "turnstile" };

export function passwordMatches(env: PanelEnv, candidate: string): boolean {
  if (!env.ADMIN_PASSWORD) return false;
  return timingSafeEqual(candidate, env.ADMIN_PASSWORD);
}

/** Verifica el pase de Turnstile en el servidor (si está configurado; si Cloudflare no responde, deja pasar). */
export async function verifyTurnstile(
  env: PanelEnv,
  token: string | null,
  ip: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!env.TURNSTILE_SECRET_KEY) return true;
  if (!token) return false;
  try {
    const res = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return true; // servicio caído: no se tumba la entrada de todos
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return true;
  }
}

export async function login(
  env: PanelEnv,
  input: { password: string; turnstileToken: string | null; ip: string; userAgent: string | null },
  fetchImpl: typeof fetch = fetch,
  now = new Date(),
): Promise<LoginOutcome> {
  if (!env.ADMIN_PASSWORD) return { ok: false, reason: "not_configured" };
  if ((await recentFailures(env.DB, input.ip, now)) >= MAX_FAILED_ATTEMPTS) {
    return { ok: false, reason: "too_many" };
  }
  if (!(await verifyTurnstile(env, input.turnstileToken, input.ip, fetchImpl))) {
    return { ok: false, reason: "turnstile" };
  }
  if (!passwordMatches(env, input.password)) {
    await recordAttempt(env.DB, input.ip, false, now);
    return { ok: false, reason: "wrong" };
  }
  await recordAttempt(env.DB, input.ip, true, now);
  const sessionId = await createSession(env.DB, { ip: input.ip, userAgent: input.userAgent }, now);
  return { ok: true, sessionId };
}
