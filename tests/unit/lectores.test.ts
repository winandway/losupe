import { describe, expect, it } from "vitest";
import {
  anotarVisita,
  bandera,
  esRobot,
  huellaDelDia,
  MINUTOS_EN_LINEA,
  nombreDePais,
  resumenDeLectores,
} from "@/lib/lectores";
import { FakeD1 } from "./fake-d1";

const NAVEGADOR =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("solo lectores de verdad", () => {
  it("los robots conocidos no cuentan", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "curl/8.4.0",
      "python-requests/2.31.0",
      "Mozilla/5.0 (compatible; AhrefsBot/7.0)",
      "GPTBot/1.0",
      "facebookexternalhit/1.1",
      "Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120",
    ]) {
      expect(esRobot(ua), ua).toBe(true);
    }
  });

  it("una persona con su teléfono sí cuenta", () => {
    expect(esRobot(NAVEGADOR)).toBe(false);
    expect(
      esRobot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"),
    ).toBe(false);
  });

  it("sin navegador que se identifique, no cuenta", () => {
    expect(esRobot("")).toBe(true);
    expect(esRobot(null)).toBe(true);
    expect(esRobot("x")).toBe(true);
  });

  it("un robot no llega a escribirse en la base", async () => {
    const db = new FakeD1(() => []);
    const ok = await anotarVisita(db.asD1(), {
      ruta: "/es",
      lang: "es",
      pais: "US",
      referente: null,
      ip: "1.2.3.4",
      userAgent: "Googlebot/2.1",
    });
    expect(ok).toBe(false);
    expect(db.calls.some((c) => c.sql.includes("INSERT INTO visitas"))).toBe(false);
  });
});

describe("privacidad: se cuenta sin poder seguir a nadie", () => {
  it("la dirección IP NO se guarda en ninguna parte", async () => {
    const db = new FakeD1(() => []);
    const IP = "203.0.113.45";
    await anotarVisita(db.asD1(), {
      ruta: "/es/economia",
      lang: "es",
      pais: "US",
      referente: "google.com",
      ip: IP,
      userAgent: NAVEGADOR,
    });
    const insert = db.calls.find((c) => c.sql.includes("INSERT INTO visitas"));
    expect(insert).toBeTruthy();
    // Ni la IP ni el navegador completo pueden aparecer entre lo que se guarda.
    for (const param of insert?.params ?? []) {
      expect(String(param)).not.toContain(IP);
      expect(String(param)).not.toContain("iPhone");
    }
  });

  it("la huella cambia cada día: sirve para contar, no para seguir", async () => {
    const hoy = await huellaDelDia("1.2.3.4", NAVEGADOR, new Date("2026-08-25T16:00:00Z"));
    const mañana = await huellaDelDia("1.2.3.4", NAVEGADOR, new Date("2026-08-26T16:00:00Z"));
    expect(hoy).not.toBe(mañana);
    // Pero el mismo día, la misma persona da la misma huella (si no, no se podría contar).
    const otraVezHoy = await huellaDelDia("1.2.3.4", NAVEGADOR, new Date("2026-08-25T20:00:00Z"));
    expect(otraVezHoy).toBe(hoy);
    // Y dos personas distintas dan huellas distintas.
    expect(await huellaDelDia("5.6.7.8", NAVEGADOR, new Date("2026-08-25T16:00:00Z"))).not.toBe(
      hoy,
    );
  });

  it("la huella no se puede deshacer para sacar la IP", async () => {
    const h = await huellaDelDia("203.0.113.45", NAVEGADOR);
    expect(h).toMatch(/^[0-9a-f]{24}$/);
    expect(h).not.toContain("203");
  });
});

describe("el tablero de lectores", () => {
  it("«en línea» son los de los últimos minutos", () => {
    expect(MINUTOS_EN_LINEA).toBeGreaterThan(0);
    expect(MINUTOS_EN_LINEA).toBeLessThanOrEqual(15);
  });

  it("sin base ni datos, devuelve ceros en vez de romperse", async () => {
    const rota = {
      prepare: () => {
        throw new Error("sin base");
      },
    } as unknown as D1Database;
    const r = await resumenDeLectores(rota);
    expect(r.enLinea).toBe(0);
    expect(r.paises).toEqual([]);
  });

  it("los países salen con su bandera y su nombre, no con dos letras", () => {
    expect(bandera("US")).toBe("🇺🇸");
    expect(bandera("VE")).toBe("🇻🇪");
    expect(bandera("xx")).toBe("🏳️");
    expect(nombreDePais("CO")).toBe("Colombia");
    expect(nombreDePais("VE")).toBe("Venezuela");
    expect(nombreDePais("ZZ")).toBe("ZZ");
  });
});

describe("historial de tráfico", () => {
  it("clasifica por dónde llegó cada lector", async () => {
    const { clasificarOrigen } = await import("@/lib/lectores");
    expect(clasificarOrigen("www.google.com")).toBe("buscador");
    expect(clasificarOrigen("duckduckgo.com")).toBe("buscador");
    expect(clasificarOrigen("t.co")).toBe("redes");
    expect(clasificarOrigen("m.facebook.com")).toBe("redes");
    expect(clasificarOrigen("otromedio.com")).toBe("referido");
    // Directo: sin referente, o navegando dentro del propio sitio.
    expect(clasificarOrigen(null)).toBe("directo");
    expect(clasificarOrigen("")).toBe("directo");
    expect(clasificarOrigen("losupe.com")).toBe("directo");
  });

  it("una lectura se ACTUALIZA en vez de duplicarse, y suma el tiempo", async () => {
    const { anotarVisita } = await import("@/lib/lectores");
    const db = new FakeD1(() => []);
    await anotarVisita(db.asD1(), {
      ruta: "/es/economia/una-nota",
      lang: "es",
      pais: "US",
      referente: "google.com",
      ip: "1.2.3.4",
      userAgent: NAVEGADOR,
      segundos: 45,
    });
    // La misma persona leyendo la misma nota el mismo día es UNA lectura con más tiempo, no dos:
    // primero se intenta sumar el tiempo a la que ya existe, y solo si no había ninguna se crea.
    const upd = db.calls.find((c) => c.sql.startsWith("UPDATE visitas"));
    expect(upd?.sql).toContain("segundos = segundos +");
    expect(upd?.params).toContain(45);
    expect(upd?.sql).toContain("WHERE dia = ?1 AND visitante = ?2 AND ruta = ?3");
  });

  it("un aviso no puede sumar un tiempo absurdo", async () => {
    const { anotarVisita, MAX_SEGUNDOS_POR_AVISO } = await import("@/lib/lectores");
    const db = new FakeD1(() => []);
    await anotarVisita(db.asD1(), {
      ruta: "/es",
      lang: "es",
      pais: "US",
      referente: null,
      ip: "1.2.3.4",
      userAgent: NAVEGADOR,
      segundos: 999_999,
    });
    const escritura = db.calls.find((c) => c.sql.includes("visitas"));
    expect(escritura?.params).toContain(MAX_SEGUNDOS_POR_AVISO);
    expect(escritura?.params).not.toContain(999_999);
  });

  it("los periodos se comparan con el anterior y el tiempo se lee en palabras", async () => {
    const { variacion, tiempoLegible, diaLegible } = await import("@/lib/trafico");
    expect(variacion(150, 100)).toBe(50);
    expect(variacion(50, 100)).toBe(-50);
    expect(variacion(5, 0)).toBe(100);
    expect(variacion(0, 0)).toBeNull();
    expect(tiempoLegible(0)).toBe("—");
    expect(tiempoLegible(45)).toBe("45 s");
    expect(tiempoLegible(200)).toBe("3 min 20 s");
    expect(tiempoLegible(180)).toBe("3 min");
    expect(diaLegible("2026-08-25", "2026-08-25")).toBe("hoy");
    expect(diaLegible("2026-08-24", "2026-08-25")).toMatch(/24/);
  });

  it("sin base, el tablero de tráfico sale vacío en vez de romperse", async () => {
    const { resumenDeTrafico } = await import("@/lib/trafico");
    const rota = {
      prepare: () => {
        throw new Error("sin base");
      },
    } as unknown as D1Database;
    const t = await resumenDeTrafico(rota);
    expect(t.periodos).toEqual([]);
    expect(t.masLeidas).toEqual([]);
  });
});

describe("el historial completo, con datos de verdad (deuda cerrada el 29 ago 2026)", () => {
  // Una D1 falsa que responde según qué le pregunten: es la única forma de comprobar que las seis
  // ventanas, los orígenes, los países y el día a día salen bien armados.
  function baseConDatos() {
    let ventana = 0;
    return new FakeD1((sql) => {
      // Ojo con el orden: «AS lectores» empieza por «AS l», así que los agrupados van primero.
      if (!/GROUP BY|MIN\(dia\)/.test(sql)) {
        // hoy, ayer, semana, semana pasada, mes, mes pasado
        const serie = [
          { l: 12, v: 30, t: 95.4 },
          { l: 8, v: 20, t: 80 },
          { l: 60, v: 150, t: 100 },
          { l: 40, v: 100, t: 90 },
          { l: 200, v: 500, t: 110 },
          { l: 0, v: 0, t: null },
        ];
        return [serie[ventana++] ?? serie[5]!];
      }
      if (sql.includes("GROUP BY origen"))
        return [
          { origen: "busqueda", lectores: 70 },
          { origen: "directo", lectores: 30 },
        ];
      if (sql.includes("GROUP BY pais"))
        return [
          { pais: "US", lectores: 120 },
          { pais: "VE", lectores: 40 },
        ];
      if (sql.includes("GROUP BY ruta"))
        return [{ ruta: "/es/economia/el-dolar", lectores: 90, lecturas: 140, t: 212.7 }];
      if (sql.includes("GROUP BY dia")) return [{ dia: "2026-08-28", lectores: 50, lecturas: 90 }];
      if (sql.includes("GROUP BY referente")) return [{ referente: "google.com", lectores: 65 }];
      if (sql.includes("MIN(dia)")) return [{ n: 830, desde: "2026-08-01" }];
      return [];
    });
  }

  it("arma los SEIS periodos y compara cada uno con su anterior", async () => {
    const { resumenDeTrafico } = await import("@/lib/trafico");
    const t = await resumenDeTrafico(baseConDatos().asD1(), new Date("2026-08-29T16:00:00Z"));
    expect(t.periodos.map((p) => p.clave)).toEqual([
      "hoy",
      "ayer",
      "semana",
      "semanaPasada",
      "mes",
      "mesPasado",
    ]);
    // 12 hoy contra 8 ayer = +50 %. Solo los periodos actuales llevan variación.
    expect(t.periodos[0]!.variacion).toBe(50);
    expect(t.periodos[2]!.variacion).toBe(50); // 60 contra 40
    expect(t.periodos[1]!.variacion).toBeNull();
    // Y el tiempo medio se redondea a segundos enteros.
    expect(t.periodos[0]!.tiempoMedio).toBe(95);
  });

  it("el porcentaje de cada origen se calcula sobre el total, y suma 100", async () => {
    const { resumenDeTrafico } = await import("@/lib/trafico");
    const t = await resumenDeTrafico(baseConDatos().asD1(), new Date("2026-08-29T16:00:00Z"));
    expect(t.origenes).toEqual([
      { origen: "busqueda", lectores: 70, porcentaje: 70 },
      { origen: "directo", lectores: 30, porcentaje: 30 },
    ]);
  });

  it("cada país sale con su nombre y su bandera, no con el código a secas", async () => {
    const { resumenDeTrafico } = await import("@/lib/trafico");
    const t = await resumenDeTrafico(baseConDatos().asD1(), new Date("2026-08-29T16:00:00Z"));
    expect(t.paises[0]).toMatchObject({ pais: "US", lectores: 120 });
    expect(t.paises[0]!.nombre).not.toBe("US");
    expect(t.paises[0]!.bandera.length).toBeGreaterThan(0);
  });

  it("lo más leído, el día a día y de dónde vienen salen con sus números", async () => {
    const { resumenDeTrafico } = await import("@/lib/trafico");
    const t = await resumenDeTrafico(baseConDatos().asD1(), new Date("2026-08-29T16:00:00Z"));
    expect(t.masLeidas[0]).toEqual({
      ruta: "/es/economia/el-dolar",
      lectores: 90,
      lecturas: 140,
      tiempoMedio: 213,
    });
    expect(t.porDia[0]).toEqual({ dia: "2026-08-28", lectores: 50, lecturas: 90 });
    expect(t.referentes[0]).toEqual({ referente: "google.com", lectores: 65 });
    expect(t.total).toEqual({ lecturas: 830, desde: "2026-08-01" });
  });

  it("todo se mide desde la MISMA fecha de arranque: el mes", async () => {
    // Si cada consulta arrancara en un día distinto, los números no cuadrarían entre sí y el
    // tablero mentiría sin que nadie lo notara.
    const db = baseConDatos();
    const { resumenDeTrafico } = await import("@/lib/trafico");
    await resumenDeTrafico(db.asD1(), new Date("2026-08-29T16:00:00Z"));
    const desdes = db.calls
      .filter((c) => /GROUP BY (origen|pais|ruta|dia|referente)/.test(c.sql))
      .map((c) => c.params[0]);
    expect(new Set(desdes).size).toBe(1);
  });

  it("sin lectores todavía, el porcentaje no se divide entre cero", async () => {
    const { FakeD1 } = await import("./fake-d1");
    const { resumenDeTrafico } = await import("@/lib/trafico");
    const t = await resumenDeTrafico(new FakeD1(() => []).asD1(), new Date("2026-08-29T16:00:00Z"));
    expect(t.periodos).toHaveLength(6);
    expect(t.periodos.every((p) => p.lectores === 0)).toBe(true);
    expect(t.origenes).toEqual([]);
    expect(t.total).toEqual({ lecturas: 0, desde: null });
  });

  it("la variación aguanta el arranque desde cero", async () => {
    const { variacion } = await import("@/lib/trafico");
    expect(variacion(10, 0)).toBe(100); // de nada a algo: subida completa
    expect(variacion(0, 0)).toBeNull(); // de nada a nada: no hay nada que comparar
    expect(variacion(0, 10)).toBe(-100);
    expect(variacion(15, 10)).toBe(50);
  });

  it("los tiempos y los días se leen en palabras", async () => {
    const { diaLegible, tiempoLegible } = await import("@/lib/trafico");
    expect(tiempoLegible(0)).toBe("—");
    expect(tiempoLegible(-4)).toBe("—");
    expect(tiempoLegible(45)).toBe("45 s");
    expect(tiempoLegible(120)).toBe("2 min");
    expect(tiempoLegible(200)).toBe("3 min 20 s");
    expect(diaLegible("2026-08-29", "2026-08-29")).toBe("hoy");
    expect(diaLegible("2026-08-28", "2026-08-29")).toMatch(/28/);
    expect(diaLegible("basura", "2026-08-29")).toBe("basura");
  });
});

describe("el tablero de lectores, con datos (deuda cerrada el 29 ago 2026)", () => {
  function base() {
    let ventana = 0;
    return new FakeD1((sql) => {
      if (sql.includes("GROUP BY pais")) return [{ pais: "US", lectores: 90 }];
      if (sql.includes("GROUP BY ruta")) return [{ ruta: "/es/economia/x", visitas: 140 }];
      if (sql.includes("GROUP BY h"))
        return [
          { h: "07", lectores: 5 },
          { h: "12", lectores: 30 },
        ];
      if (sql.includes("COUNT(*) AS n FROM visitas")) return [{ n: 4210 }];
      if (sql.includes("AS n FROM visitas")) return [{ n: 7 }]; // en línea
      // hoy, semana, mes
      const serie = [
        { l: 40, v: 90 },
        { l: 220, v: 500 },
        { l: 700, v: 1600 },
      ];
      return [serie[ventana++] ?? serie[2]!];
    });
  }

  it("devuelve en línea, hoy, semana, mes, países, lo más leído y las horas", async () => {
    const { resumenDeLectores } = await import("@/lib/lectores");
    const r = await resumenDeLectores(base().asD1(), new Date("2026-08-29T16:00:00Z"));
    expect(r.enLinea).toBe(7);
    expect(r.hoy).toEqual({ lectores: 40, visitas: 90 });
    expect(r.semana).toEqual({ lectores: 220, visitas: 500 });
    expect(r.mes).toEqual({ lectores: 700, visitas: 1600 });
    expect(r.paises).toEqual([{ pais: "US", lectores: 90 }]);
    expect(r.masLeidas).toEqual([{ ruta: "/es/economia/x", visitas: 140 }]);
    // La hora llega como texto ('07') y tiene que salir como número, o el gráfico se descoloca.
    expect(r.porHora).toEqual([
      { hora: 7, lectores: 5 },
      { hora: 12, lectores: 30 },
    ]);
    expect(r.total).toBe(4210);
  });

  it("«en línea» son los últimos cinco minutos, no los de hoy", async () => {
    const db = base();
    const { resumenDeLectores } = await import("@/lib/lectores");
    await resumenDeLectores(db.asD1(), new Date("2026-08-29T16:00:00Z"));
    const enLinea = db.calls.find((c) => /AS n FROM visitas WHERE ts >/.test(c.sql));
    expect(enLinea).toBeDefined();
    expect(String(enLinea!.params[0])).toBe("2026-08-29T15:55:00.000Z");
  });
});

describe("el detalle viejo se borra solo: no se guarda lo que no hace falta", () => {
  it("borra lo que pasó de los 120 días y devuelve cuántas filas se fueron", async () => {
    const { DIAS_DE_HISTORIAL, limpiarVisitasViejas } = await import("@/lib/lectores");
    class Borradora extends FakeD1 {
      override prepare(sql: string) {
        const st = super.prepare(sql);
        const run = st.run;
        st.run = async () => {
          await run();
          return { success: true, meta: { changes: 12 } };
        };
        return st;
      }
    }
    const db = new Borradora();
    const ahora = new Date("2026-08-29T16:00:00Z");
    expect(await limpiarVisitasViejas(db.asD1(), ahora)).toBe(12);
    const c = db.calls[0]!;
    expect(c.sql).toContain("DELETE FROM visitas WHERE ts <");
    const corte = new Date(ahora.getTime() - DIAS_DE_HISTORIAL * 86_400_000).toISOString();
    expect(c.params[0]).toBe(corte);
  });

  it("si la base falla, devuelve 0 en vez de tumbar la corrida del robot", async () => {
    const { limpiarVisitasViejas } = await import("@/lib/lectores");
    const rota = {
      prepare: () => {
        throw new Error("sin tabla");
      },
    } as unknown as D1Database;
    expect(await limpiarVisitasViejas(rota)).toBe(0);
  });
});
