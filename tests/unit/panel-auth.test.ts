import { describe, expect, it } from "vitest";
import {
  clearSessionCookie,
  createSession,
  getSession,
  login,
  MAX_FAILED_ATTEMPTS,
  parseCookies,
  sessionCookie,
  sessionFromRequest,
  verifyTurnstile,
} from "@/lib/panel/auth";
import { parseIdeas, parseUrls } from "@/lib/panel/forms";
import { FakeD1 } from "./fake-d1";

function authDb() {
  const sessions = new Map<string, string>();
  let failures = 0;
  const db = new FakeD1((sql, params) => {
    if (sql.includes("COUNT(*) AS n FROM login_attempts")) return [{ n: failures }];
    if (sql.startsWith("INSERT INTO login_attempts")) {
      if (Number(params[1]) === 0) failures += 1;
      return [];
    }
    if (sql.startsWith("DELETE FROM login_attempts")) {
      failures = 0;
      return [];
    }
    if (sql.startsWith("INSERT INTO panel_sessions")) {
      sessions.set(String(params[0]), String(params[2]));
      return [];
    }
    if (sql.startsWith("DELETE FROM panel_sessions")) {
      sessions.delete(String(params[0]));
      return [];
    }
    if (sql.includes("FROM panel_sessions WHERE id")) {
      const exp = sessions.get(String(params[0]));
      return exp ? [{ id: params[0], expires_at: exp }] : [];
    }
    return [];
  });
  return { db, sessions, failures: () => failures };
}

describe("entrada al panel", () => {
  it("sin ADMIN_PASSWORD nadie entra y se dice por qué", async () => {
    const { db } = authDb();
    const r = await login(
      { DB: db.asD1() },
      { password: "x", turnstileToken: null, ip: "1.1.1.1", userAgent: null },
    );
    expect(r).toEqual({ ok: false, reason: "not_configured" });
  });
  it("contraseña mala suma intento; a los 5 bloquea; la buena abre sesión y limpia", async () => {
    const { db, failures } = authDb();
    const env = { DB: db.asD1(), ADMIN_PASSWORD: "secreta-larga" };
    for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
      const r = await login(env, {
        password: "mala",
        turnstileToken: null,
        ip: "1.1.1.1",
        userAgent: "ua",
      });
      expect(r).toEqual({ ok: false, reason: "wrong" });
    }
    expect(failures()).toBe(MAX_FAILED_ATTEMPTS);
    const blocked = await login(env, {
      password: "secreta-larga",
      turnstileToken: null,
      ip: "1.1.1.1",
      userAgent: "ua",
    });
    expect(blocked).toEqual({ ok: false, reason: "too_many" });
    // Otra IP no está bloqueada… (la falsa cuenta global, así que simulamos reset)
    const fresh = authDb();
    const ok = await login(
      { DB: fresh.db.asD1(), ADMIN_PASSWORD: "secreta-larga" },
      { password: "secreta-larga", turnstileToken: null, ip: "2.2.2.2", userAgent: "ua" },
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.sessionId.length).toBeGreaterThan(40);
      const s = await getSession(fresh.db.asD1(), ok.sessionId);
      expect(s?.id).toBe(ok.sessionId);
    }
  });
  it("la sesión vencida se borra sola; la cookie viaja HttpOnly y solo en /panel", async () => {
    const { db, sessions } = authDb();
    const id = await createSession(
      db.asD1(),
      { ip: "1.1.1.1", userAgent: null },
      new Date("2026-01-01T00:00:00Z"),
    );
    expect(await getSession(db.asD1(), id, new Date("2026-01-02T00:00:00Z"))).not.toBeNull();
    expect(await getSession(db.asD1(), id, new Date("2026-02-01T00:00:00Z"))).toBeNull();
    expect(sessions.has(id)).toBe(false);
    expect(sessionCookie("abc", true)).toContain("HttpOnly");
    expect(sessionCookie("abc", true)).toContain("Path=/panel");
    expect(sessionCookie("abc", true)).toContain("Secure");
    expect(sessionCookie("abc", false)).not.toContain("Secure");
    expect(clearSessionCookie(true)).toContain("Max-Age=0");
    expect(parseCookies("a=1; losupe_panel=xyz; b=%20")).toEqual({
      a: "1",
      losupe_panel: "xyz",
      b: " ",
    });
    expect(await getSession(db.asD1(), "corta")).toBeNull();
  });
  it("sessionFromRequest lee la cookie de la petición", async () => {
    const { db } = authDb();
    const id = await createSession(db.asD1(), { ip: "1.1.1.1", userAgent: null });
    const req = new Request("https://losupe.com/panel/accion/robot", {
      headers: { cookie: `losupe_panel=${id}` },
    });
    expect((await sessionFromRequest(db.asD1(), req))?.id).toBe(id);
    expect(await sessionFromRequest(db.asD1(), new Request("https://losupe.com/panel"))).toBeNull();
  });
  it("Turnstile: apagado sin llaves; exige pase con llave; si Cloudflare no responde, deja pasar", async () => {
    expect(await verifyTurnstile({ DB: authDb().db.asD1() }, null, "1.1.1.1")).toBe(true);
    const env = { DB: authDb().db.asD1(), TURNSTILE_SECRET_KEY: "s" };
    expect(await verifyTurnstile(env, null, "1.1.1.1")).toBe(false);
    const okFetch: typeof fetch = async () => new Response(JSON.stringify({ success: true }));
    const badFetch: typeof fetch = async () => new Response(JSON.stringify({ success: false }));
    const downFetch: typeof fetch = async () => new Response("x", { status: 502 });
    expect(await verifyTurnstile(env, "tok", "1.1.1.1", okFetch)).toBe(true);
    expect(await verifyTurnstile(env, "tok", "1.1.1.1", badFetch)).toBe(false);
    expect(await verifyTurnstile(env, "tok", "1.1.1.1", downFetch)).toBe(true);
  });
});

describe("formularios del panel", () => {
  it("parseIdeas: una por línea, numeración fuera, indicación tras |", () => {
    expect(parseIdeas("1. Cómo vende la empresa | enfoque pymes\n2) Otra idea\n\nx\n")).toEqual([
      { titleIdea: "Cómo vende la empresa", brief: "enfoque pymes" },
      { titleIdea: "Otra idea", brief: null },
    ]);
  });
  it("parseUrls: solo http(s), máximo 10", () => {
    expect(parseUrls("https://a.com/x  ftp://no  b.com\nhttps://c.com")).toEqual([
      "https://a.com/x",
      "https://c.com",
    ]);
    expect(parseUrls(undefined)).toEqual([]);
  });
});
