import { describe, expect, it } from "vitest";
import {
  CUPO_DIARIO_MAXIMO,
  diaLocal,
  franjaActiva,
  FRANJAS,
  marcaDeFranja,
  partesEnZona,
  rangoDelDiaLocal,
  VENTANA_HORAS,
} from "@/lib/robot/franjas";

/**
 * El caso que motivó todo esto: las tres notas del 24 ago 2026 salieron a las 11:35 PM, 12:49 AM y
 * 1:08 AM hora del Este. Estas pruebas se ponen rojas si el robot vuelve a poder publicar a esas
 * horas.
 */
const madrugada = [
  new Date("2026-08-24T03:35:00Z"), // 11:35 PM del 23, hora del Este
  new Date("2026-08-24T04:49:00Z"), // 12:49 AM
  new Date("2026-08-24T05:08:00Z"), // 1:08 AM
];

describe("franjas horarias del diario", () => {
  it("lee la hora del Este de EE. UU., no la UTC", () => {
    // 16:52 UTC = 12:52 PM en Michigan (horario de verano, UTC-4)
    expect(partesEnZona(new Date("2026-08-24T16:52:00Z"))).toEqual({
      y: 2026,
      m: 8,
      d: 24,
      hh: 12,
      mm: 52,
    });
    // En enero rige el horario estándar (UTC-5): la misma hora UTC son las 11:52 AM
    expect(partesEnZona(new Date("2026-01-24T16:52:00Z")).hh).toBe(11);
  });

  it("el día cambia a medianoche del Este, no a las 8 de la noche", () => {
    // 01:00 UTC del 24 todavía es el día 23 en Michigan: aquí estaba el fallo de la cuota diaria.
    expect(diaLocal(new Date("2026-08-24T01:00:00Z"))).toBe("2026-08-23");
    expect(diaLocal(new Date("2026-08-24T04:00:00Z"))).toBe("2026-08-24");
    expect(diaLocal(new Date("2026-08-24T16:52:00Z"))).toBe("2026-08-24");
  });

  it("el rango del día local dura 24 horas y arranca a medianoche del Este", () => {
    const r = rangoDelDiaLocal(new Date("2026-08-24T16:52:00Z"));
    expect(r.desde).toBe("2026-08-24T04:00:00.000Z"); // medianoche EDT
    expect(r.hasta).toBe("2026-08-25T04:00:00.000Z");
    // En invierno el desfase es de 5 horas, no de 4
    const inv = rangoDelDiaLocal(new Date("2026-01-24T16:52:00Z"));
    expect(inv.desde).toBe("2026-01-24T05:00:00.000Z");
    // Cómo se repartieron de verdad las tres notas: la de las 11:35 PM cuenta para el día 23 y las
    // otras dos para el 24. O sea, el «día» del 24 se gastó entero en su primera hora de vida.
    const dia23 = rangoDelDiaLocal(new Date("2026-08-23T16:00:00Z"));
    const dia24 = rangoDelDiaLocal(new Date("2026-08-24T16:00:00Z"));
    const dentro = (t: Date, r: { desde: string; hasta: string }) =>
      t.toISOString() >= r.desde && t.toISOString() < r.hasta;
    expect(dentro(madrugada[0]!, dia23)).toBe(true);
    expect(dentro(madrugada[1]!, dia24)).toBe(true);
    expect(dentro(madrugada[2]!, dia24)).toBe(true);
  });

  it("DE MADRUGADA NO SE PUBLICA (el fallo del 24 ago 2026)", () => {
    // 11:35 PM ya no es madrugada: entra en la franja de noche, que abre a las 21:00.
    expect(franjaActiva(madrugada[1]!)).toBeNull(); // 12:49 AM
    expect(franjaActiva(madrugada[2]!)).toBeNull(); // 1:08 AM
    // Ni a las 3 de la mañana, ni a las 6 (la franja de la mañana abre a las 7)
    expect(franjaActiva(new Date("2026-08-24T07:00:00Z"))).toBeNull(); // 3:00 AM
    expect(franjaActiva(new Date("2026-08-24T10:59:00Z"))).toBeNull(); // 6:59 AM
  });

  it("cada turno sigue pendiente hasta que empieza el siguiente", () => {
    // La escaleta de cuatro turnos del candado 72 (26 nov 2026).
    const casos: [string, string | null][] = [
      ["2026-08-24T11:00:00Z", "manana"], // 7:00 AM en punto · tecnología
      // 9:00 AM: el turno de las 7 sigue pendiente hasta que abre el de las 10. Sin esto, un turno
      // sin visitas a su hora en punto se perdía (1 oct 2026).
      ["2026-08-24T13:00:00Z", "manana"],
      ["2026-08-24T14:00:00Z", "manana-3"], // 10:00 AM · delivery
      ["2026-08-24T17:30:00Z", "manana-3"], // 1:30 PM: sigue abierto
      ["2026-08-24T19:00:00Z", "tarde-2b"], // 3:00 PM · delivery
      ["2026-08-24T23:59:00Z", "tarde-2b"], // 7:59 PM
      ["2026-08-25T00:00:00Z", "noche-2"], // 8:00 PM · artistas
      ["2026-08-25T01:00:00Z", null], // 9:00 PM: el último turno se cierra a la hora
      ["2026-08-25T04:00:00Z", null], // medianoche
    ];
    for (const [iso, esperado] of casos) {
      expect(franjaActiva(new Date(iso))?.key ?? null, `en ${iso}`).toBe(esperado);
    }
  });

  it("CANDADO 72: cuatro notas al día, la mitad de Delivery, todas de actualidad", () => {
    // Google bajó las páginas indexadas de 236 a 63 el 26 nov 2026: el volumen juega en contra.
    expect(FRANJAS).toHaveLength(4);
    expect(CUPO_DIARIO_MAXIMO).toBe(4);
    const deSeccion = (id: string) => FRANJAS.filter((f) => f.seccion === id);
    // Delivery es lo único con información de primera mano: dos turnos, mañana y tarde.
    expect(deSeccion("delivery")).toHaveLength(2);
    const horasDelivery = deSeccion("delivery").map((f) => f.hour);
    expect(Math.max(...horasDelivery) - Math.min(...horasDelivery)).toBeGreaterThanOrEqual(4);
    // Los dos canales de video conservan un turno cada uno.
    expect(deSeccion("tecnologia")).toHaveLength(1);
    expect(deSeccion("artistas")).toHaveLength(1);
    // Ninguna franja puede pisar a la siguiente: si se solaparan, dos notas saldrían pegadas.
    for (let i = 1; i < FRANJAS.length; i++) {
      const previa = FRANJAS[i - 1]!;
      expect(FRANJAS[i]!.hour).toBeGreaterThanOrEqual(previa.hour + VENTANA_HORAS);
    }
    // Y ninguna cae de madrugada
    for (const f of FRANJAS) expect(f.hour).toBeGreaterThanOrEqual(6);
  });

  it("CANDADO 71: ninguna franja es de curiosidades, rankings ni efemérides", () => {
    expect(FRANJAS.every((f) => f.genero === "actualidad")).toBe(true);
    expect(FRANJAS.some((f) => f.subgenero !== undefined)).toBe(false);
  });

  it("la marca del turno lleva el día local, no el UTC", () => {
    const franja = FRANJAS.find((f) => f.key === "noche-2")!;
    // 00:30 UTC del 25 = 8:30 PM del 24 en Michigan: el mismo día local, no el siguiente
    expect(marcaDeFranja(new Date("2026-08-25T00:30:00Z"), franja)).toBe("2026-08-24:noche-2");
    expect(marcaDeFranja(new Date("2026-08-24T23:00:00Z"), franja)).toBe("2026-08-24:noche-2");
  });
});

describe("la configuración de la plataforma va con las franjas", () => {
  it("yadominios.json dispara en las horas de las tres franjas, no cada 2 horas", async () => {
    const { readFileSync } = await import("node:fs");
    const conf = JSON.parse(readFileSync("yadominios.json", "utf8")) as {
      triggers?: { crons?: string[] };
      limits?: { cpu_ms?: number };
    };
    const cron = conf.triggers?.crons?.[0] ?? "";
    // Con diez turnos repartidos entre las 7 de la mañana y las 9 de la noche del Este, el reloj de
    // la plataforma dispara CADA HORA dentro de esa ventana (en UTC, de las 11 a las 2).
    expect(cron).toBe("0 0-2,11-23 * * *");
    // Y nunca de madrugada del Este (de 3 a 10 UTC son de 11 PM a 6 AM allá).
    expect(cron).not.toContain("3-10");
    // El reloj de GitHub, que es el que de verdad manda, dispara CADA HORA. Motivo medido el 29 ago
    // 2026: los cron de GitHub se retrasan mucho y de ocho disparos diarios llegaban uno o dos.
    // Fuera de franja no publica, y el turno del día impide que dos disparos escriban dos notas.
    const wf = readFileSync(".github/workflows/robot.yml", "utf8");
    expect(wf).toContain('cron: "7 * * * *"');
    // Escribir una nota necesita más CPU que la del reparto por defecto
    expect(conf.limits?.cpu_ms ?? 0).toBeGreaterThanOrEqual(60_000);
  });
});

describe("los intentos de una franja dan margen a un arreglo", () => {
  it("ocho intentos por franja, no tres", async () => {
    const { MAX_INTENTOS_POR_FRANJA } = await import("@/lib/robot/heartbeat");
    // El 24 ago 2026 un solo tema envenenado se comió los tres intentos de dos franjas seguidas y
    // el diario se quedó sin publicar en todo el día. Y el 1 oct 2026, con cinco, los fallos del
    // proveedor (503 y el centro de datos sin servicio) agotaron el turno de las dos de la tarde.
    expect(MAX_INTENTOS_POR_FRANJA).toBeGreaterThanOrEqual(8);
  });
});

describe("la corrida no depende de quien la llama", () => {
  const ENV = { DB: undefined, CRON_SECRET: "s3creto" } as never;

  it("responde AL INSTANTE y escribe la nota por detrás", async () => {
    const { handleScheduledRequest } = await import("@/lib/robot/scheduled");
    const pendientes: Promise<unknown>[] = [];
    const ctx = { waitUntil: (p: Promise<unknown>) => void pendientes.push(p) };
    const t0 = Date.now();
    const res = await handleScheduledRequest(
      new Request("https://losupe.com/__scheduled?key=s3creto"),
      ENV,
      ctx,
    );
    // 202 = «arrancada». Si esperase a escribir la nota, la petición duraría 30-90 segundos y
    // quien la llamó podría colgar y matarla (fue lo que pasó el 24 ago 2026, once veces).
    expect(res.status).toBe(202);
    expect(Date.now() - t0).toBeLessThan(500);
    expect(await res.json()).toMatchObject({ ok: true, started: true });
    expect(pendientes).toHaveLength(1);
  });

  it("con ?wait=1 sí espera, para poder diagnosticar a mano", async () => {
    const { handleScheduledRequest } = await import("@/lib/robot/scheduled");
    const ctx = { waitUntil: () => undefined };
    const res = await handleScheduledRequest(
      new Request("https://losupe.com/__scheduled?key=s3creto&wait=1"),
      ENV,
      ctx,
    );
    expect(res.status).not.toBe(202);
  });

  it("sin la llave no corre nada", async () => {
    const { handleScheduledRequest } = await import("@/lib/robot/scheduled");
    const res = await handleScheduledRequest(
      new Request("https://losupe.com/__scheduled?key=mala"),
      ENV,
      { waitUntil: () => undefined },
    );
    expect(res.status).toBe(404);
  });
});

describe("el reintento no vuelve a pagar por una nota que ya salió (28 ago 2026)", () => {
  /**
   * Lo que pasó: la corrida de la tarde publicó a los 15 minutos, y en ese mismo instante el
   * guardia de corridas colgadas la marcó «error» por llevar 15 minutos. El siguiente latido vio
   * «error», creyó que el turno estaba pendiente y volvió a escribir. Cuatro veces. Cuatro llamadas
   * de pago a la IA por una nota que ya estaba en la portada.
   */
  const TARDE = new Date("2026-08-28T21:30:00Z"); // 5:30 PM del Este, franja de tarde

  function base(opts: { notasEnLaFranja: number; marca: string }) {
    return {
      prepare(sql: string) {
        let params: unknown[] = [];
        const stmt = {
          bind: (...p: unknown[]) => {
            params = p;
            return stmt;
          },
          first: async () => {
            if (sql.includes("robot_paused")) return { value: "0" };
            if (sql.includes("FROM articles")) return { n: opts.notasEnLaFranja };
            if (sql.includes("FROM runs")) return { status: "error" };
            if (sql.includes("SELECT value FROM settings")) return { value: opts.marca };
            return null;
          },
          run: async () => ({ success: true, meta: { changes: 1 } }),
          all: async () => ({ results: [] }),
        };
        void params;
        return stmt;
      },
    } as unknown as D1Database;
  }

  it("con la nota del turno YA publicada, no se reintenta aunque la corrida diga «error»", async () => {
    const { claimTick } = await import("@/lib/robot/heartbeat");
    const d = await claimTick(base({ notasEnLaFranja: 1, marca: "2026-08-28:tarde-2b" }), TARDE);
    expect(d).toEqual({ run: false, reason: "turno_hecho" });
  });

  it("sin nota todavía, sí se reintenta: una corrida cortada no puede perder el turno", async () => {
    const { claimTick } = await import("@/lib/robot/heartbeat");
    const d = await claimTick(base({ notasEnLaFranja: 0, marca: "2026-08-28:tarde-2b" }), TARDE);
    expect(d.run).toBe(true);
  });

  it("el guardia no mata a la corrida puntual: media hora, no un cuarto", async () => {
    const { MINUTOS_ANTES_DE_DARLA_POR_MUERTA } = await import("@/lib/robot/heartbeat");
    // Escribir una nota bilingüe con imagen tarda ~15 minutos de verdad. Con el límite en 15, el
    // guardia la declaraba muerta justo al terminar.
    expect(MINUTOS_ANTES_DE_DARLA_POR_MUERTA).toBeGreaterThanOrEqual(30);
  });

  it("el inicio de la franja se calcula en hora del Este, verano e invierno", async () => {
    const { FRANJAS, inicioDeFranja } = await import("@/lib/robot/franjas");
    const tarde = FRANJAS.find((f) => f.key === "tarde-2b")!; // 15:00 ET
    // En verano (UTC-4) las 3 PM del Este son las 19:00 UTC
    expect(inicioDeFranja(new Date("2026-08-28T19:30:00Z"), tarde)).toBe(
      "2026-08-28T19:00:00.000Z",
    );
    // En invierno (UTC-5), las 20:00 UTC
    expect(inicioDeFranja(new Date("2026-01-28T20:30:00Z"), tarde)).toBe(
      "2026-01-28T20:00:00.000Z",
    );
  });
});

/**
 * LOS RELOJES LLEGAN TARDE (medido el 1 de octubre de 2026). El de la plataforma dispara a sus
 * horas viejas, el de GitHub cuatro o cinco veces al día en vez de cada hora, y las corridas que
 * arranca una visita al sitio se mueren antes de terminar. Con una ventana rígida por turno, ese
 * día salió UNA nota de diez. La escaleta pasa a ser una lista de pendientes.
 */
describe("la escaleta se adapta a relojes que llegan tarde", () => {
  it("un despertar tardío atiende el turno más atrasado del día, no el de esa hora", async () => {
    const { franjaPendiente, FRANJAS } = await import("@/lib/robot/franjas");
    // 4 de la tarde del Este, con UNA nota publicada en todo el día.
    const tarde = new Date("2026-10-01T20:30:00Z");
    const toca = franjaPendiente(tarde, 1);
    // El segundo turno del día (10:00, delivery), que se quedó sin escribir.
    expect(toca?.key).toBe("manana-3");
    expect(toca?.seccion).toBe("delivery");
    // Y con cero notas, el primero de todos.
    expect(franjaPendiente(tarde, 0)?.key).toBe(FRANJAS[0]!.key);
  });

  it("nunca se adelanta un turno que todavía no tiene hora", async () => {
    const { franjaPendiente } = await import("@/lib/robot/franjas");
    // 9 de la mañana con una nota ya publicada: el turno de las 10 aún no toca.
    expect(franjaPendiente(new Date("2026-10-01T13:00:00Z"), 1)).toBeNull();
  });

  it("y de madrugada no se publica, por muchas notas que falten", async () => {
    const { franjaPendiente } = await import("@/lib/robot/franjas");
    // 11 de la noche y 2 de la mañana del Este, con el día entero sin publicar.
    expect(franjaPendiente(new Date("2026-10-02T03:00:00Z"), 0)).toBeNull();
    expect(franjaPendiente(new Date("2026-10-02T06:00:00Z"), 0)).toBeNull();
  });

  it("con el día al día, no se escribe de más", async () => {
    const { franjaPendiente, FRANJAS } = await import("@/lib/robot/franjas");
    expect(franjaPendiente(new Date("2026-10-02T01:30:00Z"), FRANJAS.length)).toBeNull();
  });

  it("dos despertares seguidos no publican dos notas pegadas", async () => {
    const { MINUTOS_ENTRE_NOTAS } = await import("@/lib/robot/heartbeat");
    expect(MINUTOS_ENTRE_NOTAS).toBeGreaterThanOrEqual(15);
  });
});
