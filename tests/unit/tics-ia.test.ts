import { describe, expect, it } from "vitest";
import {
  contarTics,
  MAX_TICS_POR_MIL,
  normalizar,
  revisarSonidoHumano,
  ticsEnTitular,
  TICS_EN,
  TICS_ES,
} from "@/lib/robot/tics-ia";

/** Relleno humano y normal, para que la densidad se mida sobre una nota de largo real. */
function relleno(palabras: number): string {
  return Array.from({ length: palabras }, (_, i) => `palabra${i % 40}`).join(" ");
}

describe("que no suene a máquina", () => {
  it("normaliza tildes y mayúsculas", () => {
    expect(normalizar("Cabe SEÑALAR")).toBe("cabe senalar");
    expect(normalizar("Resiliencia")).toBe("resiliencia");
  });

  it("UNA muletilla suelta no molesta: no se veta ninguna palabra", () => {
    // El caso que pidió Richard: «resiliencia» puede ser la palabra exacta si el informe la usa.
    const nota = `El Fondo Monetario habla de la resiliencia de la economia. ${relleno(900)}`;
    const r = contarTics(nota, TICS_ES);
    expect(r.encontrados).toContain("resiliencia");
    expect(r.excede).toBe(false);
    expect(revisarSonidoHumano(nota, relleno(900))).toBeNull();
  });

  it("amontonadas SÍ: eso es lo que delata a una IA", () => {
    const nota =
      `En el panorama actual, la resiliencia del sector es crucial. Cabe destacar que este ` +
      `robusto ecosistema digital juega un papel de piedra angular. En resumen, un punto de ` +
      `inflexion transformador. ${relleno(200)}`;
    const r = contarTics(nota, TICS_ES);
    expect(r.total).toBeGreaterThanOrEqual(8);
    expect(r.excede).toBe(true);
    const aviso = revisarSonidoHumano(nota, relleno(900));
    expect(aviso).toContain("suena a máquina");
    expect(aviso).toContain("panorama actual");
    // El aviso explica que NO se prohíben, que el problema es la cantidad.
    expect(aviso).toContain("No están prohibidas");
  });

  it("también revisa el inglés por su cuenta", () => {
    const en =
      `Delve into this robust and seamless landscape. It is worth noting this pivotal, ` +
      `crucial game-changer, a testament to resilience. ${relleno(200)}`;
    expect(contarTics(en, TICS_EN).excede).toBe(true);
    // Con el español limpio, el aviso habla solo del inglés
    const aviso = revisarSonidoHumano(relleno(900), en);
    expect(aviso).toContain("en inglés");
    expect(aviso).not.toContain("en español");
  });

  it("la densidad se mide por cada mil palabras, no por nota", () => {
    const tres = "resiliencia robusto sinergia ";
    // 3 muletillas en 1000 palabras: justo en el límite, pasa.
    expect(contarTics(tres + relleno(997), TICS_ES).excede).toBe(false);
    // Las mismas 3 en una nota de 200 palabras: eso ya es relleno.
    expect(contarTics(tres + relleno(197), TICS_ES).excede).toBe(true);
    expect(MAX_TICS_POR_MIL).toBe(3);
  });

  it("no explota con texto vacío", () => {
    const r = contarTics("", TICS_ES);
    expect(r).toMatchObject({ total: 0, palabras: 0, densidad: 0, excede: false });
  });

  it("las listas no traen duplicados ni entradas vacías", () => {
    for (const lista of [TICS_ES, TICS_EN]) {
      expect(new Set(lista).size).toBe(lista.length);
      for (const t of lista) expect(t.trim()).toBe(t);
      for (const t of lista) expect(t.length).toBeGreaterThan(2);
    }
  });
});

describe("el titular se mide aparte y con más rigor", () => {
  it("UNA muletilla en el titular ya lo devuelve (el caso que vio Richard)", () => {
    const aviso = revisarSonidoHumano(relleno(900), relleno(900), undefined, {
      es: "La resiliencia de la economia de EE. UU.: que la hace fuerte",
      en: "What keeps the US economy going",
    });
    expect(aviso).toContain("El titular delata");
    expect(aviso).toContain("resiliencia");
    // Y le dice dónde sí puede usarla
    expect(aviso).toContain("DENTRO del texto");
  });

  it("también vigila el titular en inglés", () => {
    const aviso = revisarSonidoHumano(relleno(900), relleno(900), undefined, {
      es: "Cuanto cuesta de verdad un dominio en 2026",
      en: "Delve into what a domain really costs in 2026",
    });
    expect(aviso).toContain("delve");
  });

  it("un titular normal pasa, aunque el cuerpo lleve la palabra una vez", () => {
    const cuerpo = `El informe habla de resiliencia. ${relleno(900)}`;
    expect(
      revisarSonidoHumano(cuerpo, relleno(900), undefined, {
        es: "El dominio mas barato cuesta 9 dolares: lo que nadie te dice de la renovacion",
        en: "The cheapest domain costs $9. Nobody tells you about the renewal",
      }),
    ).toBeNull();
  });

  it("ticsEnTitular no mide densidad: una sola cuenta", () => {
    expect(ticsEnTitular("La resiliencia del mercado", TICS_ES)).toEqual(["resiliencia"]);
    expect(ticsEnTitular("El mercado aguanta el golpe", TICS_ES)).toEqual([]);
  });
});
