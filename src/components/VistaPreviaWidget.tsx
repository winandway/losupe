"use client";

import { useEffect, useRef } from "react";

/**
 * La vista previa del widget dentro de nuestra propia página.
 *
 * En una web normal basta con pegar la etiqueta `script` y ya está. Aquí no: Next mueve los scripts
 * del JSX a la cabecera y, además, React vuelve a pintar el contenedor al hidratar y se lleva por
 * delante lo que el widget haya escrito (error de hidratación 418, visto el 29 ago 2026). Por eso
 * la vista previa carga el widget **después** de que React termine, dentro de un contenedor que
 * React ya no toca.
 *
 * Esto es solo para esta página: quien nos incruste no necesita nada de esto.
 */
export function VistaPreviaWidget({ lang, n = 3 }: { lang: string; n?: number }) {
  const hueco = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const destino = hueco.current;
    if (!destino) return;
    destino.innerHTML = "";
    const s = document.createElement("script");
    s.src = `/datos/widget?lang=${encodeURIComponent(lang)}&n=${n}`;
    s.async = true;
    destino.appendChild(s);
    return () => {
      destino.innerHTML = "";
    };
  }, [lang, n]);

  return (
    <div
      ref={hueco}
      data-losupe-aqui
      suppressHydrationWarning
      className="mt-4 rounded-2xl border border-line bg-paper p-5"
    />
  );
}
