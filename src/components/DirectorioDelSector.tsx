import type { Dict, Lang } from "@/i18n";
import { formatDate } from "@/lib/dates";
import { DIRECTORIO } from "@/lib/sector/directorio";
import type { SectionId } from "@/lib/sections";

/**
 * EL DIRECTORIO DEL SECTOR, AL PIE DE SU SECCIÓN (candado 63).
 *
 * Aquí había UNA ficha, la de Divoox, bajo el título «Nuestra propia app de reparto». Richard lo vio
 * y tenía razón: una pieza fija que solo habla de nuestro producto, repetida en toda la sección, le
 * está diciendo a Google que la sección existe para promocionarlo. Sus políticas lo llaman contenido
 * hecho para el buscador y no para el lector, y se sanciona. Nos delatábamos solos.
 *
 * Ahora es el directorio del sector: las mismas cuatro casillas para todas, ordenadas de la más
 * grande a la más nueva —criterio neutro y escrito en la página—, y la nuestra es una fila más, la
 * última, con su línea de transparencia dentro de SU ficha y no como titular de la sección.
 *
 * Reglas completas: `docs/SEO-IMPARCIALIDAD.md`. Datos y fuentes: `src/lib/sector/directorio.ts`.
 */
export function DirectorioDelSector({
  sectionId,
  lang,
  dict,
}: {
  sectionId: SectionId;
  lang: Lang;
  dict: Dict;
}) {
  // Por ahora solo el sector de delivery tiene directorio. Otra sección sin el suyo no enseña nada:
  // mejor vacío que media tabla.
  if (sectionId !== "delivery") return null;
  return (
    <section className="mt-14" aria-label={dict.section.sectorDirTitle} data-directorio-sector="">
      <h2 className="font-display text-2xl font-bold text-ink">{dict.section.sectorDirTitle}</h2>
      <p className="mt-2 max-w-3xl text-sm text-muted">{dict.section.sectorDirHint}</p>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {DIRECTORIO.map((e) => (
          <article
            key={e.id}
            data-empresa={e.id}
            className="flex flex-col rounded-2xl border border-line bg-white p-5"
          >
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="font-display text-xl font-bold text-ink">{e.nombre}</h3>
              {e.nuestra ? (
                <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
                  {dict.section.sectorDirOursTag}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-ink">{e.queEs[lang]}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="font-bold text-ink">{dict.section.sectorDirWhere}</dt>
                <dd className="text-muted">{e.donde[lang]}</dd>
              </div>
              <div>
                <dt className="font-bold text-ink">{dict.section.sectorDirMerchant}</dt>
                <dd className="text-muted">{e.restaurante[lang]}</dd>
              </div>
              <div>
                <dt className="font-bold text-ink">{dict.section.sectorDirCourier}</dt>
                <dd className="text-muted">{e.repartidor[lang]}</dd>
              </div>
            </dl>
            {e.nuestra ? (
              <p className="mt-3 rounded-xl bg-paper p-3 text-xs text-ink">
                {dict.section.sectorDirOurs(e.nombre)}
              </p>
            ) : null}
            <p className="mt-auto pt-4 text-xs text-muted">
              {dict.section.sectorDirSource(
                e.fuente[lang],
                formatDate(e.verificado + "T12:00:00.000Z", lang),
              )}
            </p>
            <a
              href={e.url}
              target="_blank"
              rel={e.nuestra ? "sponsored noopener" : "nofollow noopener"}
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
