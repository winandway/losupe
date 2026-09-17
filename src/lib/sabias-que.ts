/**
 * El filtro del «¿Sabías qué?»: qué datos se pueden mostrar y cuáles no.
 *
 * Vive aparte y sin dependencias porque se usa en DOS sitios: al guardar (el generador del robot) y
 * al MOSTRAR (la consulta de la nota). Así un dato guardado antes de que existiera una regla también
 * pasa por ella. Ver el candado 52 de `docs/candados.md`.
 */

/** Las cifras de un texto, normalizadas para comparar («5,85», «5.85» y «585» no son lo mismo). */
export function cifras(texto: string): string[] {
  return (texto.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/[.,]+$/, ""));
}

/**
 * Los «¿Sabías qué?» que se pueden publicar: como mucho dos, cortos, y **sin una sola cifra que no
 * esté en la nota**. El dato que traiga un número inventado se tira; los demás se quedan.
 */
export function filtrarSabiasQue(datos: readonly string[], cuerpoNota: string): string[] {
  const enLaNota = new Set(cifras(cuerpoNota));
  return datos
    .map((d) => d.replace(/\s+/g, " ").trim())
    .filter((d) => d.length >= 20 && d.length <= 320)
    .filter((d) => !CIFRA_EN_LETRAS.test(d))
    .filter((d) => cifras(d).every((c) => enLaNota.has(c)))
    .slice(0, 2);
}

/**
 * Cifras escritas EN LETRAS: años, cientos, miles, decenas. Un dato que las traiga se descarta.
 *
 * No porque las letras estén mal, sino porque **esquivan la comprobación**. Pasó el primer día en
 * producción (17 sep 2026): el «¿Sabías qué?» de Raúl Magaña decía «en dos mil diecisiete». Ese año sí
 * estaba en la nota, pero en letras nadie lo verificó — y un año inventado habría pasado igual. Las
 * instrucciones piden números en este bloque; esto es el candado por si el modelo no hace caso.
 */
const CIFRA_EN_LETRAS =
  /\b(mil|cien|ciento|doscient[oa]s|trescient[oa]s|cuatrocient[oa]s|quinient[oa]s|seiscient[oa]s|setecient[oa]s|ochocient[oa]s|novecient[oa]s|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|mill[oó]n|millones|bill[oó]n|thousand|hundred|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|million|billion)\b/i;
