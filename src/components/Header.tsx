import Link from "next/link";
import { Suspense } from "react";
import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import { formatDate, nowIso } from "@/lib/dates";
import { SECTIONS } from "@/lib/sections";
import { aboutPath, homePath, rssPath, searchPath, sectionPath, staticPath } from "@/lib/urls";
import { Botonera, type BotoneraItem } from "./Botonera";
import { LangSwitcher } from "./LangSwitcher";
import { Logo } from "./Logo";
import { MobileMenu, type MenuLink } from "./MobileMenu";

/**
 * Encabezado. En celular la barra del logo (☰ menú + marca + lupa) queda fija arriba y la botonera
 * de secciones se desliza con la página; en escritorio es al revés: la botonera navy es la fija.
 *
 * OJO (candado): `position: sticky` solo pega dentro de su padre. Por eso la barra y la botonera son
 * hijas DIRECTAS de `<body>` (fragmento), no nietas de un `<header>` envolvente: si se meten dentro de
 * un contenedor, dejan de verse en cuanto ese contenedor sale de la pantalla.
 */
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
  const secondary: MenuLink[] = [
    { key: "publish", label: dict.publish.nav, href: staticPath("publish", lang) },
    { key: "search", label: dict.nav.search, href: searchPath(lang) },
    { key: "rss", label: dict.footer.feeds, href: rssPath(lang), external: true },
    { key: "editorial", label: dict.footer.editorial, href: staticPath("editorial", lang) },
    { key: "privacy", label: dict.footer.privacy, href: staticPath("privacy", lang) },
    { key: "terms", label: dict.footer.terms, href: staticPath("terms", lang) },
    { key: "panel", label: dict.footer.panelLogin, href: "/panel" },
  ];

  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-ink"
      >
        {dict.nav.skip}
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur md:static md:bg-white md:backdrop-blur-none">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-2 py-2 md:px-4 md:py-3">
          <div className="flex min-w-0 items-center gap-1">
            <Suspense fallback={null}>
              <MobileMenu
                lang={lang}
                primary={items}
                secondary={secondary}
                labels={{
                  open: dict.nav.menu,
                  close: dict.nav.closeMenu,
                  sections: dict.nav.sections,
                  site: dict.footer.site,
                  language: dict.nav.language,
                  brand: `${dict.brand.name} — ${dict.nav.home}`,
                  languages: dict.languages,
                }}
              />
            </Suspense>
            <Link
              href={homePath(lang)}
              aria-label={`${dict.brand.name} — ${dict.nav.home}`}
              className="shrink-0"
            >
              <Logo />
            </Link>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
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
      </header>
      <Suspense fallback={null}>
        <Botonera items={items} label={dict.nav.sections} />
      </Suspense>
    </>
  );
}
