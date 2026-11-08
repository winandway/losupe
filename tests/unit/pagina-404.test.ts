import { describe, expect, it } from "vitest";
import { debeServir404Propia, esRuta404, ruta404 } from "@/lib/pagina-404";

const html = (status: number) =>
  new Response('<html id="__next_error__"></html>', {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  });

describe("candado 59: la 404 viene hecha desde el servidor", () => {
  it("una visita a una página que no existe recibe la 404 propia", () => {
    expect(debeServir404Propia(new Request("https://x/es/nada"), html(404), "es")).toBe(true);
  });
  it("no toca respuestas buenas, ni la navegación interna, ni lo que no es HTML", () => {
    expect(debeServir404Propia(new Request("https://x/es"), html(200), "es")).toBe(false);
    const rsc = new Request("https://x/es/nada", { headers: { rsc: "1" } });
    expect(debeServir404Propia(rsc, html(404), "es")).toBe(false);
    const json = new Response("{}", {
      status: 404,
      headers: { "content-type": "application/json" },
    });
    expect(debeServir404Propia(new Request("https://x/es/nada"), json, "es")).toBe(false);
    expect(debeServir404Propia(new Request("https://x/panel/x"), html(404), null)).toBe(false);
    const post = new Request("https://x/es/nada", { method: "POST" });
    expect(debeServir404Propia(post, html(404), "es")).toBe(false);
  });
  it("la ruta interna es la misma en los dos idiomas y también responde 404", () => {
    expect(ruta404("en")).toBe("/en/error-404");
    expect(esRuta404("/es/error-404", "es")).toBe(true);
    expect(esRuta404("/es/otra", "es")).toBe(false);
  });
});
