import { describe, expect, it } from "vitest";
import {
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
    for (const t of madrugada) {
      expect(franjaActiva(t)).toBeNull();
    }
    // Ni a las 3 de la mañana, ni a las 6 (la franja de la mañana abre a las 7)
    expect(franjaActiva(new Date("2026-08-24T07:00:00Z"))).toBeNull(); // 3:00 AM
    expect(franjaActiva(new Date("2026-08-24T10:59:00Z"))).toBeNull(); // 6:59 AM
  });

  it("abre en las tres franjas y en la ventana de tolerancia", () => {
    const casos: [string, string | null][] = [
      ["2026-08-24T11:00:00Z", "manana"], // 7:00 AM en punto
      ["2026-08-24T13:30:00Z", "manana"], // 9:30 AM, todavía dentro de la ventana
      ["2026-08-24T13:59:00Z", "manana"], // 9:59 AM, último minuto
      ["2026-08-24T14:00:00Z", null], // 10:00 AM, se cerró
      ["2026-08-24T16:00:00Z", "mediodia"], // 12:00 PM
      ["2026-08-24T18:59:00Z", "mediodia"], // 2:59 PM
      ["2026-08-24T19:00:00Z", null], // 3:00 PM
      ["2026-08-24T21:00:00Z", "tarde"], // 5:00 PM
      ["2026-08-24T23:59:00Z", "tarde"], // 7:59 PM
      ["2026-08-25T00:00:00Z", null], // 8:00 PM, se acabó el día
    ];
    for (const [iso, esperado] of casos) {
      expect(franjaActiva(new Date(iso))?.key ?? null, `en ${iso}`).toBe(esperado);
    }
  });

  it("son tres franjas, separadas y en horas de lectura", () => {
    expect(FRANJAS.map((f) => f.key)).toEqual(["manana", "mediodia", "tarde"]);
    expect(FRANJAS.map((f) => f.hour)).toEqual([7, 12, 17]);
    // Ninguna franja puede pisar a la siguiente: si se solaparan, dos notas saldrían pegadas.
    for (let i = 1; i < FRANJAS.length; i++) {
      const previa = FRANJAS[i - 1]!;
      expect(FRANJAS[i]!.hour).toBeGreaterThanOrEqual(previa.hour + VENTANA_HORAS);
    }
    // Y ninguna cae de madrugada
    for (const f of FRANJAS) expect(f.hour).toBeGreaterThanOrEqual(6);
  });

  it("la marca del turno lleva el día local, no el UTC", () => {
    const franja = FRANJAS[2]!;
    // 23:00 UTC del 24 = 7 PM del 24 en Michigan
    expect(marcaDeFranja(new Date("2026-08-24T23:00:00Z"), franja)).toBe("2026-08-24:tarde");
    // 01:00 UTC del 25 = 9 PM del 24: el mismo día local, no el siguiente
    expect(marcaDeFranja(new Date("2026-08-25T01:00:00Z"), franja)).toBe("2026-08-24:tarde");
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
    // Las dos horas UTC posibles de cada franja (verano e invierno)
    for (const hora of [11, 12, 16, 17, 21, 22]) expect(cron).toContain(String(hora));
    // Y ninguna de madrugada del Este (13, 15, 19 UTC eran del cron viejo de cada 2 horas)
    expect(cron).not.toContain("13,");
    // Escribir una nota necesita más CPU que la del reparto por defecto
    expect(conf.limits?.cpu_ms ?? 0).toBeGreaterThanOrEqual(60_000);
  });
});

describe("los intentos de una franja dan margen a un arreglo", () => {
  it("cinco intentos por franja, no tres", async () => {
    const { MAX_INTENTOS_POR_FRANJA } = await import("@/lib/robot/heartbeat");
    // El 24 ago 2026 un solo tema envenenado se comió los tres intentos de dos franjas seguidas y
    // el diario se quedó sin publicar en todo el día.
    expect(MAX_INTENTOS_POR_FRANJA).toBe(5);
  });
});
