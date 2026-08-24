import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";

/**
 * Alta al aviso de notas nuevas. Funciona sin JavaScript (formulario normal) y no apunta a nadie
 * sin que confirme desde su correo.
 */
export function Boletin({ lang, dict, state }: { lang: Lang; dict: Dict; state?: string }) {
  const b = dict.newsletter;
  const mensajes: Record<string, string> = {
    revisa: b.checkInbox,
    confirmado: b.confirmed,
    yaestabas: b.already,
    baja: b.removed,
    invalido: b.invalid,
    sincorreo: b.mailDown,
  };
  const mensaje = state ? mensajes[state] : undefined;
  const bueno = state === "confirmado" || state === "revisa" || state === "yaestabas";

  return (
    <section
      id="boletin"
      className="mt-12 rounded-2xl bg-ink px-5 py-7 text-white md:px-8 md:py-9"
      aria-label={b.title}
    >
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-2xl font-bold md:text-3xl">{b.title}</h2>
        <p className="mt-2 text-sm text-white/75 md:text-base">{b.intro}</p>
        {mensaje ? (
          <p
            role="status"
            className={`mx-auto mt-4 max-w-md rounded-xl px-4 py-2.5 text-sm font-semibold ${
              bueno ? "bg-mint text-ink" : "bg-coral text-white"
            }`}
          >
            {mensaje}
          </p>
        ) : null}
        <form
          action="/datos/boletin"
          method="post"
          className="mx-auto mt-5 flex max-w-md flex-col gap-2 sm:flex-row"
        >
          <input type="hidden" name="lang" value={lang} />
          <label htmlFor="boletin-email" className="sr-only">
            {b.placeholder}
          </label>
          <input
            id="boletin-email"
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="email"
            placeholder={b.placeholder}
            className="h-12 w-full min-w-0 rounded-full border-0 bg-white px-5 text-base text-ink outline-none ring-accent focus:ring-4"
          />
          <button
            type="submit"
            className="h-12 shrink-0 rounded-full bg-accent px-6 text-sm font-extrabold uppercase tracking-wide text-ink hover:brightness-95"
          >
            {b.button}
          </button>
        </form>
        <p className="mt-3 text-xs text-white/60">{b.legal}</p>
      </div>
    </section>
  );
}
