"use client";

import { useEffect, useState } from "react";

/**
 * Video de fondo del frente. Se carga DESPUÉS de que la página terminó de cargar (no compite con
 * el contenido) y se omite si el usuario pidió ahorro de datos o menos movimiento.
 */
export function HeroVideo({ src, poster, title }: { src: string; poster: string; title: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return;
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const start = () => setReady(true);
    if (document.readyState === "complete") {
      const t = window.setTimeout(start, 300);
      return () => window.clearTimeout(t);
    }
    window.addEventListener("load", start, { once: true });
    return () => window.removeEventListener("load", start);
  }, []);

  if (!ready) return null;
  return (
    <video
      className="absolute inset-0 h-full w-full object-cover"
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      poster={poster}
      title={title}
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
}
