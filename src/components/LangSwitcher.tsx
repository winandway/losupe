"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { LANGS, type Lang } from "@/i18n/config";
import { destinoOtroIdioma, swapLangPath } from "@/lib/urls";

/** La versión en `l` que declara la página en su `hreflang`, o null (candado 58). */
function alternativaDeclarada(l: Lang): string | null {
  if (typeof document === "undefined") return null;
  const link = document.querySelector<HTMLLinkElement>(`link[rel="alternate"][hreflang="${l}"]`);
  return link?.getAttribute("href") ?? null;
}

const FLAGS: Record<Lang, string> = { es: "🇪🇸", en: "🇺🇸" };
const SHORT: Record<Lang, string> = { es: "ES", en: "EN" };

export function LangSwitcher({
  lang,
  labels,
  groupLabel,
  onNavigate,
  full = false,
}: {
  lang: Lang;
  labels: Record<Lang, string>;
  groupLabel: string;
  /** Se llama al tocar un idioma (p. ej. para cerrar el menú de celular). */
  onNavigate?: () => void;
  /** Muestra el nombre completo del idioma (menú de celular) en vez de ES/EN. */
  full?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const qs = searchParams?.toString();
  const router = useRouter();
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

  return (
    <div
      role="group"
      aria-label={groupLabel}
      className="flex items-center overflow-hidden rounded-full border border-line bg-white text-xs font-bold"
    >
      {LANGS.map((l) => {
        const active = l === lang;
        const destino = destinoOtroIdioma(pathname, l, alternativas[l]);
        // La búsqueda o la página 2 conservan su ?q= / ?page=; una nota no lleva nada detrás.
        const conservaQs = destino === swapLangPath(pathname, l);
        const href = l === lang ? pathname : `${destino}${qs && conservaQs ? `?${qs}` : ""}`;
        return (
          <Link
            key={l}
            href={href}
            hrefLang={l}
            lang={l}
            aria-label={labels[l]}
            aria-current={active ? "true" : undefined}
            onClick={(e) => {
              // Al tocar se vuelve a mirar el <head>: si la nota declara su traducción, se va ahí.
              if (l !== lang) {
                const fresca = destinoOtroIdioma(pathname, l, alternativaDeclarada(l));
                if (fresca !== destino) {
                  e.preventDefault();
                  router.push(fresca);
                }
              }
              onNavigate?.();
            }}
            className={`flex items-center gap-1 transition ${full ? "px-4 py-2 text-sm" : "px-2.5 py-1.5"} ${
              active ? "bg-ink text-white" : "text-ink hover:bg-paper"
            }`}
          >
            <span aria-hidden="true">{FLAGS[l]}</span>
            {full ? <span>{labels[l]}</span> : <span className="hidden sm:inline">{SHORT[l]}</span>}
          </Link>
        );
      })}
    </div>
  );
}
