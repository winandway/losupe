import Link from "next/link";
import type { Dict } from "@/i18n/es";

export function Pagination({
  basePath,
  page,
  pages,
  dict,
}: {
  basePath: string;
  page: number;
  pages: number;
  dict: Dict;
}) {
  if (pages <= 1) return null;
  const hrefFor = (p: number) => (p <= 1 ? basePath : `${basePath}?page=${p}`);
  const linkClass =
    "rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper";
  return (
    <nav aria-label={dict.pagination.label} className="mt-10 flex items-center justify-between">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={linkClass}>
          ← {dict.pagination.prev}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-sm text-muted">
        {dict.section.page(page)} / {pages}
      </span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} rel="next" className={linkClass}>
          {dict.pagination.next} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
