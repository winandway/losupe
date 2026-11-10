import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { claimTick, HORAS_DE_CORTESIA_AL_RELOJ, relojVivo, TICK_KEY } from "@/lib/robot/heartbeat";

/**
 * Candado 60 — el latido por tráfico no le quema los intentos al reloj (10 nov 2026).
 *
 * El día que se midió, el diario publicaba **dos notas al día en vez de diez**. El canario lo
 * enseñaba sin disimulo: 36 corridas con disparador `manual` (el latido de las visitas) y **las 36
 * muertas**, mientras el turno de la mañana marcaba `2026-11-10:manana-2#7` — siete de sus ocho
 * intentos gastados sin publicar una sola nota. Cuando el reloj de GitHub llegaba, encontraba el
 * turno agotado y se iba de vacío.
 *
 * Las corridas del latido mueren porque el trabajo va en el `waitUntil` de una invocación que ya
 * respondió: sin una petición HTTP abierta esperándola, Cloudflare la corta mucho antes de los
 * minutos que tarda escribir una nota. Las del reloj, que llaman con `wait=1`, sí terminan.
 */

const MEDIODIA = new Date("2026-11-10T17:30:00Z"); // 12:30 del Este, franja del mediodía

/**
 * Base falsa. `corridaDeRelojHaceMinutos` decide si el reloj corrió hace poco; `null` = llevaba
 * callado todo el día.
 */
function db(corridaDeRelojHaceMinutos: number | null, changes = 1) {
  const calls: { sql: string; params: unknown[] }[] = [];
  return {
    calls,
    d1: {
      prepare: (sql: string) => ({
        bind: (...params: unknown[]) => ({
          first: async () => {
            calls.push({ sql, params });
            if (sql.includes("FROM runs") && sql.includes("trigger = 'cron'")) {
              if (corridaDeRelojHaceMinutos === null) return { n: 0 };
              const desde = new Date(String(params[0])).getTime();
              const corrida = MEDIODIA.getTime() - corridaDeRelojHaceMinutos * 60_000;
              return { n: corrida >= desde ? 1 : 0 };
            }
            if (sql.includes("published_at < ?2")) return { n: 3 };
            if (sql.includes("COUNT(*) AS n FROM articles")) return { n: 0 };
            return { value: "" };
          },
          run: async () => {
            calls.push({ sql, params });
            return { meta: { changes: sql.startsWith("UPDATE settings") ? changes : 1 } };
          },
        }),
        first: async () => (sql.includes("robot_paused") ? { value: "0" } : { value: "" }),
      }),
    } as unknown as D1Database,
  };
}

describe("el latido de las visitas es la red, no el reloj", () => {
  it("si el reloj corrió hace poco, el latido se aparta y NO toca la marca del turno", async () => {
    const { d1, calls } = db(30);
    expect(await claimTick(d1, MEDIODIA, { origen: "trafico" })).toEqual({
      run: false,
      reason: "reloj_vivo",
    });
    // Lo que de verdad importa: no escribe la marca, así que no gasta un intento de la franja.
    expect(calls.find((c) => c.sql.startsWith("UPDATE settings"))).toBeUndefined();
    expect(calls.some((c) => c.params.includes(TICK_KEY))).toBe(false);
  });

  it("si el reloj lleva horas callado, el latido sí entra: es la red de emergencia", async () => {
    const { d1 } = db(HORAS_DE_CORTESIA_AL_RELOJ * 60 + 10);
    expect(await claimTick(d1, MEDIODIA, { origen: "trafico" })).toMatchObject({ run: true });
  });

  it("el reloj nunca se aparta, haya corrido hace un minuto o no", async () => {
    expect(await claimTick(db(1).d1, MEDIODIA, { origen: "reloj" })).toMatchObject({ run: true });
    // Y sin decir el origen (el panel, una llamada a mano) tampoco se aparta.
    expect(await claimTick(db(1).d1, MEDIODIA)).toMatchObject({ run: true });
  });

  it("reloj = corrida con disparador cron; una manual no cuenta como reloj", async () => {
    const { d1, calls } = db(5);
    await relojVivo(d1, MEDIODIA);
    const q = calls.find((c) => c.sql.includes("FROM runs"));
    expect(q?.sql).toContain("trigger = 'cron'");
  });

  it("si la base no responde, el latido pasa: peor es no publicar", async () => {
    const rota = {
      prepare: () => ({
        bind: () => ({
          first: async () => {
            throw new Error("sin base");
          },
        }),
      }),
    } as unknown as D1Database;
    expect(await relojVivo(rota, MEDIODIA)).toBe(false);
  });
});

describe("el reloj de GitHub es una guardia larga, no un disparo suelto", () => {
  const yml = readFileSync(".github/workflows/robot.yml", "utf8");

  it("espera a que la nota termine de escribirse", () => {
    // Sin `wait=1` el trabajo queda en segundo plano y Cloudflare lo corta: es exactamente el fallo
    // que mata a las corridas del latido.
    expect(yml).toContain("__scheduled?wait=1");
  });

  it("se queda despierto horas llamando cada cuarto de hora", () => {
    // Los cron de GitHub llegan dos o tres veces al día aunque se programen veinticuatro. Si cada
    // disparo solo escribiera una nota, el diario publicaría dos al día — que es lo que pasaba.
    expect(yml).toMatch(/while \[ "\$\(date \+%s\)" -lt "\$FIN" \]/);
    expect(yml).toMatch(/sleep 900/);
    const minutos = Number(yml.match(/timeout-minutes:\s*(\d+)/)?.[1] ?? 0);
    expect(minutos).toBeGreaterThanOrEqual(300);
  });

  it("una guardia a la vez, y la siguiente espera en la cola", () => {
    expect(yml).toMatch(/group:\s*robot/);
    expect(yml).toMatch(/cancel-in-progress:\s*false/);
  });
});
