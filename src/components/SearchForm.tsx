import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import { searchPath } from "@/lib/urls";

export function SearchForm({
  lang,
  dict,
  defaultValue = "",
  autoFocus = false,
}: {
  lang: Lang;
  dict: Dict;
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  return (
    <form action={searchPath(lang)} method="get" role="search" className="flex gap-2">
      <label htmlFor="q" className="sr-only">
        {dict.search.label}
      </label>
      <input
        id="q"
        name="q"
        type="search"
        required
        minLength={2}
        maxLength={80}
        defaultValue={defaultValue}
        placeholder={dict.search.placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-full border border-line bg-white px-4 py-2.5 text-base outline-none focus:border-ink focus:ring-2 focus:ring-accent"
      />
      <button
        type="submit"
        className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-ink-2"
      >
        {dict.search.button}
      </button>
    </form>
  );
}
