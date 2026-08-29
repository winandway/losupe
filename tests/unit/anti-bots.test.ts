import { describe, expect, it } from "vitest";
import {
  crearPase,
  guardiaDeFormulario,
  MAX_POR_HORA,
  MINIMO_SEGUNDOS,
  revisarPase,
  turnstileConfigurado,
  turnstileValido,
  VALIDEZ_MINUTOS,
} from "@/lib/anti-bots";

/** Base falsa que recuerda el secreto, como haría la de verdad. */
function baseConSecreto(envios = 0) {
  let secreto = "";
  const calls: string[] = [];
  const db = {
    prepare: (sql: string) => ({
      bind: (...p: unknown[]) => ({
        first: async () => {
          calls.push(sql);
          if (sql.includes("COUNT(*)")) return { n: envios };
          return null;
        },
        run: async () => {
          calls.push(sql);
          if (sql.includes("form_secret")) secreto = String(p[0]);
          return { meta: { changes: 1 } };
        },
      }),
      first: async () => {
        calls.push(sql);
        return secreto ? { value: secreto } : null;
      },
    }),
  } as unknown as D1Database;
  return { db, calls };
}

const AHORA = new Date("2026-08-25T20:00:00Z");
const despues = (seg: number) => new Date(AHORA.getTime() + seg * 1000);

describe("el pase del formulario", () => {
  it("un POST directo sin pase no entra (así trabaja casi todo el spam)", async () => {
    const { db } = baseConSecreto();
    expect(await revisarPase(db, null)).toEqual({ ok: false, motivo: "sin_pase" });
    expect(await revisarPase(db, "")).toEqual({ ok: false, motivo: "sin_pase" });
    expect(await revisarPase(db, "cualquiercosa")).toEqual({ ok: false, motivo: "sin_pase" });
  });

  it("un pase inventado tampoco: va firmado por nosotros", async () => {
    const { db } = baseConSecreto();
    const bueno = await crearPase(db, AHORA);
    const [t] = bueno.split(".");
    expect(await revisarPase(db, `${t}.0000000000000000`, despues(10))).toEqual({
      ok: false,
      motivo: "falso",
    });
  });

  it("un pase de verdad, usado como una persona, entra", async () => {
    const { db } = baseConSecreto();
    const pase = await crearPase(db, AHORA);
    const r = await revisarPase(db, pase, despues(12));
    expect(r.ok).toBe(true);
  });

  it("RELLENADO INSTANTÁNEO = robot", async () => {
    const { db } = baseConSecreto();
    const pase = await crearPase(db, AHORA);
    // Nadie escribe su nombre, su correo y un mensaje en medio segundo.
    expect(await revisarPase(db, pase, despues(0.5))).toEqual({
      ok: false,
      motivo: "demasiado_rapido",
    });
    expect(MINIMO_SEGUNDOS).toBeGreaterThanOrEqual(2);
  });

  it("y un pase guardado para usarlo mil veces caduca", async () => {
    const { db } = baseConSecreto();
    const pase = await crearPase(db, AHORA);
    expect(await revisarPase(db, pase, despues(VALIDEZ_MINUTOS * 60 + 10))).toEqual({
      ok: false,
      motivo: "caducado",
    });
  });
});

describe("la puerta completa", () => {
  const datos = { pase: null as string | null, trampa: "", turnstile: null, ip: "1.2.3.4" };

  it("la trampa caza al robot antes que nada", async () => {
    const { db } = baseConSecreto();
    const r = await guardiaDeFormulario(db, {}, { ...datos, trampa: "http://spam" }, AHORA);
    expect(r).toEqual({ ok: false, motivo: "robot" });
  });

  it("con pase bueno y tiempo de persona, pasa", async () => {
    const { db } = baseConSecreto();
    const pase = await crearPase(db, AHORA);
    expect(await guardiaDeFormulario(db, {}, { ...datos, pase }, despues(15))).toEqual({
      ok: true,
    });
  });

  it("pero no más de unos pocos por hora desde la misma dirección", async () => {
    // Diez, no cinco: varias personas pueden compartir dirección (una oficina, una red móvil).
    expect(MAX_POR_HORA).toBeGreaterThanOrEqual(10);
    const { db } = baseConSecreto(MAX_POR_HORA);
    const pase = await crearPase(db, AHORA);
    expect(await guardiaDeFormulario(db, {}, { ...datos, pase }, despues(15))).toEqual({
      ok: false,
      motivo: "demasiados",
    });
  });
});

describe("Turnstile: se enciende solo cuando estén las llaves", () => {
  it("sin llaves no bloquea a nadie", async () => {
    expect(turnstileConfigurado({})).toBe(false);
    expect(await turnstileValido({}, null, "1.2.3.4")).toBe(true);
  });

  it("con llaves, un pase que Cloudflare rechaza no entra", async () => {
    const env = { TURNSTILE_SECRET_KEY: "s", TURNSTILE_SITE_KEY: "p" };
    const no: typeof fetch = async () =>
      new Response(JSON.stringify({ success: false }), {
        headers: { "content-type": "application/json" },
      });
    expect(await turnstileValido(env, "token", "1.2.3.4", no)).toBe(false);
    // Y sin pase tampoco.
    expect(await turnstileValido(env, null, "1.2.3.4", no)).toBe(false);
  });

  it("si Cloudflare no responde, NO se cierra el formulario a todo el mundo", async () => {
    const env = { TURNSTILE_SECRET_KEY: "s", TURNSTILE_SITE_KEY: "p" };
    const caido: typeof fetch = async () => {
      throw new Error("sin red");
    };
    // Detrás siguen las otras tres capas; tumbar el formulario por un mal minuto ajeno es peor.
    expect(await turnstileValido(env, "token", "1.2.3.4", caido)).toBe(true);
  });
});

describe("el escudo aguanta lo que falle (deuda cerrada el 29 ago 2026)", () => {
  it("si la base se cae, el formulario NO se cierra a todo el mundo", async () => {
    // Cerrar el formulario por un fallo nuestro es peor que dejar pasar un mensaje de spam: se
    // pierden clientes de verdad y nadie se entera.
    const { demasiadosEnvios } = await import("@/lib/anti-bots");
    const rota = {
      prepare: () => {
        throw new Error("no such table: login_attempts");
      },
    } as unknown as D1Database;
    expect(await demasiadosEnvios(rota, "203.0.113.9")).toBe(false);
  });

  it("anotar un envío tampoco puede tumbar la página si la base falla", async () => {
    const { anotarEnvio } = await import("@/lib/anti-bots");
    const rota = {
      prepare: () => ({
        bind: () => ({ run: async () => Promise.reject(new Error("caída")) }),
      }),
    } as unknown as D1Database;
    await expect(anotarEnvio(rota, "203.0.113.9")).resolves.toBeUndefined();
  });

  it("los envíos se cuentan por IP y por hora, no en global", async () => {
    const { demasiadosEnvios, MAX_POR_HORA } = await import("@/lib/anti-bots");
    const { FakeD1 } = await import("./fake-d1");
    const db = new FakeD1(() => [{ n: MAX_POR_HORA }]);
    const ahora = new Date("2026-08-29T16:00:00Z");
    expect(await demasiadosEnvios(db.asD1(), "203.0.113.9", ahora)).toBe(true);
    const c = db.calls[0]!;
    expect(c.params[0]).toBe("form:203.0.113.9");
    expect(c.params[1]).toBe(new Date(ahora.getTime() - 3_600_000).toISOString());
    // Justo por debajo del tope todavía pasa.
    const casi = new FakeD1(() => [{ n: MAX_POR_HORA - 1 }]);
    expect(await demasiadosEnvios(casi.asD1(), "203.0.113.9", ahora)).toBe(false);
  });

  it("el guardia rechaza por el motivo correcto, en orden: trampa, pase, tope", async () => {
    const { crearPase, guardiaDeFormulario } = await import("@/lib/anti-bots");
    const { FakeD1 } = await import("./fake-d1");
    const ahora = new Date("2026-08-29T16:00:00Z");
    const base = {
      ip: "203.0.113.9",
      turnstile: "",
      minimoSegundos: 0,
    };
    // 1) La casilla escondida rellena = robot, y ni se mira nada más.
    const db1 = new FakeD1();
    const r1 = await guardiaDeFormulario(
      db1.asD1(),
      {},
      { ...base, trampa: "soy un bot", pase: "" },
      ahora,
    );
    expect(r1).toEqual({ ok: false, motivo: "robot" });
    expect(db1.calls).toHaveLength(0);

    // 2) Un pase inventado también es robot.
    const r2 = await guardiaDeFormulario(
      new FakeD1().asD1(),
      {},
      { ...base, trampa: "", pase: "inventado" },
      ahora,
    );
    expect(r2).toEqual({ ok: false, motivo: "robot" });

    // 3) Con pase bueno pero pasado del tope: «demasiados», que es un mensaje distinto. El pase se
    //    firma con un secreto que vive en la base, así que hay que crearlo y revisarlo en la MISMA.
    const lleno = new FakeD1((sql) =>
      sql.includes("form_secret") ? [{ value: "secreto-de-prueba" }] : [{ n: 999 }],
    );
    const pase = await crearPase(lleno.asD1(), new Date(ahora.getTime() - 10_000));
    const r3 = await guardiaDeFormulario(lleno.asD1(), {}, { ...base, trampa: "", pase }, ahora);
    expect(r3).toEqual({ ok: false, motivo: "demasiados" });
  });

  it("con todo en regla deja pasar y anota el envío", async () => {
    const { crearPase, guardiaDeFormulario } = await import("@/lib/anti-bots");
    const { FakeD1 } = await import("./fake-d1");
    const ahora = new Date("2026-08-29T16:00:00Z");
    const db = new FakeD1((sql) =>
      sql.includes("form_secret") ? [{ value: "secreto-de-prueba" }] : [{ n: 0 }],
    );
    const pase = await crearPase(db.asD1(), new Date(ahora.getTime() - 10_000));
    const r = await guardiaDeFormulario(
      db.asD1(),
      {},
      { ip: "203.0.113.9", turnstile: "", trampa: "", pase, minimoSegundos: 3 },
      ahora,
    );
    expect(r).toEqual({ ok: true });
    expect(db.calls.some((c) => c.sql.startsWith("INSERT INTO login_attempts"))).toBe(true);
  });
});
