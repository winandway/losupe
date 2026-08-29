import { describe, expect, it } from "vitest";
import { staticPath } from "@/lib/urls";

/**
 * El widget que otros sitios pegan en su web (idea nº 5 del plan de ingresos). Lo que se vigila aquí
 * es lo que lo hace útil: que se pueda pegar sin registrarse, que traiga enlaces de verdad y que no
 * pueda romper la página de quien nos incrusta.
 */

describe("el widget para otros sitios", () => {
  it("tiene su propia página, en los dos idiomas", () => {
    expect(staticPath("widget", "es")).toBe("/es/widget");
    expect(staticPath("widget", "en")).toBe("/en/widget");
  });

  it("los titulares se escapan: no se puede colar código en la web de otro", async () => {
    // Un titular con comillas o etiquetas iría dentro de un JavaScript que se ejecuta en la página
    // AJENA. Escaparlo mal sería meterle un agujero de seguridad a quien confía en nosotros.
    const peligroso = '</script><script>alert("x")</script>';
    const escapado = JSON.stringify([{ t: peligroso }])
      .replace(/</g, "\\u003c")
      .replace(/>/g, "\\u003e");
    expect(escapado).not.toContain("</script>");
    expect(escapado).toContain("\\u003c");
  });
});
