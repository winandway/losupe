import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { CON_MINIATURA } from "@/lib/miniaturas-locales";
import { rutaMiniatura } from "@/lib/robot/images";

/**
 * LA MINIATURA ROTA (10 sep 2026).
 *
 * En la portada, la nota del casillero salía con el recuadro gris y el texto alternativo en vez de
 * la foto. Al abrir la nota se veía bien; en la tarjeta, muerta. Y la tarjeta es justo donde se
 * decide si alguien entra a leer.
 *
 * La causa: `rutaMiniatura` convertía `x.jpg` en `x-sm.jpg` para CUALQUIER imagen. Eso vale para las
 * fotos del robot, que viven en R2 y donde el worker sirve la grande si falta la pequeña. Pero las
 * notas sembradas a mano llevan sus imágenes en `/img/notas/...`, que las sirve el servidor de
 * estáticos — **sin ese respaldo**. Resultado: 404 y hueco roto.
 *
 * No era solo esa nota: NINGUNA imagen local tenía miniatura, así que la nota de Mercatren de
 * agosto estaba igual de rota desde el primer día. Nadie lo vio porque ya no estaba en portada.
 */
describe("ninguna nota puede apuntar a una imagen que no existe", () => {
  const semillas = readdirSync("seed/content").filter((f) => f.endsWith(".mjs"));

  it("hay semillas que revisar", () => {
    expect(semillas.length).toBeGreaterThan(0);
  });

  it("TODA imagen local de una semilla existe en el repositorio", () => {
    const faltan: string[] = [];
    for (const archivo of semillas) {
      const texto = readFileSync(join("seed/content", archivo), "utf8");
      for (const ruta of texto.match(/\/img\/notas\/[^"' )]+\.(?:jpg|jpeg|png|webp)/gi) ?? []) {
        if (!existsSync(`public${ruta}`)) faltan.push(`${archivo} → ${ruta}`);
      }
    }
    expect(faltan, `imágenes que no existen:\n${faltan.join("\n")}`).toEqual([]);
  });

  it("y cada una tiene su MINIATURA generada (npm run miniaturas)", () => {
    // Este es el candado de verdad: sin la miniatura, la tarjeta de la portada sale rota.
    const sinMiniatura: string[] = [];
    for (const archivo of semillas) {
      const texto = readFileSync(join("seed/content", archivo), "utf8");
      for (const ruta of texto.match(/\/img\/notas\/[^"' )]+\.(?:jpg|jpeg|png|webp)/gi) ?? []) {
        if (/-sm\.[a-z]+$/i.test(ruta)) continue;
        const pequena = ruta.replace(/\.(jpg|jpeg|png|webp)$/i, "-sm.$1");
        if (!existsSync(`public${pequena}`)) sinMiniatura.push(`${archivo} → ${pequena}`);
      }
    }
    expect(
      sinMiniatura,
      `faltan miniaturas — corre \`npm run miniaturas\`:\n${sinMiniatura.join("\n")}`,
    ).toEqual([]);
  });

  it("la miniatura pesa MENOS que la grande (si no, no sirve de nada)", () => {
    const pesadas: string[] = [];
    const mirar = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const ruta = join(dir, e.name);
        if (e.isDirectory()) mirar(ruta);
        else if (/-sm\.(jpg|jpeg|png|webp)$/i.test(e.name)) {
          const grande = ruta.replace(/-sm(\.[a-z]+)$/i, "$1");
          if (existsSync(grande) && statSync(ruta).size >= statSync(grande).size) {
            pesadas.push(ruta);
          }
        }
      }
    };
    mirar("public/img/notas");
    expect(pesadas, `miniaturas que no ahorran nada:\n${pesadas.join("\n")}`).toEqual([]);
  });
});

describe("rutaMiniatura no inventa rutas que no existen", () => {
  it("siempre pide la pequeña de /media/ (el worker sirve la grande si falta)", () => {
    expect(rutaMiniatura("/media/notas/una-nota.jpg")).toBe("/media/notas/una-nota-sm.jpg");
    // Una local que NO tiene miniatura se devuelve entera: pedir un -sm inexistente da 404 y deja
    // la tarjeta rota, que fue exactamente el fallo.
    expect(rutaMiniatura("/img/notas/inventada/foto.jpg")).toBe("/img/notas/inventada/foto.jpg");
    expect(rutaMiniatura("https://ejemplo.com/foto.jpg")).toBe("https://ejemplo.com/foto.jpg");
  });

  it("una imagen local SÍ usa su pequeña cuando está en la lista generada", () => {
    const conMiniatura = [...CON_MINIATURA][0];
    expect(conMiniatura, "la lista no puede estar vacía").toBeDefined();
    expect(rutaMiniatura(conMiniatura!)).toMatch(/-sm\.[a-z]+$/i);
    // Y una que no está en la lista se sirve entera, nunca rota.
    expect(rutaMiniatura("/img/notas/no-existe/foto.jpg")).toBe("/img/notas/no-existe/foto.jpg");
  });

  it("LA LISTA NO MIENTE: cada imagen que declara tiene su archivo en disco", () => {
    // La genera el mismo script que crea las miniaturas, pero si alguien la edita a mano o borra un
    // archivo, la portada vuelve a romperse. Esto lo caza antes del push.
    for (const ruta of CON_MINIATURA) {
      const pequena = ruta.replace(/\.(jpg|jpeg|png|webp)$/i, "-sm.$1");
      expect(existsSync(`public${pequena}`), `la lista declara ${pequena} y no existe`).toBe(true);
    }
  });
});
