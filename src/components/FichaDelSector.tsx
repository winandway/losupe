import type { Dict, Lang } from "@/i18n";
import { formatDate } from "@/lib/dates";
import { getProducto } from "@/lib/casa/productos";
import { PRODUCTO_DE_LA_CASA_POR_SECCION } from "@/lib/robot/writer";
import type { SectionId } from "@/lib/sections";

/**
 * NUESTRA APP, AL PIE DE SU SECCIÓN (candado 61).
 *
 * En «Delivery y logística» escribimos del sector en el que compite Divoox, que es de Windoce, la
 * dueña de Losupe. Esconderlo sería lo peor de los dos mundos: el lector lo averigua igual y
 * perdemos la nota y la confianza. Contarlo arriba, con su ficha y lo que se comprobó de ella, es lo
 * que hacen los medios serios con los productos de su grupo — y de paso es donde la gente la conoce.
 *
 * El enlace va con `rel="sponsored"`: es de la casa, y Google tiene que saberlo.
 */
export function FichaDelSector({
  sectionId,
  lang,
  dict,
}: {
  sectionId: SectionId;
  lang: Lang;
  dict: Dict;
}) {
  const id = PRODUCTO_DE_LA_CASA_POR_SECCION[sectionId];
  const p = id ? getProducto(id) : undefined;
  if (!p) return null;
  return (
    <section className="mt-14" aria-label={dict.section.sectorOwnTitle} data-ficha-sector={p.id}>
      <h2 className="font-display text-2xl font-bold text-ink">{dict.section.sectorOwnTitle}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted">{dict.section.sectorOwnHint}</p>
      <article className="mt-6 grid gap-5 rounded-2xl border border-line bg-white p-5 sm:grid-cols-[minmax(0,18rem)_1fr]">
        <img
          src={p.imagen}
          alt={p.nombre}
          loading="lazy"
          decoding="async"
          className="aspect-video w-full rounded-xl object-cover"
        />
        <div className="flex flex-col">
          <h3 className="font-display text-xl font-bold text-ink">{p.nombre}</h3>
          <p className="mt-1 text-sm text-ink">{p.queEs[lang]}</p>
          <p className="mt-2 text-sm text-muted">{p.paraQuien[lang]}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink">
            {p.datos[lang].slice(0, 4).map((d) => (
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
        </div>
      </article>
    </section>
  );
}
