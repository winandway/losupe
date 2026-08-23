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
    <p className={`flex flex-wrap items-center gap-x-2 text-muted ${compact ? "text-xs" : "text-sm"}`}>
      {!compact && <span>{dict.article.by}</span>}
      <Link href={authorPath(lang, authorId)} className="font-semibold text-ink hover:underline">
        {authorName}
      </Link>
      <span aria-hidden="true">·</span>
      <time dateTime={publishedAt}>{formatDate(publishedAt, lang)}</time>
      {readingMinutes ? (
        <>
          <span aria-hidden="true">·</span>
          <span>{dict.article.minutes(readingMinutes)}</span>
        </>
      ) : null}
    </p>
  );
}
