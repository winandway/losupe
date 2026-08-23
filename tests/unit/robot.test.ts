import { describe, expect, it } from "vitest";
import {
  handleScheduledRequest,
  isRobotPaused,
  isScheduledRequestAuthorized,
  runScheduled,
} from "@/lib/robot/scheduled";
import { FakeD1 } from "./fake-d1";

function envWith(db: FakeD1, extra: Record<string, string> = {}) {
  return { DB: db.asD1(), ...extra };
}

describe("robot programado", () => {
  it("respeta el interruptor de pausa", async () => {
    const paused = new FakeD1((sql) => (sql.includes("settings") ? [{ value: "1" }] : []));
    expect(await isRobotPaused(paused.asD1())).toBe(true);
    const active = new FakeD1((sql) => (sql.includes("settings") ? [{ value: "0" }] : []));
    expect(await isRobotPaused(active.asD1())).toBe(false);
    expect(await isRobotPaused(new FakeD1().asD1())).toBe(true);
  });

  it("registra cada corrida en la tabla runs", async () => {
    const db = new FakeD1((sql) => (sql.includes("settings") ? [{ value: "1" }] : []));
    const result = await runScheduled(envWith(db), "cron");
    expect(result.status).toBe("skipped");
    expect(result.reason).toBe("robot_paused");
    const insert = db.calls.find((c) => c.sql.startsWith("INSERT INTO runs"));
    expect(insert?.params[1]).toBe("cron");
    // La corrida arranca como "running" y al cerrar queda "skipped" con el motivo en el resumen.
    const update = db.calls.find((c) => c.sql.startsWith("UPDATE runs SET status"));
    expect(update?.params[1]).toBe("skipped");
    expect(String(update?.params[4])).toContain("robot_paused");
  });

  it("solo deja pasar al programador o a la clave manual (nunca al modo desarrollo)", () => {
    const db = new FakeD1();
    const req = (url: string, headers: Record<string, string> = {}) =>
      new Request(url, { headers });
    expect(isScheduledRequestAuthorized(req("https://x/__scheduled"), envWith(db))).toBe(false);
    expect(
      isScheduledRequestAuthorized(
        req("https://x/__scheduled", { "x-yad-cron": "1" }),
        envWith(db),
      ),
    ).toBe(true);
    expect(
      isScheduledRequestAuthorized(
        req("https://x/__scheduled?key=abc"),
        envWith(db, { CRON_SECRET: "abc" }),
      ),
    ).toBe(true);
    expect(
      isScheduledRequestAuthorized(
        req("https://x/__scheduled?key=abd"),
        envWith(db, { CRON_SECRET: "abc" }),
      ),
    ).toBe(false);
    expect(
      isScheduledRequestAuthorized(
        req("https://x/__scheduled"),
        envWith(db, { NEXTJS_ENV: "development" }),
      ),
    ).toBe(false);
    expect(isScheduledRequestAuthorized(req("https://x/__scheduled?key=abc"), envWith(db))).toBe(
      false,
    );
  });

  it("responde 404 sin permiso y JSON con permiso", async () => {
    const db = new FakeD1((sql) => (sql.includes("settings") ? [{ value: "1" }] : []));
    const denied = await handleScheduledRequest(new Request("https://x/__scheduled"), envWith(db));
    expect(denied.status).toBe(404);
    const ok = await handleScheduledRequest(
      new Request("https://x/__scheduled", { headers: { "x-yad-cron": "1" } }),
      envWith(db),
    );
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { ok: boolean; status: string };
    expect(body.ok).toBe(true);
    expect(body.status).toBe("skipped");
    const bad = await handleScheduledRequest(
      new Request("https://x/__scheduled", { method: "DELETE", headers: { "x-yad-cron": "1" } }),
      envWith(db),
    );
    expect(bad.status).toBe(405);
  });

  it("devuelve 500 si la base falla", async () => {
    const broken = {
      prepare: () => {
        throw new Error("sin base");
      },
    } as unknown as D1Database;
    const res = await handleScheduledRequest(
      new Request("https://x/__scheduled", { headers: { "x-yad-cron": "1" } }),
      { DB: broken },
    );
    expect(res.status).toBe(500);
  });
});
