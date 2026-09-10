import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * LA COMPUERTA QUE NO BLOQUEABA (9 sep 2026).
 *
 * Al separar el audit de producción del de desarrollo escribí esto:
 *
 *   npm audit --omit=dev --audit-level=high && npm audit --audit-level=high || true
 *
 * En shell, `A && B || C` se agrupa como `(A && B) || C`. Si A falla —es decir, si HAY
 * vulnerabilidades altas en producción— el `|| true` lo tapa y **el script devuelve 0**. La
 * compuerta bloqueante no bloqueaba nada, y encima parecía que sí.
 *
 * Es justo el fallo silencioso que más daño hace: un semáforo apagado que se ve verde. Lo cazó la
 * revisión automática de seguridad del commit, no una persona.
 */
describe("el audit de producción tiene que PODER frenar el push", () => {
  const scripts = (
    JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    }
  ).scripts;

  it("el `|| true` está agrupado y solo cubre al audit informativo", () => {
    const audit = scripts.audit ?? "";
    expect(audit).toContain("--omit=dev");
    // La forma sin llaves es la que se traga el fallo de producción.
    expect(audit, "el || true suelto tapa el fallo de producción").not.toMatch(
      /--omit=dev[^&]*&&\s*npm audit[^|]*\|\|\s*true\s*$/,
    );
    expect(audit).toMatch(/\{\s*npm audit[^}]*\|\|\s*true;?\s*\}/);
  });

  it("y se demuestra con el shell, no de palabra", () => {
    const corre = (cmd: string) => {
      try {
        execFileSync("bash", ["-c", cmd], { stdio: "ignore" });
        return 0;
      } catch (e) {
        return (e as { status?: number }).status ?? 1;
      }
    };
    // La forma vieja: aunque el primero falle, el resultado es 0. Eso es la compuerta apagada.
    expect(corre("false && echo ok || true"), "la forma vieja se traga el fallo").toBe(0);
    // La forma nueva: si el primero falla, falla el conjunto.
    expect(corre("false && { echo ok || true; }"), "la forma agrupada sí bloquea").not.toBe(0);
    // Y cuando el primero pasa, el segundo no puede tumbar el push.
    expect(corre("true && { false || true; }")).toBe(0);
  });

  it("verify sigue llamando al audit y a la búsqueda de secretos", () => {
    expect(scripts.verify).toContain("npm run audit");
    expect(scripts.verify).toContain("npm run secrets");
  });
});
