import Link from "next/link";
import { Suspense } from "react";
import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import { SECTIONS } from "@/lib/sections";
import { homePath, searchPath, sectionPath } from "@/lib/urls";
import { LangSwitcher } from "./LangSwitcher";
import { Logo } from "./Logo";

export function Header({
  lang,
  dict,
  activeSection,
}: {
  lang: Lang;
  dict: Dict;
  activeSection?: string;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-ink"
      >
        {dict.nav.skip}
      </a>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href={homePath(lang)} aria-label={`${dict.brand.name} — ${dict.nav.home}`}>
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={searchPath(lang)}
            aria-label={dict.nav.search}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink hover:bg-paper"
          >
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </Link>
          <Suspense fallback={null}>
            <LangSwitcher lang={lang} labels={dict.languages} groupLabel={dict.nav.language} />
          </Suspense>
        </div>
      </div>
      <nav aria-label={dict.nav.sections} className="border-t border-line">
        <ul className="no-scrollbar mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 py-1.5">
          {SECTIONS.map((s) => {
            const active = s.id === activeSection;
            return (
              <li key={s.id} className="shrink-0">
                <Link
                  href={sectionPath(lang, s.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                    active ? "bg-ink text-white" : "text-ink hover:bg-paper"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  {s.name[lang]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
