"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { Lang } from "@/i18n/config";
import { searchPath } from "@/lib/urls";

/** Solo textos planos (un componente cliente no puede recibir funciones del servidor). `{q}` se reemplaza. */
export type SearchBoxLabels = {
  placeholder: string;
  button: string;
  label: string;
  seeAllTemplate: string;
  noneTemplate: string;
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

/**
 * Buscador con sugerencias mientras se escribe (/datos/buscar), navegable con teclado.
 * Sin JavaScript sigue funcionando como formulario normal hacia la página de resultados.
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
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState("");
  const boxRef = useRef<HTMLFormElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const large = size === "lg";
  const trimmed = q.trim();

  useEffect(() => {
    // Con la caja vacía no se consulta nada; la lista se oculta sola (showList depende de `trimmed`).
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
        setOpen(true);
      } catch {
        /* petición cancelada o sin red: se deja lo que había */
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [trimmed, lang]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const showList = open && trimmed.length > 0 && searched === trimmed;
  const allUrl = useMemo(() => searchPath(lang, trimmed), [lang, trimmed]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    const total = items.length + 1; // + "ver todos"
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? total - 1 : a - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      const target = active < items.length ? items[active]?.url : allUrl;
      if (target) router.push(target);
    }
  }

  const inputClass = large
    ? "h-12 w-full min-w-0 rounded-full border-0 bg-white px-5 text-base text-ink shadow-lg outline-none ring-accent focus:ring-4 md:h-14 md:text-lg"
    : "w-full min-w-0 rounded-full border border-line bg-white px-4 py-2.5 text-base outline-none focus:border-ink focus:ring-2 focus:ring-accent";
  const buttonClass = large
    ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-ink shadow-lg hover:brightness-95 md:h-14 md:w-auto md:px-8"
    : "shrink-0 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-ink-2";

  return (
    <form
      ref={boxRef}
      action={searchPath(lang)}
      method="get"
      role="search"
      className="relative"
      onSubmit={() => setOpen(false)}
    >
      <div className="flex gap-2">
        <label htmlFor={`${listId}-input`} className="sr-only">
          {labels.label}
        </label>
        <input
          id={`${listId}-input`}
          name="q"
          type="search"
          required
          minLength={1}
          maxLength={80}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={labels.placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${listId}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
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

      {showList ? (
        <ul
          id={`${listId}-list`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-auto rounded-2xl border border-line bg-white p-1.5 text-left shadow-2xl"
        >
          {items.map((it, i) => (
            <li key={it.id} role="option" aria-selected={active === i} id={`${listId}-opt-${i}`}>
              <Link
                href={it.url}
                onMouseEnter={() => setActive(i)}
                onClick={() => setOpen(false)}
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
                  <span className="block text-sm font-semibold leading-snug text-ink">
                    {it.title}
                  </span>
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
              onClick={() => setOpen(false)}
              className={`mt-1 block rounded-xl px-3 py-2 text-sm font-bold text-ink ${
                active === items.length ? "bg-paper" : "hover:bg-paper"
              }`}
            >
              {fill(labels.seeAllTemplate, trimmed)} →
            </Link>
          </li>
        </ul>
      ) : null}
    </form>
  );
}
