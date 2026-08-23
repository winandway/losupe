import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CampoClave } from "@/components/panel/CampoClave";
import { Logo } from "@/components/Logo";
import { getSession, SESSION_COOKIE } from "@/lib/panel/auth";
import { flashFrom, panelDict, panelEnv } from "@/lib/panel/server";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Entrada al panel. Turnstile solo se dibuja si hay llave de sitio (sin llaves, el login funciona igual). */
export default async function PanelLoginPage({ searchParams }: Props) {
  const env = await panelEnv();
  const jar = await cookies();
  if (await getSession(env.DB, jar.get(SESSION_COOKIE)?.value)) redirect("/panel");
  const { dict } = await panelDict();
  const p = dict.panel;
  const { error } = flashFrom(await searchParams);
  const messages: Record<string, string> = {
    wrong: p.login.wrong,
    too_many: p.login.tooMany,
    not_configured: p.login.notConfigured,
    turnstile: p.login.turnstileFailed,
  };
  const siteKey = env.TURNSTILE_SITE_KEY;
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <Logo id="losupe-mark-login" />
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
            Panel
          </span>
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink">{p.login.title}</h1>
        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-coral bg-coral/10 px-3 py-2 text-sm font-semibold text-ink"
          >
            {messages[error] ?? p.flash.error}
          </p>
        ) : null}
        <form action="/panel/accion/entrar" method="post" className="mt-4 space-y-4">
          <CampoClave
            label={p.login.password}
            showLabel={p.login.showPassword}
            hideLabel={p.login.hidePassword}
          />
          {siteKey ? (
            <>
              <div className="cf-turnstile" data-sitekey={siteKey} data-theme="light" />
              <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
            </>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-ink-2"
          >
            {p.login.button}
          </button>
        </form>
      </div>
    </div>
  );
}
