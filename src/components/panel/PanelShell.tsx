import Link from "next/link";
import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import { Logo } from "@/components/Logo";

/** Marco del panel: barra con navegación, idioma y cerrar sesión (formulario POST → carga completa). */
export function PanelShell({
  lang,
  dict,
  active,
  children,
  flash,
}: {
  lang: Lang;
  dict: Dict;
  active: "dashboard" | "orders" | "sponsors" | "notes" | "sources";
  children: React.ReactNode;
  flash?: { ok?: string; error?: string };
}) {
  const p = dict.panel;
  const items = [
    { key: "dashboard", href: "/panel", label: p.nav.dashboard },
    { key: "orders", href: "/panel/pedidos", label: p.nav.orders },
    { key: "sponsors", href: "/panel/encargos", label: p.nav.sponsors },
    { key: "notes", href: "/panel/notas", label: p.nav.notes },
    { key: "sources", href: "/panel/fuentes", label: p.nav.sources },
  ] as const;
  const other = lang === "es" ? "en" : "es";
  return (
    <div className="min-h-full bg-paper text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/panel" aria-label={p.title}>
              <Logo id="losupe-mark-panel" />
            </Link>
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
              Panel
            </span>
          </div>
          <nav aria-label={p.title} className="order-3 w-full md:order-2 md:w-auto">
            <ul className="no-scrollbar flex gap-1 overflow-x-auto">
              {items.map((it) => (
                <li key={it.key} className="shrink-0">
                  <Link
                    href={it.href}
                    aria-current={active === it.key ? "page" : undefined}
                    className={`block rounded-full px-4 py-2 text-sm font-semibold ${
                      active === it.key ? "bg-ink text-white" : "text-ink hover:bg-paper"
                    }`}
                  >
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="order-2 flex items-center gap-2 md:order-3">
            <a
              href={`/panel/accion/idioma?lang=${other}`}
              className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink hover:bg-paper"
              aria-label={p.nav.language}
            >
              {other.toUpperCase()}
            </a>
            <Link
              href={`/${lang}`}
              className="hidden rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink hover:bg-paper sm:block"
            >
              {p.nav.site}
            </Link>
            <form action="/panel/accion/salir" method="post">
              <button
                type="submit"
                className="rounded-full bg-coral px-3 py-1.5 text-xs font-bold text-white hover:brightness-95"
              >
                {p.nav.logout}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        {flash?.ok ? (
          <p
            role="status"
            className="mb-4 rounded-xl border border-mint bg-mint/15 px-4 py-3 text-sm font-semibold text-ink"
          >
            {flash.ok}
          </p>
        ) : null}
        {flash?.error ? (
          <p
            role="alert"
            className="mb-4 rounded-xl border border-coral bg-coral/10 px-4 py-3 text-sm font-semibold text-ink"
          >
            {flash.error}
          </p>
        ) : null}
        {children}
      </main>
    </div>
  );
}
