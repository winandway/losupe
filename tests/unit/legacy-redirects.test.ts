import { describe, expect, it } from "vitest";
import { LEGACY_PATHS, legacyRedirectTarget } from "@/lib/legacy-redirects";

describe("redirecciones de rutas viejas", () => {
  it("manda la URL vieja de Mercatren a la nueva, con o sin barra final", () => {
    const old =
      "/es/ventas/pedro-llerena-lanza-mercatren-tienda-1-3-millones-de-productos-competir-amazon";
    expect(legacyRedirectTarget(old)).toBe(LEGACY_PATHS[old]);
    expect(legacyRedirectTarget(`${old}/`)).toBe(LEGACY_PATHS[old]);
    expect(legacyRedirectTarget("/es/ventas/otra-nota")).toBeNull();
    expect(legacyRedirectTarget("/")).toBeNull();
  });
  it("ninguna ruta nueva apunta a una vieja ni a sí misma", () => {
    for (const [from, to] of Object.entries(LEGACY_PATHS)) {
      expect(from).not.toBe(to);
      expect(LEGACY_PATHS[to]).toBeUndefined();
      expect(to.startsWith("/es/") || to.startsWith("/en/")).toBe(true);
    }
  });
});
