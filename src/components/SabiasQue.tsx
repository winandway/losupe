/**
 * «¿SABÍAS QUÉ?»: uno o dos datos curiosos de la nota, de los que se quedan en la cabeza.
 *
 * No se muestra si la nota no tiene ninguno de verdad: el generador descarta los datos con cifras
 * que no estén en el texto de la nota, y es mejor no poner el bloque que rellenarlo.
 */
export function SabiasQue({ datos, titulo }: { datos: readonly string[]; titulo: string }) {
  if (datos.length === 0) return null;
  return (
    <aside
      className="mt-10 rounded-2xl border-l-4 border-accent bg-accent/10 p-5"
      aria-labelledby="sabias-que"
    >
      <h2
        id="sabias-que"
        className="flex items-center gap-2 font-display text-xl font-bold text-ink"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-6 w-6 fill-none stroke-current"
          strokeWidth="2"
        >
          <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2V18h6v-1.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 2Z" />
        </svg>
        {titulo}
      </h2>
      <ul className="mt-3 space-y-3">
        {datos.map((d) => (
          <li key={d} className="text-[1.02rem] leading-relaxed text-ink">
            {d}
          </li>
        ))}
      </ul>
    </aside>
  );
}
