import Link from "next/link";
import { Container } from "@/components/Container";
import type { Lang } from "@/i18n/config";
import { getDict } from "@/i18n";
import { homePath, searchPath } from "@/lib/urls";

/** El contenido de la página 404, igual en `not-found.tsx` y en `/[lang]/error-404` (candado 59). */
export function PaginaNoEncontrada({ lang }: { lang: Lang }) {
  const dict = getDict(lang);
  return (
    <Container>
      <section className="mx-auto max-w-xl py-16 text-center" data-pagina="404">
        <p className="font-display text-7xl font-extrabold text-accent">404</p>
        <h1 className="mt-4 font-display text-3xl font-bold text-ink">{dict.notFound.title}</h1>
        <p className="mt-3 text-muted">{dict.notFound.body}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={homePath(lang)}
            className="inline-flex min-h-11 items-center rounded-full bg-ink px-6 py-3 text-sm font-bold text-white hover:bg-ink-2"
          >
            {dict.notFound.back}
          </Link>
          <Link
            href={searchPath(lang)}
            className="inline-flex min-h-11 items-center rounded-full border border-line px-6 py-3 text-sm font-bold text-ink hover:bg-paper"
          >
            {dict.nav.search}
          </Link>
        </div>
      </section>
    </Container>
  );
}
