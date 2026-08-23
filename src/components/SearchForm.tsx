import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import { searchPath } from "@/lib/urls";

export function SearchForm({
  lang,
  dict,
  defaultValue = "",
  autoFocus = false,
  size = "md",
  placeholder,
}: {
  lang: Lang;
  dict: Dict;
  defaultValue?: string;
  autoFocus?: boolean;
  size?: "md" | "lg";
  placeholder?: string;
}) {
  const large = size === "lg";
  return (
    <form action={searchPath(lang)} method="get" role="search" className="flex gap-2">
      <label htmlFor={large ? "q-hero" : "q"} className="sr-only">
        {dict.search.label}
      </label>
      <input
        id={large ? "q-hero" : "q"}
        name="q"
        type="search"
        required
        minLength={2}
        maxLength={80}
        defaultValue={defaultValue}
        placeholder={placeholder ?? dict.search.placeholder}
        autoFocus={autoFocus}
        className={
          large
            ? "h-12 w-full min-w-0 rounded-full border-0 bg-white px-5 text-base text-ink shadow-lg outline-none ring-accent focus:ring-4 md:h-14 md:text-lg"
            : "w-full min-w-0 rounded-full border border-line bg-white px-4 py-2.5 text-base outline-none focus:border-ink focus:ring-2 focus:ring-accent"
        }
      />
      <button
        type="submit"
        aria-label={dict.search.button}
        className={
          large
            ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-ink shadow-lg hover:brightness-95 md:h-14 md:w-auto md:px-8"
            : "shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-ink-2"
        }
      >
        {large ? (
          <>
            <svg
              aria-hidden="true"
              className="md:hidden"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <span className="hidden text-base font-extrabold uppercase tracking-wide md:inline">
              {dict.search.button}
            </span>
          </>
        ) : (
          dict.search.button
        )}
      </button>
    </form>
  );
}
