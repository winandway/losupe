import { describe, expect, it } from "vitest";
import {
  ALTO,
  ANCHO,
  anchoAprox,
  componerTitular,
  escaparXml,
  miniaturaSvg,
  portadaSvg,
  rutaPortada,
  simboloPara,
} from "@/lib/portadas";

/** El caso que lo motivó: Richard vio un cuadro azul con una «l.» donde debía ir la miniatura. */
const CIERRES =
  "20.682 quejas en seis meses: la ola de cierres de cuentas bancarias que golpea a los inmigrantes en Estados Unidos";

describe("el símbolo cuenta la nota, no rellena", () => {
  it("una nota de cuentas cerradas saca la tarjeta tachada, no la moneda genérica", () => {
    // Richard lo pidió con estas palabras: «un banco con una X grande roja o el símbolo de
    // prohibido». Si esto devolviera «moneda» —el símbolo por defecto de economía— la portada no
    // diría nada de la nota.
    expect(simboloPara(CIERRES, "economia")).toBe("cuenta-cerrada");
  });

  it("lo específico gana a lo genérico de la sección", () => {
    const casos: [string, string][] = [
      ["Terremoto en Filipinas: 340 muertos y 18 países mandaron ayuda", "alerta"],
      ["Los inmigrantes latinos que sostienen el empleo en Texas", "gente"],
      ["El bitcoin se desploma un 12 % en una semana", "caida"],
      ["La Fed multa a un banco por cobrar de más", "ley"],
      ["Cuidado con esta estafa que circula por WhatsApp", "alerta"],
      ["10 curiosidades sobre el café que casi nadie conoce", "lista"],
      ["Diez años sin Juan Gabriel: lo que dejó su música", "tiempo"],
      ["Claude y ChatGPT: en qué se diferencian de verdad", "chip"],
    ];
    for (const [titulo, esperado] of casos) {
      expect(simboloPara(titulo, "economia"), titulo).toBe(esperado);
    }
  });

  it("sin pistas cae en el de su sección, nunca en nada", () => {
    expect(simboloPara("Una nota cualquiera", "artistas")).toBe("musica");
    expect(simboloPara("Una nota cualquiera", "tecnologia")).toBe("chip");
    expect(simboloPara("", "ventas")).toBe("tienda");
  });
});

describe("EL TITULAR NO SE SALE DE LA IMAGEN", () => {
  /**
   * El primer intento contaba LETRAS y el titular se salía por la derecha: se perdía media frase.
   * «mmm» ocupa el triple que «lil», así que hay que medir el ancho de verdad.
   */
  it("mide el ancho real, no el número de letras", () => {
    expect(anchoAprox("mmmm", 50)).toBeGreaterThan(anchoAprox("llll", 50) * 2);
    expect(anchoAprox("", 50)).toBe(0);
  });

  it("todas las líneas caben en el ancho dado", () => {
    const ancho = 600;
    for (const titulo of [
      CIERRES,
      "Bitcoin",
      "Los 10 errores más grandes que cometen los vendedores por internet cuando empiezan a vender",
      "Terremoto en Filipinas: ya son 340 los muertos y 18 países mandaron ayuda a la zona afectada",
    ]) {
      const { lineas, tamano } = componerTitular(titulo, ancho);
      expect(lineas.length, titulo).toBeGreaterThan(0);
      expect(lineas.length, titulo).toBeLessThanOrEqual(4);
      for (const l of lineas) {
        expect(anchoAprox(l, tamano), `«${l}» se sale`).toBeLessThanOrEqual(ancho);
      }
    }
  });

  it("baja la letra antes que recortar: un titular pequeño es mejor que uno cortado", () => {
    const corto = componerTitular("Bitcoin sube", 600);
    const largo = componerTitular(CIERRES, 600);
    expect(corto.tamano).toBeGreaterThan(largo.tamano);
    // El titular largo entra ENTERO, no cortado con puntos suspensivos.
    expect(largo.lineas.join(" ")).toBe(CIERRES);
  });

  it("y si ni al tamaño mínimo cabe, recorta pero no revienta", () => {
    const { lineas } = componerTitular("palabra ".repeat(80).trim(), 400);
    expect(lineas.length).toBeLessThanOrEqual(4);
    expect(lineas[lineas.length - 1]?.endsWith("…")).toBe(true);
  });
});

describe("el SVG que sale", () => {
  it("es una imagen social válida, con su medida y su texto accesible", () => {
    const svg = portadaSvg({ titulo: CIERRES, sectionId: "economia" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain(`width="${ANCHO}"`);
    expect(svg).toContain(`height="${ALTO}"`);
    expect(svg).toContain('role="img"');
    expect(svg).toContain(CIERRES.slice(0, 20));
    expect(svg).toContain("losupe");
    // Y las etiquetas abren y cierran igual: un SVG mal formado se ve en blanco.
    expect((svg.match(/<svg/g) ?? []).length).toBe(1);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
  });

  it("UN TITULAR CON & O < NO DEJA LA IMAGEN EN BLANCO", () => {
    // Un solo carácter sin escapar rompe el XML entero y el navegador no pinta nada.
    const svg = portadaSvg({ titulo: 'Ventas & "ofertas" <del> mes', sectionId: "ventas" });
    expect(svg).toContain("&amp;");
    expect(svg).not.toMatch(/<del>/);
    expect(escaparXml('a & b < c > d "e"')).toBe("a &amp; b &lt; c &gt; d &quot;e&quot;");
  });

  it("la MINIATURA no lleva texto: al lado ya está el titular escrito", () => {
    // Se vio en pantalla: a 140 píxeles el titular de dentro no se lee y ensucia la tarjeta.
    const mini = miniaturaSvg({ titulo: CIERRES, sectionId: "economia" });
    // Ni una etiqueta de texto DIBUJADA. El titular sí está en el `aria-label`, y ahí tiene que
    // seguir: es lo que lee alguien con lector de pantalla.
    expect(mini).not.toContain("<text");
    expect(mini).toContain(`aria-label="${CIERRES}"`);
    // Pero sí lleva el símbolo, que es lo que se reconoce de un vistazo.
    expect(mini).toContain("<rect");
    expect(mini).toContain("stroke");
  });

  it("cada sección pinta con su color", () => {
    expect(portadaSvg({ titulo: "x", sectionId: "cripto" })).toContain("#FB923C");
    expect(portadaSvg({ titulo: "x", sectionId: "artistas" })).toContain("#FF5A5F");
  });

  it("las rutas distinguen la grande de la de tarjeta", () => {
    expect(rutaPortada("art-1")).toBe("/media/portada/art-1.svg");
    expect(rutaPortada("art-1", true)).toBe("/media/portada/art-1-mini.svg");
  });
});

describe("al compartir por WhatsApp tiene que salir una imagen", () => {
  it("hay una tarjeta PNG por sección, porque WhatsApp no pinta SVG", async () => {
    const { existsSync } = await import("node:fs");
    const { SECTION_IDS } = await import("@/lib/sections");
    for (const id of SECTION_IDS) {
      expect(existsSync(`public/og/${id}.png`), `falta public/og/${id}.png`).toBe(true);
    }
  });
});
