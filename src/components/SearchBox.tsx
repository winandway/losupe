"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Lang } from "@/i18n/config";
import { searchPath } from "@/lib/urls";
import { MOBILE_QUERY, useMediaQuery, useMounted } from "@/lib/use-media";

/** Solo textos planos (un componente cliente no puede recibir funciones del servidor). `{q}` se reemplaza. */
export type SearchBoxLabels = {
  placeholder: string;
  button: string;
  label: string;
  seeAllTemplate: string;
  noneTemplate: string;
  close: string;
  hint?: string;
};

function fill(template: string, q: string): string {
  return template.replace("{q}", q);
}

type Item = {
  id: string;
  title: string;
  url: string;
  sectionName: string;
  color: string;
  date: string;
};

type Pos = { top: number; left: number; width: number };

/**
 * Buscador con sugerencias mientras se escribe (/datos/buscar), navegable con teclado.
 *
 * - Escritorio: la lista se pinta en un portal sobre `document.body` (z-index máximo), así ningún
 *   contenedor del hero —ni un modo oscuro forzado que le meta un `filter`— puede taparla.
 * - Celular: al tocar la caja se abre una hoja a pantalla completa con su propia caja y la lista,
 *   como en las apps de noticias. (En la página de resultados, que ya enfoca sola, no se abre.)
 * - Sin JavaScript sigue funcionando como formulario normal hacia la página de resultados.
 */
export function SearchBox({
  lang,
  labels,
  size = "md",
  initialValue = "",
  autoFocus = false,
}: {
  lang: Lang;
  labels: SearchBoxLabels;
  size?: "md" | "lg";
  initialValue?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState(initialValue);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState("");
  const [pos, setPos] = useState<Pos | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mounted = useMounted();
  const isMobile = useMediaQuery(MOBILE_QUERY);
  const useSheet = isMobile && !autoFocus;
  const large = size === "lg";
  const trimmed = q.trim();

  function measure() {
    const el = formRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + window.scrollY + 8, left: r.left + window.scrollX, width: r.width });
  }

  useEffect(() => {
    // Con la caja vacía no se consulta nada; la lista se oculta sola (depende de `trimmed`).
    if (trimmed.length < 1) return;
    const t = window.setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/datos/buscar?q=${encodeURIComponent(trimmed)}&lang=${lang}&limit=8`,
          { signal: controller.signal, headers: { Accept: "application/json" } },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { items: Item[] };
        setItems(data.items ?? []);
        setSearched(trimmed);
        setActive(-1);
        measure();
        setOpen(true);
      } catch {
        /* petición cancelada o sin red: se deja lo que había */
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [trimmed, lang]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (formRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // El desplegable de escritorio sigue a la caja si la página se mueve o cambia de tamaño.
  useEffect(() => {
    if (!open || useSheet) return;
    const onMove = () => measure();
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
    };
  }, [open, useSheet]);

  // Con la hoja abierta, la página de atrás no se desplaza.
  useEffect(() => {
    if (!sheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sheet]);

  const hasResults = trimmed.length > 0 && searched === trimmed;
  const showDropdown = !useSheet && open && hasResults;
  const showSheet = useSheet && sheet;
  const listVisible = showDropdown || (showSheet && hasResults);
  const allUrl = useMemo(() => searchPath(lang, trimmed), [lang, trimmed]);

  function closeAll() {
    setSheet(false);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      closeAll();
      return;
    }
    if (!listVisible) return;
    const total = items.length + 1; // + "ver todos"
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? total - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      const target = active < items.length ? items[active]?.url : allUrl;
      if (target) {
        closeAll();
        router.push(target);
      }
    }
  }

  function onInlineFocus() {
    if (useSheet) {
      setSheet(true);
      return;
    }
    if (items.length > 0) {
      measure();
      setOpen(true);
    }
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQ(e.target.value);
    if (useSheet) setSheet(true);
  }

  const comboProps = {
    name: "q",
    type: "search" as const,
    required: true,
    minLength: 1,
    maxLength: 80,
    value: q,
    onChange,
    onKeyDown,
    placeholder: labels.placeholder,
    autoComplete: "off",
    enterKeyHint: "search" as const,
    role: "combobox",
    "aria-expanded": listVisible,
    "aria-controls": `${listId}-list`,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant": active >= 0 ? `${listId}-opt-${active}` : undefined,
  };

  const inputClass = large
    ? "h-12 w-full min-w-0 rounded-full border-0 bg-white px-5 text-base text-ink shadow-lg outline-none ring-accent focus:ring-4 md:h-14 md:text-lg"
    : "w-full min-w-0 rounded-full border border-line bg-white px-4 py-2.5 text-base outline-none focus:border-ink focus:ring-2 focus:ring-accent";
  const buttonClass = large
    ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-ink shadow-lg hover:brightness-95 md:h-14 md:w-auto md:px-8"
    : "shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-ink-2";

  const list = (
    <ul
      ref={listRef}
      id={`${listId}-list`}
      role="listbox"
      className={
        showSheet
          ? "p-2"
          : "absolute z-[1000] max-h-[70vh] overflow-auto rounded-2xl border border-line bg-white p-1.5 text-left shadow-2xl"
      }
      style={showSheet || !pos ? undefined : { top: pos.top, left: pos.left, width: pos.width }}
    >
      {items.map((it, i) => (
        <li key={it.id} role="option" aria-selected={active === i} id={`${listId}-opt-${i}`}>
          <Link
            href={it.url}
            onMouseEnter={() => setActive(i)}
            onClick={closeAll}
            className={`flex items-start gap-3 rounded-xl px-3 py-2.5 ${
              active === i ? "bg-paper" : "hover:bg-paper"
            }`}
          >
            <span
              aria-hidden="true"
              className="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: it.color }}
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold leading-snug text-ink">{it.title}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {it.sectionName} · {it.date.slice(0, 10)}
              </span>
            </span>
          </Link>
        </li>
      ))}
      {items.length === 0 ? (
        <li className="px-3 py-2.5 text-sm text-muted">{fill(labels.noneTemplate, trimmed)}</li>
      ) : null}
      <li
        role="option"
        aria-selected={active === items.length}
        id={`${listId}-opt-${items.length}`}
      >
        <Link
          href={allUrl}
          onMouseEnter={() => setActive(items.length)}
          onClick={closeAll}
          className={`mt-1 block rounded-xl px-3 py-2 text-sm font-bold text-ink ${
            active === items.length ? "bg-paper" : "hover:bg-paper"
          }`}
        >
          {fill(labels.seeAllTemplate, trimmed)} →
        </Link>
      </li>
    </ul>
  );

  return (
    <>
      <form
        ref={formRef}
        action={searchPath(lang)}
        method="get"
        role="search"
        className="relative"
        onSubmit={closeAll}
      >
        <div className="flex gap-2">
          <label htmlFor={`${listId}-input`} className="sr-only">
            {labels.label}
          </label>
          <input
            id={`${listId}-input`}
            {...comboProps}
            onFocus={onInlineFocus}
            autoFocus={autoFocus}
            className={inputClass}
          />
          <button type="submit" aria-label={labels.button} className={buttonClass}>
            {large ? (
              <>
                <svg
                  aria-hidden="true"
                  className="md:hidden"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <span className="hidden text-base font-extrabold uppercase tracking-wide md:inline">
                  {labels.button}
                </span>
              </>
            ) : (
              labels.button
            )}
          </button>
        </div>
      </form>

      {mounted && showDropdown && pos ? createPortal(list, document.body) : null}

      {mounted && showSheet
        ? createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-label={labels.label}
              className="fixed inset-0 z-[1000] flex flex-col bg-white text-ink"
            >
              <form
                action={searchPath(lang)}
                method="get"
                role="search"
                onSubmit={closeAll}
                className="flex items-center gap-2 border-b border-line px-3 py-2"
              >
                <button
                  type="button"
                  onClick={closeAll}
                  aria-label={labels.close}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink hover:bg-paper"
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
                    strokeLinejoin="round"
                  >
                    <path d="M19 12H5" />
                    <path d="m12 19-7-7 7-7" />
                  </svg>
                </button>
                <label htmlFor={`${listId}-sheet-input`} className="sr-only">
                  {labels.label}
                </label>
                <input
                  id={`${listId}-sheet-input`}
                  {...comboProps}
                  autoFocus
                  className="h-11 w-full min-w-0 flex-1 rounded-full border border-line bg-paper px-4 text-base outline-none focus:border-ink focus:ring-2 focus:ring-accent"
                />
                <button
                  type="submit"
                  aria-label={labels.button}
                  className="h-10 shrink-0 rounded-full bg-accent px-4 text-sm font-extrabold uppercase tracking-wide text-ink"
                >
                  {labels.button}
                </button>
              </form>
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {hasResults ? (
                  list
                ) : labels.hint ? (
                  <p className="px-5 py-6 text-sm text-muted">{labels.hint}</p>
                ) : null}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
