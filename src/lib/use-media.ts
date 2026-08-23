"use client";

import { useCallback, useSyncExternalStore } from "react";

function noop() {
  return () => undefined;
}

/**
 * `true` cuando la consulta de medios se cumple. En el servidor (y en la primera pintura del
 * cliente) devuelve `false`, así el HTML hidrata igual que se generó.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return noop();
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false,
  );
}

/** `true` solo después de hidratar: sirve para portales (`document.body` no existe en el servidor). */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/** Punto de corte móvil del sitio (igual que `md:` de Tailwind). */
export const MOBILE_QUERY = "(max-width: 767px)";
