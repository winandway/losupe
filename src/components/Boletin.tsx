import type { Lang } from "@/i18n/config";
import type { Dict } from "@/i18n/es";
import { BoletinForm } from "./BoletinForm";
import { crearPase } from "@/lib/anti-bots";
import { getDb } from "@/lib/db";

/**
 * Alta al aviso de notas nuevas. Funciona sin JavaScript (formulario normal) y no apunta a nadie
 * sin que confirme desde su correo.
 */
export async function Boletin({ lang, dict, state }: { lang: Lang; dict: Dict; state?: string }) {
  const pase = await crearPase(await getDb()).catch(() => "");
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
        <BoletinForm
          pase={pase}
          lang={lang}
          t={{
            placeholder: b.placeholder,
            button: b.button,
            sending: b.sending,
            checkInbox: b.checkInbox,
            already: b.already,
            invalid: b.invalid,
            mailDown: b.mailDown,
          }}
        />
        <p className="mt-3 text-xs text-white/60">{b.legal}</p>
      </div>
    </section>
  );
}
