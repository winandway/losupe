"use client";

import { useState } from "react";
import type { Lang } from "@/i18n/config";

/**
 * Formulario de contacto con respuesta inmediata (mismo criterio que el del boletín: nadie se queda
 * mirando una pantalla quieta preguntándose si el botón sirvió). Sin JavaScript funciona igual,
 * porque el `action` y el `method` siguen ahí.
 */

type Textos = {
  name: string;
  email: string;
  subject: string;
  message: string;
  send: string;
  sending: string;
  thanks: string;
  invalid: string;
  mailDown: string;
  namePlaceholder: string;
  emailPlaceholder: string;
  subjectPlaceholder: string;
  messagePlaceholder: string;
};

const campo =
  "mt-1 w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink outline-none ring-accent focus:ring-4";

export function FormularioContacto({ lang, t }: { lang: Lang; t: Textos }) {
  const [estado, setEstado] = useState<"idle" | "enviando">("idle");
  const [aviso, setAviso] = useState<{ texto: string; bueno: boolean } | null>(null);

  const respuestas: Record<string, { texto: string; bueno: boolean }> = {
    gracias: { texto: t.thanks, bueno: true },
    invalido: { texto: t.invalid, bueno: false },
    sincorreo: { texto: t.mailDown, bueno: false },
    error: { texto: t.mailDown, bueno: false },
  };

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    if (typeof fetch !== "function") return;
    e.preventDefault();
    if (estado === "enviando") return;
    setEstado("enviando");
    setAviso(null);
    try {
      const res = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });
      const data = (await res.json().catch(() => null)) as { estado?: string } | null;
      setAviso(respuestas[data?.estado ?? ""] ?? { texto: t.mailDown, bueno: false });
      if (data?.estado === "gracias") form.reset();
    } catch {
      setAviso({ texto: t.mailDown, bueno: false });
    } finally {
      setEstado("idle");
    }
  }

  return (
    <form
      id="contacto"
      action="/datos/contacto"
      method="post"
      onSubmit={enviar}
      className="mt-6 rounded-2xl border border-line bg-paper p-5 md:p-6"
    >
      <input type="hidden" name="lang" value={lang} />
      {aviso ? (
        <p
          role="status"
          className={`mb-4 rounded-xl px-4 py-3 text-sm font-semibold ${
            aviso.bueno ? "bg-mint text-ink" : "bg-coral text-white"
          }`}
        >
          {aviso.texto}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-ink">
          {t.name}
          <input
            name="nombre"
            required
            maxLength={120}
            autoComplete="name"
            placeholder={t.namePlaceholder}
            className={campo}
          />
        </label>
        <label className="block text-sm font-semibold text-ink">
          {t.email}
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="email"
            placeholder={t.emailPlaceholder}
            className={campo}
          />
        </label>
      </div>
      <label className="mt-4 block text-sm font-semibold text-ink">
        {t.subject}
        <input name="asunto" maxLength={160} placeholder={t.subjectPlaceholder} className={campo} />
      </label>
      <label className="mt-4 block text-sm font-semibold text-ink">
        {t.message}
        <textarea
          name="mensaje"
          required
          rows={6}
          minLength={10}
          maxLength={4000}
          placeholder={t.messagePlaceholder}
          className={campo}
        />
      </label>
      {/* Trampa para robots: una persona no lo ve nunca. Si viene relleno, el mensaje se descarta. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label>
          Web
          <input name="web" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <button
        type="submit"
        disabled={estado === "enviando"}
        aria-busy={estado === "enviando"}
        className="mt-5 h-12 rounded-full bg-accent px-7 text-sm font-extrabold uppercase tracking-wide text-ink hover:brightness-95 disabled:cursor-wait disabled:opacity-70"
      >
        {estado === "enviando" ? t.sending : t.send}
      </button>
    </form>
  );
}
