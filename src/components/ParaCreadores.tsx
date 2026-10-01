"use client";

import { useRef, useState } from "react";

/**
 * EL GUION PARA CREADORES: la noticia lista para leer en un teleprompter y grabar un video corto.
 *
 * Dos versiones desde el 1 de octubre de 2026 (Richard graba Shorts de un minuto y videos de dos):
 * la de **1 minuto** sale elegida de entrada y la de **2 minutos** está a un toque. Cada una con su
 * botón de copiar, su duración a la vista, y encima el título propuesto para el video.
 *
 * Lo importante sigue siendo el botón: copiar tiene que funcionar a la primera en el celular, que es
 * desde donde se graba. Se intenta el portapapeles moderno y, si el navegador no lo deja (algunos
 * navegadores internos de redes sociales no lo permiten), se cae al método clásico con un campo de
 * texto oculto. Si tampoco se puede, se dice claro y el texto queda seleccionable.
 */
export type TextosCreadores = {
  titulo: string;
  intro: string;
  duracion: string;
  copiar: string;
  copiado: string;
  error: string;
  comoTitulo: string;
  paso1: string;
  paso2: string;
  paso3: string;
  permiso: string;
  tituloVideo: string;
  copiarTitulo: string;
};

export type VersionGuion = {
  /** `1m` o `2m`: la llave de la pestaña. */
  medida: string;
  /** Lo que se lee en la pestaña: «1 minuto» / «2 minutos». */
  etiqueta: string;
  texto: string;
  duracion: string;
};

async function alPortapapeles(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Navegadores que no dejan usar el portapapeles moderno: el método clásico.
    try {
      const area = document.createElement("textarea");
      area.value = texto;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export function ParaCreadores({
  versiones,
  tituloVideo,
  textos,
}: {
  versiones: VersionGuion[];
  tituloVideo?: string | null;
  textos: TextosCreadores;
}) {
  const [activa, setActiva] = useState(0);
  const [estado, setEstado] = useState<"listo" | "copiado" | "error">("listo");
  const [tituloCopiado, setTituloCopiado] = useState(false);
  const texto = useRef<HTMLDivElement>(null);
  const version = versiones[activa] ?? versiones[0];
  if (!version) return null;

  async function copiar() {
    const ok = await alPortapapeles(version!.texto);
    setEstado(ok ? "copiado" : "error");
    if (!ok && texto.current) {
      // Que al menos quede seleccionado para copiarlo a mano.
      const rango = document.createRange();
      rango.selectNodeContents(texto.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(rango);
    }
    if (ok) window.setTimeout(() => setEstado("listo"), 3000);
  }

  async function copiarTitulo() {
    if (!tituloVideo) return;
    const ok = await alPortapapeles(tituloVideo);
    setTituloCopiado(ok);
    if (ok) window.setTimeout(() => setTituloCopiado(false), 3000);
  }

  return (
    <section
      className="mt-10 overflow-hidden rounded-2xl border-2 border-ink"
      aria-labelledby="para-creadores"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 bg-ink px-5 py-3 text-white">
        <h2 id="para-creadores" className="flex items-center gap-2 font-display text-lg font-bold">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 fill-none stroke-current"
            strokeWidth="2"
          >
            <rect x="3" y="6" width="13" height="12" rx="2" />
            <path d="m16 10 5-3v10l-5-3z" />
          </svg>
          {textos.titulo}
        </h2>
        <span className="rounded-full bg-accent px-3 py-0.5 text-xs font-bold text-ink">
          {textos.duracion} {version.duracion}
        </span>
      </div>

      <div className="bg-white p-5">
        <p className="text-sm text-muted">{textos.intro}</p>

        {tituloVideo ? (
          <div className="mt-4 rounded-xl border border-line bg-paper p-3">
            <h3 className="text-xs font-bold uppercase tracking-widest text-muted">
              {textos.tituloVideo}
            </h3>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-base font-bold text-ink" data-titulo-video>
                {tituloVideo}
              </p>
              <button
                type="button"
                onClick={copiarTitulo}
                className="shrink-0 rounded-full border border-ink px-3 py-1 text-xs font-bold text-ink hover:bg-ink hover:text-white"
              >
                {tituloCopiado ? textos.copiado : textos.copiarTitulo}
              </button>
            </div>
          </div>
        ) : null}

        {versiones.length > 1 ? (
          <div
            role="tablist"
            aria-label={textos.titulo}
            className="mt-4 flex gap-2 rounded-full bg-paper p-1"
          >
            {versiones.map((v, i) => (
              <button
                key={v.medida}
                type="button"
                role="tab"
                aria-selected={i === activa}
                onClick={() => {
                  setActiva(i);
                  setEstado("listo");
                }}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-bold transition ${
                  i === activa ? "bg-ink text-white" : "text-ink hover:bg-line"
                }`}
              >
                {v.etiqueta}
              </button>
            ))}
          </div>
        ) : null}

        <div
          ref={texto}
          className="mt-4 max-h-96 overflow-y-auto whitespace-pre-line rounded-xl bg-paper p-4 text-[1.05rem] leading-relaxed text-ink"
          data-guion
          data-medida={version.medida}
        >
          {version.texto}
        </div>

        <button
          type="button"
          onClick={copiar}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-extrabold transition ${
            estado === "copiado" ? "bg-mint text-ink" : "bg-accent text-ink hover:brightness-95"
          }`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-5 w-5 fill-none stroke-current"
            strokeWidth="2"
          >
            {estado === "copiado" ? (
              <path d="m5 12 5 5L20 7" />
            ) : (
              <>
                <rect x="9" y="9" width="11" height="11" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </>
            )}
          </svg>
          {estado === "copiado" ? textos.copiado : `${textos.copiar} · ${version.etiqueta}`}
        </button>
        <p role="status" aria-live="polite" className="mt-2 min-h-5 text-center text-sm text-coral">
          {estado === "error" ? textos.error : ""}
        </p>

        <div className="mt-2 border-t border-line pt-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-muted">
            {textos.comoTitulo}
          </h3>
          <ol className="mt-2 space-y-1.5 text-sm text-ink">
            {[textos.paso1, textos.paso2, textos.paso3].map((paso, i) => (
              <li key={paso} className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                  {i + 1}
                </span>
                {paso}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">{textos.permiso}</p>
        </div>
      </div>
    </section>
  );
}
