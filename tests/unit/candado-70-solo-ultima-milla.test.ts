import { describe, expect, it } from "vitest";
import { seccionCoherente, esCargaPesada } from "@/lib/robot/trends";

/**
 * Candado 70 (26 nov 2026). Richard: «no es logística de camiones, de carga pesada, de gandolas…
 * queremos hablar de la entrega de paquetería, comida, última milla, transporte, Uber, Divoox».
 * Salió en Delivery «Molson Coors y Primo Brands cubren el precio del combustible».
 */
describe("candado 70: Delivery es solo última milla", () => {
  const fuera = [
    "Molson Coors and Primo Brands use fuel hedging to tackle logistics costs",
    "Trucking rates climb as freight volumes recover in the Midwest",
    "Class 8 truck orders fall for the third month, says FTR",
    "LTL carrier Old Dominion reports weaker tonnage",
    "Precio del diésel golpea a los transportistas de carga pesada",
    "Las gandolas que cargan cabilla siguen paradas en el puerto",
    "Ocean container rates surge after port congestion",
    "Pipeline de petróleo retrasa envíos de crudo",
  ];
  const dentro = [
    "DoorDash adds new fees for Dashers in New York",
    "Amazon Flex drivers protest pay cuts",
    "Uber launches package delivery in Mexico City",
    "Rappi abre su servicio de mensajería en Bogotá",
    "Zipline drone delivery expands to Dallas",
    "inDrive lanza su servicio de mototaxi en Bolivia",
    "Divoox avanza en Venezuela ciudad por ciudad",
    "Last-mile delivery startup raises $40M for electric vans",
  ];

  it.each(fuera)("no entra en Delivery: %s", (t) => {
    expect(esCargaPesada(t)).toBe(true);
    expect(seccionCoherente("delivery", t)).not.toBe("delivery");
  });

  it.each(dentro)("sí entra en Delivery: %s", (t) => {
    expect(seccionCoherente("delivery", t)).toBe("delivery");
  });

  it("una nota de la fuente de delivery que no habla de reparto no se queda en Delivery", () => {
    expect(seccionCoherente("delivery", "Chipotle names new chief financial officer")).not.toBe(
      "delivery",
    );
  });
});
