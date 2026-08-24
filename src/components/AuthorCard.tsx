import Link from "next/link";
import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import type { Author } from "@/lib/queries";
import { authorPath } from "@/lib/urls";

/**
 * Pie de la nota: quién la escribió, con su foto, su cargo y su biografía. Es la firma que Google
 * mira para confiar en el medio (E-E-A-T) y lo primero que busca un lector que quiere saber quién
 * le está contando la historia.
 */
export function AuthorCard({ author, lang, dict }: { author: Author; lang: Lang; dict: Dict }) {
  const url = authorPath(lang, author.id);
  return (
    <aside className="mt-12 rounded-2xl border border-line bg-paper p-5 md:p-6">
      <p className="text-[11px] font-bold uppercase tracking-widest text-muted">
        {dict.article.writtenBy}
      </p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <Link href={url} className="shrink-0" aria-label={author.name}>
          {author.avatarUrl ? (
            <img
              src={author.avatarUrl}
              alt={author.name}
              width={80}
              height={80}
              loading="lazy"
              decoding="async"
              className="h-20 w-20 rounded-full object-cover ring-2 ring-accent"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-20 w-20 items-center justify-center rounded-full bg-ink font-display text-2xl font-bold text-accent"
            >
              {author.name.charAt(0)}
            </span>
          )}
        </Link>
        <div className="min-w-0">
          <p className="font-display text-xl font-bold leading-tight text-ink">
            <Link href={url} className="hover:underline">
              {author.name}
            </Link>
          </p>
          {author.role ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {author.role}
            </p>
          ) : null}
          {author.bio ? (
            <p className="mt-2 text-sm leading-relaxed text-muted">{author.bio}</p>
          ) : null}
          <Link href={url} className="mt-3 inline-block text-sm font-bold text-ink hover:underline">
            {dict.article.moreFromAuthor} →
          </Link>
        </div>
      </div>
    </aside>
  );
}
