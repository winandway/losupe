"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * EL VIDEO DENTRO DE LA LECTURA.
 *
 * Nace de mirar por dentro cómo lo hace un diario grande (El Tiempo, 19 oct 2026). Una sola nota
 * suya pide **3.059 peticiones a 260 dominios**, y **el 61 % es publicidad y rastreo**: el
 * reproductor de video («editorial player» más un «companion» que flota) arranca junto con el SDK
 * de anuncios de Google y con cientos de sincronizaciones de cookies, antes de que el lector haya
 * leído dos párrafos. El video se ve, sí, pero encima del texto y rodeado de basura.
 *
 * Aquí se copia lo bueno y se tira lo demás:
 *
 *  1. **El video va DENTRO del texto**, no encima. Se lee, se ve, se sigue leyendo.
 *  2. **No existe hasta que te acercas.** Hasta entonces solo hay una imagen fija. Nada de cargar
 *     un reproductor que quizá nadie mire.
 *  3. **Arranca en silencio y solo cuando está a la vista**; al salir de pantalla se pausa. El
 *     sonido lo enciende la persona, nunca nosotros.
 *  4. **Si sigues leyendo, se encoge a una esquina** —eso es lo bueno que tienen ellos— **y se
 *     cierra de verdad**: si lo cierras, no vuelve a aparecer en esa nota.
 *  5. **Cero terceros.** Ni SDK de anuncios, ni cookies, ni pre-roll. El archivo se sirve tal cual.
 *  6. **Respeta al que ahorra datos** y a quien pidió menos movimiento: ahí no se reproduce solo,
 *     se queda la imagen con su botón.
 *  7. **No salta la página**: el hueco está reservado desde el primer pintado.
 */
/**
 * Darle a reproducir sin que importe el navegador: en los antiguos `play()` no devuelve una
 * promesa, y encadenar `.catch` ahí tumbaba el bloque entero.
 */
function reproducir(v: HTMLVideoElement): void {
  try {
    void Promise.resolve(v.play()).catch(() => undefined);
  } catch {
    /* el navegador no deja reproducir: se queda la imagen con su botón */
  }
}

export type TextosVideo = {
  etiqueta: string;
  conSonido: string;
  silenciar: string;
  reproducir: string;
  pausar: string;
  cerrar: string;
};

/** Ahorro de datos o «menos movimiento»: aquí no se reproduce nada solo. */
function prefiereQuieto(): boolean {
  try {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return true;
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

export function VideoEnLectura({
  src,
  poster,
  credito,
  textos,
  articleId,
}: {
  src: string;
  poster?: string | null;
  credito?: string | null;
  textos: TextosVideo;
  articleId?: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [cargar, setCargar] = useState(false);
  const [mini, setMini] = useState(false);
  const [cerrado, setCerrado] = useState(false);
  const [sonando, setSonando] = useState(false);
  const [enMarcha, setEnMarcha] = useState(false);

  const llave = `video-cerrado:${articleId ?? src}`;

  // Si ya lo cerró antes en esta visita, no se vuelve a asomar. (El aviso va en un turno aparte:
  // cambiar el estado dentro del efecto, a secas, encadena pintados de más.)
  useEffect(() => {
    let cerradoAntes = false;
    try {
      cerradoAntes = window.sessionStorage.getItem(llave) === "1";
    } catch {
      /* sin almacenamiento: se comporta como si no lo hubiera cerrado */
    }
    if (!cerradoAntes) return;
    const t = window.setTimeout(() => setCerrado(true), 0);
    return () => window.clearTimeout(t);
  }, [llave]);

  // 1) El reproductor no existe hasta que el lector se acerca.
  useEffect(() => {
    const el = caja.current;
    if (!el || cargar) return;
    if (typeof IntersectionObserver !== "function") {
      // Navegador antiguo: se carga igual, pero en un turno aparte.
      const t = window.setTimeout(() => setCargar(true), 0);
      return () => window.clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          setCargar(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cargar]);

  // 2) Se reproduce solo a la vista; al pasarlo de largo leyendo, se va a la esquina.
  useEffect(() => {
    const el = caja.current;
    const v = video.current;
    if (!el || !v || !cargar || cerrado) return;
    if (typeof IntersectionObserver !== "function") return;
    const io = new IntersectionObserver(
      (entradas) => {
        const e = entradas[0];
        if (!e) return;
        if (e.isIntersecting) {
          setMini(false);
          if (!prefiereQuieto()) reproducir(v);
          return;
        }
        // Fuera de pantalla: si lo dejamos ARRIBA (seguimos leyendo hacia abajo) y estaba andando,
        // se encoge a la esquina. Si no, se pausa y se queda quieto.
        const arriba = e.boundingClientRect.bottom <= 0;
        if (arriba && !v.paused) setMini(true);
        else {
          setMini(false);
          v.pause();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [cargar, cerrado]);

  const alternarSonido = useCallback(() => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setSonando(!v.muted);
    if (v.paused) reproducir(v);
  }, []);

  const alternarMarcha = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) reproducir(v);
    else v.pause();
  }, []);

  const cerrar = useCallback(() => {
    video.current?.pause();
    setMini(false);
    setCerrado(true);
    try {
      window.sessionStorage.setItem(llave, "1");
    } catch {
      /* da igual: en esta página ya no vuelve */
    }
  }, [llave]);

  return (
    <figure ref={caja} className="my-8" data-video-lectura>
      {/* El hueco está reservado desde el primer pintado: la página no salta al cargar el video. */}
      <div
        className={
          mini
            ? "fixed bottom-4 right-4 z-40 w-56 overflow-hidden rounded-xl border border-line bg-ink shadow-2xl sm:w-72"
            : "relative overflow-hidden rounded-2xl bg-ink"
        }
        data-mini={mini ? "si" : "no"}
      >
        <div className="relative aspect-video w-full">
          {cargar && !cerrado ? (
            <video
              ref={video}
              src={src}
              {...(poster ? { poster } : {})}
              muted
              loop
              playsInline
              preload="none"
              controls={false}
              onPlay={() => setEnMarcha(true)}
              onPause={() => setEnMarcha(false)}
              className="h-full w-full object-cover"
              aria-label={textos.etiqueta}
            />
          ) : poster ? (
            // Mientras no te acercas, solo hay una imagen. Pesa lo que pesa una foto.
            <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-full w-full bg-ink" />
          )}

          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            {textos.etiqueta}
          </span>

          <div className="absolute bottom-2 right-2 flex gap-2">
            <button
              type="button"
              onClick={alternarMarcha}
              className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-ink hover:bg-white"
              aria-label={enMarcha ? textos.pausar : textos.reproducir}
            >
              {enMarcha ? textos.pausar : textos.reproducir}
            </button>
            <button
              type="button"
              onClick={alternarSonido}
              className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-ink hover:bg-white"
              aria-label={sonando ? textos.silenciar : textos.conSonido}
            >
              {sonando ? textos.silenciar : textos.conSonido}
            </button>
            {mini ? (
              <button
                type="button"
                onClick={cerrar}
                className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-ink hover:bg-white"
                aria-label={textos.cerrar}
              >
                ✕
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {credito ? <figcaption className="mt-2 text-xs text-muted">{credito}</figcaption> : null}
    </figure>
  );
}
