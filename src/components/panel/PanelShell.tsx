import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import { panelEnv } from "@/lib/panel/server";
import { AvisoDeEnvio } from "./AvisoDeEnvio";
import { PanelSidebar, type PanelNavItem } from "./PanelSidebar";

export type PanelSection = "dashboard" | "write" | "orders" | "sponsors" | "notes" | "sources";

async function badges(): Promise<{ orders: number; notes: number }> {
  try {
    const env = await panelEnv();
    const row = await env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM orders WHERE status = 'new') AS orders,
        (SELECT COUNT(*) FROM articles WHERE status = 'review' AND origin IN ('robot', 'sponsored')) AS notes`,
    ).first<{ orders: number; notes: number }>();
    return { orders: Number(row?.orders ?? 0), notes: Number(row?.notes ?? 0) };
  } catch {
    return { orders: 0, notes: 0 };
  }
}

/**
 * Marco del panel: barra lateral fija en escritorio (deslizante en celular), encabezado con el
 * título de la sección y el contenido. Los avisos numerados salen de la base (pedidos nuevos y
 * notas esperando revisión), para saber de un vistazo qué falta por atender.
 */
export async function PanelShell({
  lang,
  dict,
  active,
  title,
  intro,
  actions,
  children,
  flash,
}: {
  lang: Lang;
  dict: Dict;
  active: PanelSection;
  title?: string;
  intro?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  flash?: { ok?: string; error?: string };
}) {
  const p = dict.panel;
  const count = await badges();
  const items: PanelNavItem[] = [
    { key: "dashboard", href: "/panel", label: p.nav.dashboard, icon: "home" },
    { key: "write", href: "/panel/escribir", label: p.nav.write, icon: "write" },
    {
      key: "orders",
      href: "/panel/pedidos",
      label: p.nav.orders,
      icon: "orders",
      badge: count.orders,
    },
    { key: "sponsors", href: "/panel/encargos", label: p.nav.sponsors, icon: "sponsors" },
    { key: "notes", href: "/panel/notas", label: p.nav.notes, icon: "notes", badge: count.notes },
    { key: "sources", href: "/panel/fuentes", label: p.nav.sources, icon: "sources" },
  ];
  const sectionTitle = title ?? items.find((i) => i.key === active)?.label ?? p.title;

  return (
    <div className="min-h-full bg-paper text-ink">
      {/* CANDADO: la barra lateral va FUERA del header. Un `backdrop-blur`/`filter` en un ancestro
          hace que `position: fixed` se mida contra ese ancestro y no contra la pantalla. */}
      <PanelSidebar
        lang={lang}
        items={items}
        active={active}
        labels={{
          title: p.title,
          site: p.nav.site,
          logout: p.nav.logout,
          language: p.nav.language,
          openMenu: p.nav.openMenu,
          closeMenu: p.nav.closeMenu,
        }}
      />

      <AvisoDeEnvio etiqueta={p.working} detalle={p.workingHint} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-line bg-paper">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 py-3 pl-16 pr-4 lg:px-8">
            <div className="min-w-0 flex-1">
              {/* Dos lineas como mucho: en celular un nombre largo se cortaba a «YaDomi…» y no se
                  sabia de quien era la ficha. */}
              <h1 className="line-clamp-2 font-display text-xl font-bold leading-tight text-ink md:text-2xl">
                {sectionTitle}
              </h1>
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
          {intro ? <p className="-mt-1 mb-5 max-w-3xl text-sm text-muted">{intro}</p> : null}
          {flash?.ok ? (
            <p
              role="status"
              className="mb-5 flex items-start gap-2 rounded-xl border border-mint bg-mint/15 px-4 py-3 text-sm font-semibold text-ink"
            >
              <span aria-hidden="true">✓</span>
              {flash.ok}
            </p>
          ) : null}
          {flash?.error ? (
            <p
              role="alert"
              className="mb-5 flex items-start gap-2 rounded-xl border border-coral bg-coral/10 px-4 py-3 text-sm font-semibold text-ink"
            >
              <span aria-hidden="true">!</span>
              {flash.error}
            </p>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
