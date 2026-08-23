"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import type { Lang } from "@/i18n/config";
import { useMounted } from "@/lib/use-media";
import type { BotoneraItem } from "./Botonera";
import { LangSwitcher } from "./LangSwitcher";
import { Logo } from "./Logo";

export type MenuLink = { key: string; label: string; href: string; external?: boolean };

export type MobileMenuLabels = {
  open: string;
  close: string;
  sections: string;
  site: string;
  language: string;
  brand: string;
  languages: Record<Lang, string>;
};

/**
 * Menú hamburguesa de celular (solo se ve bajo `md`). Abre un panel a pantalla completa con las
 * secciones, el idioma y los enlaces del sitio. Se pinta en un portal sobre `document.body` para
 * que ningún contenedor lo recorte ni lo tape.
 */
export function MobileMenu({
  lang,
  primary,
  secondary,
  labels,
}: {
  lang: Lang;
  primary: BotoneraItem[];
  secondary: MenuLink[];
  labels: MobileMenuLabels;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const mounted = useMounted();
  const pathname = usePathname() ?? "/";

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

  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.open}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="dialog"
        className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-paper md:hidden"
      >
        <svg
          aria-hidden="true"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>

      {mounted && open
        ? createPortal(
            <div
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label={labels.open}
              className="fixed inset-0 z-[1000] flex flex-col overflow-y-auto overscroll-contain bg-white text-ink"
            >
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <Link href={`/${lang}`} aria-label={labels.brand} onClick={close}>
                  <Logo id="losupe-mark-menu" />
                </Link>
                <button
                  type="button"
                  onClick={close}
                  aria-label={labels.close}
                  autoFocus
                  className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-paper"
                >
                  <svg
                    aria-hidden="true"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  >
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>

              <nav aria-label={labels.sections} className="px-3 pt-3">
                <h2 className="px-2 text-[11px] font-bold uppercase tracking-widest text-muted">
                  {labels.sections}
                </h2>
                <ul className="mt-1">
                  {primary.map((item) => {
                    const active = item.exact
                      ? pathname === item.href
                      : pathname.startsWith(item.href);
                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          onClick={close}
                          aria-current={active ? "page" : undefined}
                          className={`flex items-center gap-3 rounded-xl px-3 py-3 font-display text-xl font-bold ${
                            active ? "bg-paper" : "hover:bg-paper"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className="inline-block h-3 w-3 shrink-0 rounded-full"
                            style={item.color ? { backgroundColor: item.color } : undefined}
                          />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              <div className="px-5 pt-4">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">
                  {labels.language}
                </h2>
                <div className="mt-2 inline-flex">
                  <LangSwitcher
                    lang={lang}
                    labels={labels.languages}
                    groupLabel={labels.language}
                    onNavigate={close}
                    full
                  />
                </div>
              </div>

              <nav aria-label={labels.site} className="mt-auto border-t border-line px-5 py-4">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">
                  {labels.site}
                </h2>
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {secondary.map((l) => (
                    <li key={l.key}>
                      {l.external ? (
                        <a href={l.href} onClick={close} className="hover:underline">
                          {l.label}
                        </a>
                      ) : (
                        <Link href={l.href} onClick={close} className="hover:underline">
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
