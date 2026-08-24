"use client";

import { useState } from "react";
import type { Lang } from "@/i18n/config";

/**
 * El formulario del boletín, con respuesta inmediata.
 *
 * Antes era un formulario normal: se pulsaba «Suscribirme» y durante unos dos segundos no pasaba
 * absolutamente nada en pantalla —el servidor estaba esperando a que saliera el correo y luego
 * recargaba la página entera—. La gente daba por hecho que estaba roto y volvía a pulsar. Palabras
 * de Richard (24 ago 2026): *«se queda pensando… la gente piensa que eso no funciona»*.
 *
 * Ahora, en el mismo instante del clic, el botón dice que está enviando y no admite un segundo
 * clic; la respuesta llega sin recargar la página. Y si el navegador no tiene JavaScript, el
 * formulario sigue funcionando como siempre (`action` + `method="post"`): esto se añade encima, no
 * en lugar de.
 */

type Textos = {
  placeholder: string;
  button: string;
  sending: string;
  checkInbox: string;
  already: string;
  invalid: string;
  mailDown: string;
};

export function BoletinForm({ lang, t }: { lang: Lang; t: Textos }) {
  const [estado, setEstado] = useState<"idle" | "enviando" | "listo">("idle");
  const [mensaje, setMensaje] = useState<{ texto: string; bueno: boolean } | null>(null);

  const respuestas: Record<string, { texto: string; bueno: boolean }> = {
    revisa: { texto: t.checkInbox, bueno: true },
    yaestabas: { texto: t.already, bueno: true },
    invalido: { texto: t.invalid, bueno: false },
    sincorreo: { texto: t.mailDown, bueno: false },
  };

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    // Sin fetch no hay nada que interceptar: que el navegador haga lo de siempre.
    if (typeof fetch !== "function") return;
    e.preventDefault();
    if (estado === "enviando") return;
    setEstado("enviando");
    setMensaje(null);
    try {
      const res = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      const data = (await res.json().catch(() => null)) as { estado?: string } | null;
      setMensaje(respuestas[data?.estado ?? ""] ?? { texto: t.invalid, bueno: false });
      if (data?.estado === "revisa" || data?.estado === "yaestabas") form.reset();
    } catch {
      // Si la petición no sale (red caída), se dice; no se deja el botón girando para siempre.
      setMensaje({ texto: t.mailDown, bueno: false });
    } finally {
      setEstado("listo");
    }
  }

  return (
    <>
      {mensaje ? (
        <p
          role="status"
          className={`mx-auto mt-4 max-w-md rounded-xl px-4 py-2.5 text-sm font-semibold ${
            mensaje.bueno ? "bg-mint text-ink" : "bg-coral text-white"
          }`}
        >
          {mensaje.texto}
        </p>
      ) : null}
      <form
        action="/datos/boletin"
        method="post"
        onSubmit={enviar}
        className="mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row"
      >
        <input type="hidden" name="lang" value={lang} />
        <label htmlFor="boletin-email" className="sr-only">
          {t.placeholder}
        </label>
        <input
          id="boletin-email"
          name="email"
          type="email"
          required
          maxLength={200}
          autoComplete="email"
          placeholder={t.placeholder}
          className="h-12 w-full min-w-0 rounded-full border-0 bg-white px-5 text-base text-ink outline-none ring-accent focus:ring-4"
        />
        <button
          type="submit"
          disabled={estado === "enviando"}
          aria-busy={estado === "enviando"}
          className="h-12 shrink-0 rounded-full bg-accent px-6 text-sm font-extrabold uppercase tracking-wide text-ink hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
        >
          {estado === "enviando" ? t.sending : t.button}
        </button>
      </form>
    </>
  );
}
