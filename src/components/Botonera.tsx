"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type BotoneraItem = {
  key: string;
  label: string;
  href: string;
  color?: string;
  /** Activo cuando la ruta actual empieza por este prefijo (o es exactamente `href`). */
  exact?: boolean;
};

/** Barra de navegación principal (botonera), fija arriba al hacer scroll. */
export function Botonera({ items, label }: { items: BotoneraItem[]; label: string }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label={label} className="sticky top-0 z-40 bg-ink shadow-md">
      <ul className="no-scrollbar mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-2 py-2">
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <li key={item.key} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold tracking-wide transition ${
                  active ? "bg-white text-ink" : "text-white/90 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.color ? (
                  <span
                    aria-hidden="true"
                    className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-white/20"
                    style={{ backgroundColor: item.color }}
                  />
                ) : null}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
