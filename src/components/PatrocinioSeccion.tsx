import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import type { PatrocinioSeccion as Datos } from "@/lib/patrocinio";

/**
 * La franja del patrocinador de una sección.
 *
 * Se ve **claramente como publicidad**, y eso no es un detalle de estilo: un patrocinio disimulado es
 * lo que hace que Google Noticias eche a un medio y que un lector deje de creerte. Por eso lleva su
 * etiqueta delante, un fondo distinto del contenido y el enlace marcado como publicitario
 * (`rel="sponsored"`), que es lo que Google espera encontrar.
 */
export function PatrocinioSeccion({ datos, lang, dict }: { datos: Datos; lang: Lang; dict: Dict }) {
  return (
    <aside
      aria-label={dict.sponsorship.label}
      className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-paper px-5 py-4"
    >
      <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
        {dict.sponsorship.label}
      </span>
      {datos.logoUrl ? (
        <img
          src={datos.logoUrl}
          alt={datos.nombre}
          height={28}
          loading="lazy"
          className="h-7 w-auto"
        />
      ) : null}
      <span className="min-w-0 text-sm text-muted">
        <a
          href={datos.website}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="font-bold text-ink hover:underline"
        >
          {datos.nombre}
        </a>
        {datos.claim ? <span className="ml-2">{datos.claim}</span> : null}
      </span>
      <span className="ml-auto text-xs text-muted">{dict.sponsorship.note}</span>
      <span className="sr-only">{lang}</span>
    </aside>
  );
}
