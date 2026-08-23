import Link from "next/link";
import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import type { ArticleCard as ArticleCardData } from "@/lib/queries";
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
  const image = article.imageUrl ? (
    <img
      src={article.imageUrl}
      alt={article.imageAlt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className="h-full w-full object-cover"
    />
  ) : (
    <div
      aria-hidden="true"
      className="flex h-full w-full items-center justify-center bg-ink font-display text-4xl font-extrabold text-accent"
    >
      l.
    </div>
  );

  if (variant === "hero") {
    return (
      <article className="grid gap-5 md:grid-cols-5 md:items-center">
        <Link
          href={href}
          className="block aspect-video overflow-hidden rounded-2xl bg-paper md:col-span-3"
        >
          {image}
        </Link>
        <div className="md:col-span-2">
          <SectionBadge sectionId={article.sectionId} lang={lang} size="md" />
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight text-ink md:text-4xl">
            <Link href={href} className="hover:underline decoration-accent decoration-4">
              {article.title}
            </Link>
          </h2>
          {article.excerpt ? (
            <p className="mt-3 line-clamp-3 text-base text-muted">{article.excerpt}</p>
          ) : null}
          <div className="mt-4">
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
    <article className="flex flex-col">
      <Link href={href} className="block aspect-video overflow-hidden rounded-xl bg-paper">
        {image}
      </Link>
      <div className="mt-3">
        <SectionBadge sectionId={article.sectionId} lang={lang} />
      </div>
      <h3 className="mt-2 font-display text-xl font-bold leading-snug text-ink">
        <Link href={href} className="hover:underline">
          {article.title}
        </Link>
      </h3>
      {article.excerpt ? (
        <p className="mt-2 line-clamp-2 text-sm text-muted">{article.excerpt}</p>
      ) : null}
      <div className="mt-3">
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
    </article>
  );
}
