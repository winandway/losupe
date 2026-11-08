import { describe, expect, it } from "vitest";
import { classifyTrend, seccionCoherente } from "@/lib/robot/trends";

describe("clasificación de sección: nada de deporte en Tecnología ni finanzas en Artistas", () => {
  it("un traspaso de hockey que no dice «hockey» no entra (visto el 19 oct 2026)", () => {
    expect(
      seccionCoherente(
        "tecnologia",
        "Canucks acquire defenseman from Penguins in three-player deal",
      ),
    ).toBeNull();
    expect(
      seccionCoherente("tecnologia", "El portero titular firma por dos temporadas más"),
    ).toBeNull();
    expect(
      seccionCoherente("artistas", "Hat trick sends Oilers to the Stanley Cup final"),
    ).toBeNull();
  });
  it("unos fondos de pensiones que llegan por el feed de espectáculos van a Economía", () => {
    expect(
      seccionCoherente("artistas", "Los fondos de pensiones aumentan su peso en renta fija"),
    ).toBe("economia");
    expect(seccionCoherente("artistas", "Pension funds pull billions from private equity")).toBe(
      "economia",
    );
  });
  it("lo que encaja con su fuente se queda en su sección", () => {
    expect(seccionCoherente("artistas", "Taylor Swift anuncia gira y suben los precios")).toBe(
      "artistas",
    );
    expect(seccionCoherente("tecnologia", "OpenAI presenta un modelo nuevo para empresas")).toBe(
      "tecnologia",
    );
  });
  it("lo que no encaja con ninguna regla se queda en la sección de su fuente", () => {
    expect(seccionCoherente("tecnologia", "Lo que hay que saber antes del lanzamiento")).toBe(
      "tecnologia",
    );
  });
  it("las tendencias de Google tampoco se llevan deportes", () => {
    expect(classifyTrend("Rangers goaltender out for season")).toBeNull();
  });
});
