import Link from "next/link";
import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import type { ArticleCard as ArticleCardData } from "@/lib/queries";
import { rutaPortada } from "@/lib/portadas";
import { rutaMiniatura } from "@/lib/robot/images";
import { articlePath } from "@/lib/urls";
import { Byline } from "./Byline";
import { SectionBadge } from "./SectionBadge";

type Variant = "hero" | "card" | "row";

export function ArticleCard({
  article,
  lang,
  dict,
  variant = "card",
  priority = false,
}: {
  article: ArticleCardData;
  lang: Lang;
  dict: Dict;
  variant?: Variant;
  priority?: boolean;
}) {
  const href = articlePath(lang, article.sectionId, article.slug);
  // Cada pantalla pide el tamaño que de verdad necesita. Antes la portada se descargaba una foto de
  // 1880 px y 427 KB para pintarla a 142 px de ancho, trece veces más grande de lo necesario y en
  // cada tarjeta (medido el 29 ago 2026). La versión pequeña la guarda el robot al ilustrar.
  const image = article.imageUrl ? (
    <img
      src={variant === "hero" ? article.imageUrl : rutaMiniatura(article.imageUrl)}
      srcSet={
        variant === "hero"
          ? `${rutaMiniatura(article.imageUrl)} 640w, ${article.imageUrl} 1600w`
          : undefined
      }
      sizes={variant === "hero" ? "(max-width: 768px) 100vw, 800px" : undefined}
      alt={article.imageAlt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className="h-full w-full object-cover"
    />
  ) : (
    // Sin foto, una portada dibujada por nosotros con el símbolo del tema. Antes había aquí un
    // cuadro azul con la «l.» del logotipo —que además se lee como un uno— y era exactamente lo que
    // hace que nadie entre a la nota. La miniatura es lo que decide si alguien lee o pasa de largo.
    <img
      // El hero es grande y la imagen se ve entera: ahí cabe la portada con su titular. En las
      // tarjetas pequeñas va solo el símbolo, porque el titular ya está escrito al lado.
      src={rutaPortada(article.id, variant !== "hero")}
      alt={article.imageAlt || article.title}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className="h-full w-full object-cover"
    />
  );

  if (variant === "hero") {
    return (
      <article className="grid gap-4 md:grid-cols-5 md:items-center md:gap-5">
        <Link
          href={href}
          className="relative block aspect-video overflow-hidden rounded-2xl bg-paper md:col-span-3"
        >
          {image}
          {/* La etiqueta va SOBRE la foto: así se lee como foto de una nota, no como la página misma. */}
          <span className="pointer-events-none absolute left-3 top-3">
            <SectionBadge sectionId={article.sectionId} lang={lang} size="md" asLink={false} />
          </span>
        </Link>
        <div className="md:col-span-2">
          <div className="hidden md:block">
            <SectionBadge sectionId={article.sectionId} lang={lang} size="md" />
          </div>
          <h2 className="font-display text-[1.6rem] font-bold leading-[1.15] text-ink md:mt-3 md:text-4xl md:leading-tight">
            <Link href={href} className="hover:underline decoration-accent decoration-4">
              {article.title}
            </Link>
          </h2>
          {article.excerpt ? (
            <p className="mt-2 line-clamp-2 text-[15px] text-muted md:mt-3 md:line-clamp-3 md:text-base">
              {article.excerpt}
            </p>
          ) : null}
          <div className="mt-3 md:mt-4">
            <Byline
              lang={lang}
              dict={dict}
              authorId={article.authorId}
              authorName={article.authorName}
              publishedAt={article.publishedAt}
              readingMinutes={article.readingMinutes}
            />
          </div>
        </div>
      </article>
    );
  }

  if (variant === "row") {
    return (
      <article className="flex gap-4">
        <Link
          href={href}
          className="block h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-paper"
          aria-hidden="true"
          tabIndex={-1}
        >
          {image}
        </Link>
        <div className="min-w-0">
          <SectionBadge sectionId={article.sectionId} lang={lang} />
          <h3 className="mt-1 line-clamp-2 font-display text-lg font-bold leading-snug text-ink">
            <Link href={href} className="hover:underline">
              {article.title}
            </Link>
          </h3>
          <div className="mt-1">
            <Byline
              lang={lang}
              dict={dict}
              authorId={article.authorId}
              authorName={article.authorName}
              publishedAt={article.publishedAt}
              compact
            />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="flex flex-row-reverse items-start gap-4 sm:flex-col sm:gap-0">
      <Link
        href={href}
        className="block h-[4.75rem] w-[6.75rem] shrink-0 overflow-hidden rounded-lg bg-paper sm:aspect-video sm:h-auto sm:w-full sm:rounded-xl"
        aria-hidden="true"
        tabIndex={-1}
      >
        {image}
      </Link>
      <div className="min-w-0 flex-1">
        <div className="sm:mt-3">
          <SectionBadge sectionId={article.sectionId} lang={lang} />
        </div>
        <h3 className="mt-1.5 line-clamp-3 font-display text-[1.05rem] font-bold leading-snug text-ink sm:mt-2 sm:line-clamp-none sm:text-xl">
          <Link href={href} className="hover:underline">
            {article.title}
          </Link>
        </h3>
        {article.excerpt ? (
          <p className="mt-2 hidden line-clamp-2 text-sm text-muted sm:block">{article.excerpt}</p>
        ) : null}
        <div className="mt-1.5 sm:mt-3">
          <Byline
            lang={lang}
            dict={dict}
            authorId={article.authorId}
            authorName={article.authorName}
            publishedAt={article.publishedAt}
            readingMinutes={article.readingMinutes}
            compact
          />
        </div>
      </div>
    </article>
  );
}
