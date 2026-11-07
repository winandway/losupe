import type { Dict, Lang } from "@/i18n";
import { formatDate } from "@/lib/dates";
import { PRODUCTOS } from "@/lib/casa/productos";

/**
 * Las fichas de los productos de Windoce, al pie de la sección «Desde Windoce». Transparencia: el
 * lector ve de quién son los productos de los que se habla y qué se comprobó de cada uno (con la
 * fecha). Los enlaces llevan `rel="sponsored"`: son de la casa (candado 57).
 */
export function FichasCasa({ lang, dict }: { lang: Lang; dict: Dict }) {
  return (
    <section
      className="mt-14"
      aria-label={dict.section.houseProductsTitle}
      data-testid="fichas-casa"
    >
      <h2 className="font-display text-2xl font-bold text-ink">
        {dict.section.houseProductsTitle}
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">{dict.section.houseProductsHint}</p>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {PRODUCTOS.map((p) => (
          <article key={p.id} className="flex flex-col rounded-2xl border border-line bg-white p-5">
            <img
              src={p.imagen}
              alt={p.nombre}
              loading="lazy"
              decoding="async"
              className="aspect-video w-full rounded-xl object-cover"
            />
            <h3 className="mt-4 font-display text-xl font-bold text-ink">{p.nombre}</h3>
            <p className="mt-1 text-sm text-ink">{p.queEs[lang]}</p>
            <p className="mt-2 text-sm text-muted">{p.paraQuien[lang]}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink">
              {p.datos[lang].slice(0, 3).map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <p className="mt-auto pt-4 text-xs text-muted">
              {dict.section.houseChecked(formatDate(p.verificado + "T12:00:00.000Z", lang))}
            </p>
            <a
              href={p.url}
              target="_blank"
              rel="sponsored noopener"
              className="mt-2 text-sm font-bold text-ink underline hover:text-coral"
            >
              {dict.section.houseVisit} →
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
