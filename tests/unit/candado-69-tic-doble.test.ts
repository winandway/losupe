import { describe, expect, it } from "vitest";
import { contarTics, TICS_EN, TICS_ES } from "../../src/lib/robot/tics-ia";

// Candado 69 (26 nov 2026): una sola palabra contaba dos veces porque una muletilla de la lista
// está dentro de otra («underscores» contiene «underscore»). La nota de Rauw Alejandro se perdió
// el turno de las nueve por eso.
describe("candado 69 — una palabra cuenta una sola vez", () => {
  it("«underscores» cuenta una vez, no dos", () => {
    const r = contarTics("The deal underscores how big the game is.", TICS_EN);
    expect(r.total).toBe(1);
  });

  it("«seamlessly», «revolucionario» y «transformadora» cuentan una vez", () => {
    expect(contarTics("It works seamlessly.", TICS_EN).total).toBe(1);
    expect(contarTics("Un plan revolucionario.", TICS_ES).total).toBe(1);
    expect(contarTics("Una idea transformadora.", TICS_ES).total).toBe(1);
  });

  it("dos apariciones distintas siguen sumando dos", () => {
    const r = contarTics("It underscores this. It also underscores that.", TICS_EN);
    expect(r.total).toBe(2);
  });

  it("el caso real: tres palabras en mil no pasan del umbral", () => {
    const relleno = Array.from({ length: 997 }, () => "word").join(" ");
    const r = contarTics(`${relleno} underscores underscore elevate`, TICS_EN);
    expect(r.total).toBe(3);
    expect(r.excede).toBe(false);
  });
});
