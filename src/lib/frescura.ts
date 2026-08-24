/**
 * Separar lo reciente del archivo.
 *
 * En la portada convivían notas de hoy con archivo de diciembre del año anterior. Para el lector es
 * confuso; para el robot de Google Noticias, un diario que parece parado. Lo reciente manda arriba y
 * lo viejo baja a su propia franja, dicha con todas las letras.
 *
 * Vive aquí, y no dentro de la página, por dos motivos: se puede probar con una fecha fija, y así el
 * componente no llama a `Date.now()` durante el render (React exige que el render sea puro, y con
 * razón: el mismo render dos veces no puede dar dos resultados distintos).
 */

/** A partir de cuántos días una nota deja de ser actualidad y pasa a ser archivo. */
export const DIAS_ACTUALIDAD = 30;

export function esReciente(
  publishedAt: string | null | undefined,
  ahoraMs: number,
  dias = DIAS_ACTUALIDAD,
): boolean {
  if (!publishedAt) return true; // sin fecha, no se castiga: se trata como reciente
  const t = Date.parse(publishedAt);
  if (!Number.isFinite(t)) return true;
  return t >= ahoraMs - dias * 86_400_000;
}

/** Parte una lista en [lo reciente, el archivo], conservando el orden original de cada grupo. */
export function separarPorFrescura<T extends { publishedAt?: string | null }>(
  items: readonly T[],
  ahoraMs: number = Date.now(),
  dias = DIAS_ACTUALIDAD,
): { recientes: T[]; archivo: T[] } {
  const recientes: T[] = [];
  const archivo: T[] = [];
  for (const it of items) {
    (esReciente(it.publishedAt, ahoraMs, dias) ? recientes : archivo).push(it);
  }
  // Si NO hay nada reciente, no se separa. La franja «Del archivo» existe para contrastar con la
  // actualidad; sin actualidad con la que contrastar, lo único que consigue es dejar la portada
  // vacía arriba, que es peor que el problema que vino a resolver.
  if (recientes.length === 0) return { recientes: [...items], archivo: [] };
  return { recientes, archivo };
}
