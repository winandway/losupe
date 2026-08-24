/**
 * UNA sola forma de escribir la hora en la base. Suena a detalle y no lo es.
 *
 * Historia (24 ago 2026): el freno de los patrocinadores («una nota cada 3 días») no saltaba en
 * producción aunque el código era correcto. La causa: `datetime('now')` de SQLite guarda
 * `2026-08-24 05:12:00` (con espacio) y JavaScript compara contra `2026-08-24T02:00:00.000Z`
 * (con T y con Z). SQLite compara esas fechas como TEXTO, y el espacio vale menos que la «T»:
 *
 *   '2026-08-24 05:12:00'  <  '2026-08-24T02:00:00.000Z'   ← ¡una nota de hace 4 horas parecía vieja!
 *
 * Así que el filtro no descartaba a nadie y el patrocinador podía sacar dos notas seguidas. El fallo
 * no daba error, no salía en los registros: simplemente dejaba de proteger. Por eso ahora TODA fecha
 * que escriba la base va en el mismo formato ISO que usa el código.
 *
 * Regla: dentro de una consulta se usa `SQL_NOW`, nunca `datetime('now')`. Hay una prueba que
 * revisa el código fuente y se pone roja si alguien vuelve a colar el `datetime('now')`.
 */

/** `now()` en el MISMO formato que `new Date().toISOString()`. Se pega dentro del SQL. */
export const SQL_NOW = `strftime('%Y-%m-%dT%H:%M:%fZ','now')`;

/**
 * Comparación de fechas a prueba de formatos. `julianday()` entiende tanto
 * `2026-08-24 05:12:00` como `2026-08-24T05:12:00.000Z`, así que una fila vieja escrita con el
 * formato antiguo se sigue comparando bien.
 *
 * Se usa en los frenos que protegen dinero o reputación (ritmo de patrocinadores), donde fallar en
 * silencio es lo peor que puede pasar.
 */
export function laterThan(col: string, param: string): string {
  return `${col} IS NOT NULL AND julianday(${col}) > julianday(${param})`;
}

/**
 * Lee una fecha que salió de la base, venga en el formato que venga. Una fila vieja puede traer
 * `2026-08-24 05:12:00`, y `Date.parse` interpreta esa forma (sin zona) como hora LOCAL, no UTC:
 * en una máquina que no esté en UTC, la cuenta se corre varias horas.
 */
export function parseSqlDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  let texto = value.trim();
  if (texto.length >= 11 && texto[10] === " ") texto = `${texto.slice(0, 10)}T${texto.slice(11)}`;
  if (!/[Zz]$/.test(texto) && !/[+-]\d\d:?\d\d$/.test(texto)) texto = `${texto}Z`;
  const ms = Date.parse(texto);
  return Number.isFinite(ms) ? new Date(ms) : null;
}
