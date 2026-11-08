"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { LANGS, type Lang } from "@/i18n/config";
import { destinoOtroIdioma, swapLangPath } from "@/lib/urls";

/** La versión en `l` que declara la página en su `hreflang`, o null (candado 58). */
function alternativaDeclarada(l: Lang): string | null {
  if (typeof document === "undefined") return null;
  const link = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${l}"]`);
  return link?.getAttribute("href") ?? null;
}

// Regla global: español = bandera de ESPAÑA, inglés = bandera de EE. UU. Nunca otro país.
export const FLAGS: Record<Lang, string> = { es: "🇪🇸", en: "🇺🇸" };
export const SHORT: Record<Lang, string> = { es: "ES", en: "EN" };
/** Cada idioma se nombra en su propio idioma, como en Amazon: «English - EN», «español - ES». */
export const OPTION_TEXT: Record<Lang, string> = { en: "English - EN", es: "español - ES" };

/**
 * Selector de idioma estilo Amazon (regla global del 10 oct 2026). Una sola pieza para todo el sitio.
 *
 * - Encabezado: botón «🇪🇸 ES ▾» que abre una ventanita blanca con piquito, título «Cambiar idioma» y
 *   las opciones con círculo de selección (el elegido, relleno en naranja). Se cierra al elegir, al
 *   tocar fuera o con Escape.
 * - Menú de celular (`full`): la misma lista, a la vista, sin botón.
 *
 * Las opciones son enlaces de verdad y siempre están en el HTML (ocultos mientras la ventanita está
 * cerrada): Google sigue viendo el `hreflang` y el selector de una nota nunca inventa direcciones.
 */
export function LangSwitcher({
  lang,
  labels,
  groupLabel,
  title,
  onNavigate,
  full = false,
}: {
  lang: Lang;
  labels: Record<Lang, string>;
  groupLabel: string;
  /** Título de la ventanita: «Cambiar idioma» / «Change language». */
  title?: string;
  /** Se llama al tocar un idioma (p. ej. para cerrar el menú de celular). */
  onNavigate?: () => void;
  /** Lista a la vista (menú de celular) en vez del botón con ventanita. */
  full?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const qs = searchParams?.toString();
  const router = useRouter();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  // Las versiones que declara la página. En el servidor no se conocen: ahí el selector de una nota
  // lleva a la sección del otro idioma, nunca a una dirección inventada (candado 58).
  const [alternativas, setAlternativas] = useState<Partial<Record<Lang, string | null>>>({});
  useEffect(() => {
    const leer = () =>
      setAlternativas(Object.fromEntries(LANGS.map((l) => [l, alternativaDeclarada(l)])));
    leer();
    // Al navegar dentro del sitio, Next cambia el <head> después de pintar: se vuelve a leer.
    const observador = new MutationObserver(leer);
    observador.observe(document.head, { childList: true, subtree: true, attributes: true });
    return () => observador.disconnect();
  }, [pathname]);

  // Se cierra al tocar fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    const fuera = (e: PointerEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setOpen(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        boton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [open]);

  const opciones = (
    <ul role="list" className="divide-y divide-gray-200">
      {LANGS.map((l) => {
        const active = l === lang;
        const destino = destinoOtroIdioma(pathname, l, alternativas[l]);
        // La búsqueda o la página 2 conservan su ?q= / ?page=; una nota no lleva nada detrás.
        const conservaQs = destino === swapLangPath(pathname, l);
        const href = active ? pathname : `${destino}${qs && conservaQs ? `?${qs}` : ""}`;
        return (
          <li key={l}>
            <Link
              href={href}
              hrefLang={l}
              lang={l}
              aria-label={labels[l]}
              aria-current={active ? "true" : undefined}
              data-idioma={l}
              onClick={(e) => {
                // Al tocar se vuelve a mirar el <head>: si la nota declara su traducción, se va ahí.
                if (!active) {
                  const fresca = destinoOtroIdioma(pathname, l, alternativaDeclarada(l));
                  if (fresca !== destino) {
                    e.preventDefault();
                    router.push(fresca);
                  }
                }
                setOpen(false);
                onNavigate?.();
              }}
              className="flex min-h-11 items-center gap-3 px-1 py-2.5 text-sm text-ink hover:text-[#c45500]"
            >
              <span
                aria-hidden="true"
                data-radio={active ? "on" : "off"}
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
                  active ? "border-[#e77600] bg-white" : "border-gray-400 bg-white"
                }`}
              >
                {active && <span className="h-2.5 w-2.5 rounded-full bg-[#e77600]" />}
              </span>
              <span aria-hidden="true" className="text-base leading-none">
                {FLAGS[l]}
              </span>
              <span className={active ? "font-bold" : ""}>{OPTION_TEXT[l]}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );

  if (full) {
    return (
      <nav aria-label={groupLabel} className="w-full min-w-56">
        {opciones}
      </nav>
    );
  }

  return (
    <div ref={raiz} className="relative">
      <button
        ref={boton}
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${groupLabel}: ${labels[lang]}`}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 items-center gap-1 rounded-md border px-2 text-xs font-bold text-ink transition ${
          open ? "border-ink" : "border-transparent hover:border-ink"
        }`}
      >
        <span aria-hidden="true" className="text-base leading-none">
          {FLAGS[lang]}
        </span>
        <span>{SHORT[lang]}</span>
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" className="ml-0.5">
          <path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>
      <div
        id={panelId}
        role="group"
        aria-label={title ?? groupLabel}
        hidden={!open}
        className="absolute right-0 top-full z-50 mt-2.5 w-60 rounded-lg border border-gray-300 bg-white px-4 pb-2 pt-3 shadow-[0_4px_16px_rgba(0,0,0,0.18)]"
      >
        {/* Piquito que apunta al botón */}
        <span
          aria-hidden="true"
          className="absolute -top-[7px] right-5 h-3 w-3 rotate-45 border-l border-t border-gray-300 bg-white"
        />
        <p className="pb-1 text-sm font-bold text-ink">{title ?? groupLabel}</p>
        {opciones}
      </div>
    </div>
  );
}
