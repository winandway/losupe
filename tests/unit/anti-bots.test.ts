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
