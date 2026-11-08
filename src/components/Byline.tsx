import Link from "next/link";
import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import { formatDate } from "@/lib/dates";
import { authorPath } from "@/lib/urls";

export function Byline({
  lang,
  dict,
  authorId,
  authorName,
  publishedAt,
  readingMinutes,
  compact = false,
}: {
  lang: Lang;
  dict: Dict;
  authorId: string;
  authorName: string;
  publishedAt: string;
  readingMinutes?: number | null;
  compact?: boolean;
}) {
  return (
    <p
      className={`flex flex-wrap items-center gap-x-2 text-muted ${compact ? "text-xs" : "text-sm"}`}
    >
      {!compact && <span>{dict.article.by}</span>}
      <Link
        href={authorPath(lang, authorId)}
        // Tamaño táctil: el nombre del autor es un enlace y en celular se tocaba con el dedo a ciegas.
        className={`inline-flex items-center font-semibold text-ink hover:underline ${
          compact ? "min-h-8" : "min-h-11"
        }`}
      >
        {authorName}
      </Link>
      <span aria-hidden="true">·</span>
      <time dateTime={publishedAt}>{formatDate(publishedAt, lang)}</time>
      {readingMinutes ? (
        // En las filas compactas de celular el tiempo de lectura sobra; en escritorio se muestra.
        <span className={compact ? "hidden sm:contents" : "contents"}>
          <span aria-hidden="true">·</span>
          <span>{dict.article.minutes(readingMinutes)}</span>
        </span>
      ) : null}
    </p>
  );
}
