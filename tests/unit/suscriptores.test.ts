import { describe, expect, it, vi } from "vitest";
import {
  confirmSubscriber,
  countConfirmed,
  subscribe,
  subscribeSchema,
  unsubscribe,
} from "@/lib/subscribers";
import { FakeD1 } from "./fake-d1";

/**
 * Los correos de la gente son datos personales: esto se prueba a fondo por obligación, no por gusto.
 * Deuda cerrada el 29 ago 2026.
 */

class Cambia extends FakeD1 {
  constructor(
    private cambios: number,
    responder: (sql: string, params: unknown[]) => Record<string, unknown>[] = () => [],
  ) {
    super(responder);
  }
  override prepare(sql: string) {
    const st = super.prepare(sql);
    const run = st.run;
    st.run = async () => {
      await run();
      return { success: true, meta: { changes: this.cambios } };
    };
    return st;
  }
}

const ENV = {
  YAD_SITE: "losupe",
  YAD_TOKEN: "t",
  MAIL_FROM: "avisos@losupe.com",
};

describe("apuntarse al boletín", () => {
  it("un correo mal escrito no llega ni a tocar la base", () => {
    for (const email of ["", "hola", "hola@", "@losupe.com", "a b@c.com"]) {
      expect(subscribeSchema.safeParse({ email }).success, email).toBe(false);
    }
    expect(subscribeSchema.safeParse({ email: "ana@ejemplo.com" }).success).toBe(true);
  });

  it("el correo se guarda en minúsculas: nadie se apunta dos veces por escribirlo distinto", async () => {
    const db = new Cambia(1);
    const enviar = vi.fn(async () => new Response("{}", { status: 200 }));
    await subscribe(
      db.asD1(),
      ENV,
      "https://losupe.com",
      { email: "  Ana@Ejemplo.COM  ", lang: "es" },
      enviar as unknown as typeof fetch,
    );
    for (const c of db.calls) {
      for (const p of c.params) {
        if (typeof p === "string" && p.includes("@")) expect(p).toBe("ana@ejemplo.com");
      }
    }
  });

  it("quien ya está confirmado no recibe otro correo de confirmación", async () => {
    const db = new Cambia(1, (sql) =>
      sql.includes("SELECT status FROM subscribers") ? [{ status: "confirmed" }] : [],
    );
    const enviar = vi.fn();
    const r = await subscribe(
      db.asD1(),
      ENV,
      "https://losupe.com",
      { email: "ana@ejemplo.com", lang: "es" },
      enviar as unknown as typeof fetch,
    );
    expect(r).toEqual({ ok: true, state: "already" });
    expect(enviar).not.toHaveBeenCalled();
  });

  it("nace SIN confirmar y con su llave de baja desde el primer momento", async () => {
    const db = new Cambia(1);
    const enviar = vi.fn(async () => new Response("{}", { status: 200 }));
    const r = await subscribe(
      db.asD1(),
      ENV,
      "https://losupe.com",
      { email: "ana@ejemplo.com", lang: "es" },
      enviar as unknown as typeof fetch,
    );
    expect(r.ok).toBe(true);
    const insert = db.calls.find((c) => /INSERT INTO subscribers/i.test(c.sql));
    expect(insert, "tiene que guardarse").toBeDefined();
    // Un suscriptor nuevo NUNCA nace confirmado: si no, cualquiera apunta el correo de otro.
    expect(insert!.sql).not.toMatch(/'confirmed'/);
    // Y el enlace de baja se crea con él, no cuando alguien lo pide.
    expect(insert!.params.some((p) => typeof p === "string" && p.length >= 16)).toBe(true);
  });

  it("SI EL CORREO FALLA, EL MOTIVO QUEDA ESCRITO en la ficha (nunca un fallo mudo)", async () => {
    const db = new Cambia(1);
    const caido = vi.fn(async () => new Response("no", { status: 500 }));
    const pendientes: Promise<unknown>[] = [];
    await subscribe(
      db.asD1(),
      ENV,
      "https://losupe.com",
      { email: "ana@ejemplo.com", lang: "es" },
      caido as unknown as typeof fetch,
      (p) => void pendientes.push(p),
    );
    await Promise.all(pendientes);
    const anotado = db.calls.find((c) => c.sql.includes("mail_error"));
    expect(anotado, "el fallo del correo tiene que verse en la ficha").toBeDefined();
    expect(String(anotado!.params[0])).toBe("ana@ejemplo.com");
  });

  it("sin las llaves del correo lo dice, no se queda callado", async () => {
    const db = new Cambia(1);
    const r = await subscribe(db.asD1(), {}, "https://losupe.com", {
      email: "ana@ejemplo.com",
      lang: "es",
    });
    expect(r.ok).toBe(false);
  });

  it("si la base revienta devuelve el motivo, no lanza contra la página pública", async () => {
    const rota = {
      prepare: () => {
        throw new Error("no such table: subscribers");
      },
    } as unknown as D1Database;
    const r = await subscribe(rota, ENV, "https://losupe.com", {
      email: "ana@ejemplo.com",
      lang: "es",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("error");
  });
});

describe("confirmar y darse de baja", () => {
  it("confirmar con una llave buena funciona", async () => {
    const db = new Cambia(1);
    expect(await confirmSubscriber(db.asD1(), "llave-buena")).toBe(true);
    expect(db.calls[0]!.sql).toContain("status = 'pending'");
  });

  it("confirmar DOS VECES sigue diciendo que sí: la persona no tiene por qué ver un error", async () => {
    // Pasa de verdad: se pulsa el enlace del correo, se vuelve atrás y se pulsa otra vez.
    const db = new Cambia(0, (sql) => (sql.includes("'confirmed'") ? [{ x: 1 }] : []));
    expect(await confirmSubscriber(db.asD1(), "ya-confirmada")).toBe(true);
  });

  it("una llave inventada no confirma a nadie", async () => {
    const db = new Cambia(0, () => []);
    expect(await confirmSubscriber(db.asD1(), "inventada")).toBe(false);
  });

  it("la baja funciona con la llave y falla sin ella", async () => {
    expect(await unsubscribe(new Cambia(1).asD1(), "llave")).toBe(true);
    expect(await unsubscribe(new Cambia(0).asD1(), "mala")).toBe(false);
    const db = new Cambia(1);
    await unsubscribe(db.asD1(), "llave");
    // La baja marca la fecha: hace falta para poder demostrar cuándo se pidió.
    expect(db.calls[0]!.sql).toContain("unsubscribed_at");
  });

  it("la cuenta de confirmados solo cuenta a los confirmados", async () => {
    const db = new FakeD1(() => [{ n: 42 }]);
    expect(await countConfirmed(db.asD1())).toBe(42);
    expect(db.calls[0]!.sql).toContain("status = 'confirmed'");
    // Y una base vacía da cero, nunca NaN.
    expect(await countConfirmed(new FakeD1(() => []).asD1())).toBe(0);
  });
});

describe("el recordatorio: UNO y no más", () => {
  const pendientes = [
    { email: "ana@ejemplo.com", token: "t1", lang: "es" },
    { email: "john@example.com", token: "t2", lang: "en" },
  ];

  it("recuerda solo a quien lleva 20 horas sin confirmar y aún no fue avisado", async () => {
    const { HORAS_ANTES_DE_RECORDAR, recordarConfirmacion } = await import("@/lib/subscribers");
    const db = new Cambia(1, (sql) => (sql.includes("SELECT email, token") ? pendientes : []));
    const enviar = vi.fn(async () => new Response("{}", { status: 200 }));
    const ahora = new Date("2026-08-29T16:00:00Z");
    const r = await recordarConfirmacion(
      db.asD1(),
      ENV,
      "https://losupe.com",
      ahora,
      enviar as unknown as typeof fetch,
    );
    expect(r.enviados).toBe(2);
    const consulta = db.calls[0]!;
    expect(consulta.sql).toContain("reminded_at IS NULL");
    expect(consulta.sql).toContain("status = 'pending'");
    expect(consulta.params[0]).toBe(
      new Date(ahora.getTime() - HORAS_ANTES_DE_RECORDAR * 3_600_000).toISOString(),
    );
  });

  it("se marca como avisado AUNQUE EL CORREO FALLE: nadie recibe el mismo aviso dos veces", async () => {
    const { recordarConfirmacion } = await import("@/lib/subscribers");
    const db = new Cambia(1, (sql) => (sql.includes("SELECT email, token") ? pendientes : []));
    const caido = vi.fn(async () => new Response("no", { status: 500 }));
    const r = await recordarConfirmacion(
      db.asD1(),
      ENV,
      "https://losupe.com",
      new Date("2026-08-29T16:00:00Z"),
      caido as unknown as typeof fetch,
    );
    expect(r.enviados).toBe(0);
    expect(r.errores).toHaveLength(2); // y el motivo se dice, no se traga
    expect(db.calls.filter((c) => c.sql.includes("reminded_at =")).length).toBe(2);
  });

  it("cada quien recibe el aviso en SU idioma", async () => {
    const { recordarConfirmacion } = await import("@/lib/subscribers");
    const db = new Cambia(1, (sql) => (sql.includes("SELECT email, token") ? pendientes : []));
    const cuerpos: string[] = [];
    const enviar = vi.fn(async (_u: RequestInfo | URL, init?: RequestInit) => {
      cuerpos.push(String(init?.body ?? ""));
      return new Response("{}", { status: 200 });
    });
    await recordarConfirmacion(
      db.asD1(),
      ENV,
      "https://losupe.com",
      new Date("2026-08-29T16:00:00Z"),
      enviar as unknown as typeof fetch,
    );
    expect(cuerpos[0]).toContain("Te falta un toque");
    expect(cuerpos[1]).toContain("One tap");
    // Y con su enlace de alta, con la llave escapada por si trae caracteres raros.
    expect(cuerpos[0]).toContain("alta=t1");
  });

  it("sin llaves de correo no intenta nada ni se queja", async () => {
    const { recordarConfirmacion } = await import("@/lib/subscribers");
    const db = new Cambia(1);
    const r = await recordarConfirmacion(db.asD1(), {}, "https://losupe.com");
    expect(r).toEqual({ enviados: 0, errores: [] });
    expect(db.calls).toHaveLength(0);
  });

  it("si la base falla, el motivo sale en la lista de errores", async () => {
    const { recordarConfirmacion } = await import("@/lib/subscribers");
    const rota = {
      prepare: () => {
        throw new Error("no such column: reminded_at");
      },
    } as unknown as D1Database;
    const r = await recordarConfirmacion(rota, ENV, "https://losupe.com");
    expect(r.enviados).toBe(0);
    expect(r.errores[0]).toContain("reminded_at");
  });
});
