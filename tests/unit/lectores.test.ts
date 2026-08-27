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
