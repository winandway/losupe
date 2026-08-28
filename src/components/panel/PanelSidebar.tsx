"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Lang } from "@/i18n/config";
import { Logo } from "@/components/Logo";
import { useMounted } from "@/lib/use-media";

export type PanelNavItem = {
  key: string;
  href: string;
  label: string;
  icon: "home" | "write" | "orders" | "sponsors" | "notes" | "sources" | "roadmap" | "traffic";
  badge?: number;
};

export type SidebarLabels = {
  title: string;
  site: string;
  logout: string;
  language: string;
  openMenu: string;
  closeMenu: string;
};

const ICONS: Record<PanelNavItem["icon"], React.ReactNode> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h5v-5.5h4V20h5V9.5" />
    </>
  ),
  write: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  orders: (
    <>
      <path d="M4 7h16l-1.2 12.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8Z" />
      <path d="M9 7V5.5a3 3 0 0 1 6 0V7" />
    </>
  ),
  sponsors: (
    <>
      <path d="M4 20V9l5-4 5 4v11" />
      <path d="M14 20V12h6v8" />
      <path d="M2 20h20M7.5 9.5v.01M7.5 13v.01M7.5 16.5v.01M17 15.5v.01" />
    </>
  ),
  notes: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5" />
      <path d="M9 12h7M9 16h7" />
    </>
  ),
  sources: (
    <>
      <path d="M5 19a1 1 0 1 0 0-.01" />
      <path d="M5 13a6 6 0 0 1 6 6" />
      <path d="M5 7a12 12 0 0 1 12 12" />
    </>
  ),
  traffic: (
    <>
      <path d="M4 19V9" />
      <path d="M10 19V5" />
      <path d="M16 19v-7" />
      <path d="M22 19H3" />
    </>
  ),
  roadmap: (
    <>
      <path d="M4 6h6" />
      <path d="M4 12h10" />
      <path d="M4 18h14" />
      <path d="M18 4l2 2-2 2" />
    </>
  ),
};

function Icon({ name }: { name: PanelNavItem["icon"] }) {
  return (
    <svg
      aria-hidden="true"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {ICONS[name]}
    </svg>
  );
}

function NavList({
  items,
  active,
  onNavigate,
}: {
  items: PanelNavItem[];
  active: string;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const isActive = active === item.key;
        return (
          <li key={item.key}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? "bg-white text-ink shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon name={item.icon} />
              <span className="flex-1">{item.label}</span>
              {item.badge ? (
                <span
                  className={`min-w-[1.35rem] rounded-full px-1.5 py-0.5 text-center text-[11px] font-bold ${
                    isActive ? "bg-accent text-ink" : "bg-accent text-ink"
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Bottom({
  lang,
  labels,
  onNavigate,
}: {
  lang: Lang;
  labels: SidebarLabels;
  onNavigate?: () => void;
}) {
  const other = lang === "es" ? "en" : "es";
  return (
    <div className="mt-auto space-y-2 border-t border-white/15 px-3 pb-4 pt-4">
      <Link
        href={`/${lang}`}
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white"
      >
        <svg
          aria-hidden="true"
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        >
          <path d="M14 4h6v6M20 4l-9 9" />
          <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
        {labels.site}
      </Link>
      <div className="flex items-center gap-2 px-3">
        <a
          href={`/panel/accion/idioma?lang=${other}`}
          aria-label={labels.language}
          className="rounded-full border border-white/25 px-3 py-1 text-xs font-bold text-white/80 hover:bg-white/10"
        >
          {other.toUpperCase()}
        </a>
        <form action="/panel/accion/salir" method="post" className="flex-1">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-coral px-3 py-1.5 text-xs font-bold text-white hover:brightness-95"
          >
            <svg
              aria-hidden="true"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
              <path d="M16 17l5-5-5-5M21 12H9" />
            </svg>
            {labels.logout}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Barra lateral del panel. En escritorio queda fija a la izquierda; en celular se abre desde el
 * botón de menú como panel deslizante (portal sobre el body, para que nada la recorte).
 */
export function PanelSidebar({
  lang,
  items,
  active,
  labels,
}: {
  lang: Lang;
  items: PanelNavItem[];
  active: string;
  labels: SidebarLabels;
}) {
  const [open, setOpen] = useState(false);
  const mounted = useMounted();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const brand = (id: string, withTag = true) => (
    <div className="flex min-w-0 items-center gap-2 px-4 pb-5 pt-5">
      <Link href="/panel" aria-label={labels.title} className="min-w-0">
        <Logo id={id} onDark />
      </Link>
      {withTag ? (
        <span className="shrink-0 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          Panel
        </span>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Escritorio: fija */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-ink lg:flex">
        {brand("losupe-mark-side")}
        <nav aria-label={labels.title} className="flex-1 overflow-y-auto px-3">
          <NavList items={items} active={active} />
        </nav>
        <Bottom lang={lang} labels={labels} />
      </aside>

      {/* Celular: botón + panel deslizante */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.openMenu}
        aria-expanded={open}
        className="fixed left-3 top-2.5 z-40 flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-ink shadow-sm hover:bg-paper lg:hidden"
      >
        <svg
          aria-hidden="true"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {mounted && open
        ? createPortal(
            <div className="fixed inset-0 z-[1000] lg:hidden">
              <div
                className="absolute inset-0 bg-ink/50"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-label={labels.title}
                className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-ink shadow-2xl"
              >
                <div className="flex items-start justify-between gap-1">
                  {brand("losupe-mark-side-m", false)}
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label={labels.closeMenu}
                    autoFocus
                    className="m-4 flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
                  >
                    <svg
                      aria-hidden="true"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.3"
                      strokeLinecap="round"
                    >
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>
                <nav aria-label={labels.title} className="flex-1 overflow-y-auto px-3">
                  <NavList items={items} active={active} onNavigate={() => setOpen(false)} />
                </nav>
                <Bottom lang={lang} labels={labels} onNavigate={() => setOpen(false)} />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
