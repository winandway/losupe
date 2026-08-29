import type { MensajeSocial } from "./tipos";

/**
 * EL TEXTO DEL POST.
 *
 * Un post no es el titular pegado con el enlace. Lo que hace que alguien pare el dedo es el gancho:
 * una frase corta que abre una pregunta. Por eso se arma en tres piezas —titular, gancho, enlace— y
 * se recorta por la de en medio, nunca por el titular ni por el enlace.
 */

export type NotaParaRedes = {
  titulo: string;
  resumen: string;
  url: string;
  seccion?: string;
  lang?: "es" | "en";
};

/**
 * Cuenta caracteres como los cuenta una red social: por símbolos visibles, no por bytes. Un emoji
 * es UNO, aunque por dentro ocupe cuatro. Contarlo mal es lo que hace que un post de 299 se rechace
 * por pasarse de 300.
 */
export function largo(texto: string): number {
  return Array.from(texto).length;
}

/** Recorta por palabras y cierra con puntos suspensivos. Nunca parte una palabra por la mitad. */
export function recortar(texto: string, maximo: number): string {
  const limpio = texto.trim();
  if (largo(limpio) <= maximo) return limpio;
  if (maximo <= 1) return "…";
  const trozo = Array.from(limpio)
    .slice(0, maximo - 1)
    .join("");
  const corte = trozo.lastIndexOf(" ");
  return `${(corte > maximo * 0.5 ? trozo.slice(0, corte) : trozo).replace(/[\s,;:.]+$/, "")}…`;
}

/** Etiquetas por sección. Pocas y en minúscula: tres bien puestas rinden más que diez de relleno. */
const ETIQUETAS: Record<string, readonly string[]> = {
  economia: ["#economía", "#dinero"],
  tecnologia: ["#tecnología", "#IA"],
  cripto: ["#cripto", "#bitcoin"],
  cultura: ["#cultura"],
  negocios: ["#negocios"],
};

const ETIQUETAS_EN: Record<string, readonly string[]> = {
  economia: ["#economy", "#money"],
  tecnologia: ["#tech", "#AI"],
  cripto: ["#crypto", "#bitcoin"],
  cultura: ["#culture"],
  negocios: ["#business"],
};

export function etiquetasDe(seccion: string | undefined, lang: "es" | "en" = "es"): string[] {
  if (!seccion) return [];
  const tabla = lang === "en" ? ETIQUETAS_EN : ETIQUETAS;
  return [...(tabla[seccion] ?? [])];
}

/**
 * Arma el mensaje para una red con un límite de caracteres dado.
 *
 * El orden de sacrificio cuando no cabe todo es siempre el mismo, y es el que protege lo que
 * importa: primero se van las etiquetas, después se acorta el gancho, y **el titular y el enlace no
 * se tocan jamás**. Un post sin enlace es un post inútil.
 */
export function armarMensaje(nota: NotaParaRedes, limite: number): MensajeSocial {
  const lang = nota.lang ?? "es";
  const titulo = nota.titulo.trim();
  const url = nota.url.trim();
  const etiquetas = etiquetasDe(nota.seccion, lang);

  // Las redes cuentan el enlace entero salvo que digan lo contrario, así que se cuenta entero.
  const fijo = largo(titulo) + largo(url) + 2; // dos saltos de línea
  const conEtiquetas = fijo + 1 + largo(etiquetas.join(" "));

  const piezas: string[] = [titulo];
  const sitioParaGancho = limite - conEtiquetas - 1;
  const gancho = nota.resumen.trim();
  if (gancho && sitioParaGancho >= 40) {
    piezas.push(recortar(gancho, sitioParaGancho));
  }
  piezas.push(url);
  if (etiquetas.length > 0 && conEtiquetas <= limite) piezas.push(etiquetas.join(" "));

  let texto = piezas.join("\n\n");
  // Cinturón: si aun así se pasó (un titular larguísimo), se recorta el titular y se rehace, pero el
  // enlace se queda. Mejor un titular con puntos suspensivos que un post rechazado.
  if (largo(texto) > limite) {
    const espacio = limite - largo(url) - 2;
    texto = `${recortar(titulo, Math.max(10, espacio))}\n\n${url}`;
  }

  return { texto, url, titulo, resumen: recortar(gancho, 280) };
}
