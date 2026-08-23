import Link from "next/link";
import { Suspense } from "react";
import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import { formatDate, nowIso } from "@/lib/dates";
import { SECTIONS } from "@/lib/sections";
import { aboutPath, homePath, searchPath, sectionPath } from "@/lib/urls";
import { Botonera, type BotoneraItem } from "./Botonera";
import { LangSwitcher } from "./LangSwitcher";
import { Logo } from "./Logo";

export function Header({ lang, dict }: { lang: Lang; dict: Dict }) {
  const items: BotoneraItem[] = [
    { key: "home", label: dict.nav.home, href: homePath(lang), exact: true },
    ...SECTIONS.map((s) => ({
      key: s.id,
      label: s.name[lang],
      href: sectionPath(lang, s.id),
      color: s.color,
    })),
    { key: "about", label: dict.nav.about, href: aboutPath(lang) },
  ];

  return (
    <header>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-ink"
      >
        {dict.nav.skip}
      </a>
      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href={homePath(lang)} aria-label={`${dict.brand.name} — ${dict.nav.home}`}>
            <Logo />
          </Link>
          <div className="flex items-center gap-3">
            <time
              dateTime={nowIso().slice(0, 10)}
              className="hidden text-xs font-semibold uppercase tracking-widest text-muted md:block"
            >
              {formatDate(nowIso(), lang)}
            </time>
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
      </div>
      <Suspense fallback={null}>
        <Botonera items={items} label={dict.nav.sections} />
      </Suspense>
    </header>
  );
}
