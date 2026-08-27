"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * EL SENSOR DE LECTORES.
 *
 * Avisa de que alguien está leyendo. Que este código llegue a ejecutarse ES la prueba de que hay una
 * persona con un navegador de verdad: los rastreadores y los robots piden el HTML y se van sin
 * ejecutar nada.
 *
 * Manda una señal al entrar y otra cada dos minutos **solo mientras la pestaña está a la vista**, lo
 * que además sirve para saber quién está leyendo ahora mismo. Si la persona se va a otra pestaña,
 * deja de contar: no es un lector, es una pestaña olvidada.
 *
 * No usa cookies ni guarda nada en el navegador.
 */

const CADA = 120_000;

export function Sensor({ lang }: { lang: string }) {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof fetch !== "function") return;
    let vivo = true;

    const avisar = () => {
      if (!vivo || document.visibilityState !== "visible") return;
      fetch("/datos/visita", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruta: pathname,
          lang,
          // Solo el dominio de donde viene, nunca la dirección completa.
          referente: document.referrer ? new URL(document.referrer).hostname : null,
        }),
        keepalive: true,
      }).catch(() => undefined);
    };

    avisar();
    const reloj = setInterval(avisar, CADA);
    document.addEventListener("visibilitychange", avisar);
    return () => {
      vivo = false;
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", avisar);
    };
  }, [pathname, lang]);

  return null;
}
