import { PanelShell } from "@/components/panel/PanelShell";
import { getDb } from "@/lib/db";
import { panelDict, requirePanelSession } from "@/lib/panel/server";
import {
  bandera,
  DIAS_DE_HISTORIAL,
  MINUTOS_EN_LINEA,
  nombreDePais,
  resumenDeLectores,
} from "@/lib/lectores";

export const dynamic = "force-dynamic";
export const metadata = { title: "Lectores · losupe" };

/** Se refresca sola cada 30 segundos: es un tablero para mirar, no una página para recargar. */
const REFRESCO = 30;

export default async function LectoresPage() {
  await requirePanelSession();
  const { lang, dict } = await panelDict();
  const p = dict.panel.readers;
  const r = await resumenDeLectores(await getDb());
  const maxHora = Math.max(1, ...r.porHora.map((h) => h.lectores));
  const maxPais = Math.max(1, ...r.paises.map((x) => x.lectores));

  return (
    <PanelShell lang={lang} dict={dict} active="readers" title={p.title}>
      <meta httpEquiv="refresh" content={String(REFRESCO)} />

      {/* EN LÍNEA AHORA. El punto verde late solo mientras haya alguien leyendo. */}
      <section className="rounded-2xl border-2 border-mint bg-mint/10 p-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-4 w-4">
            {r.enLinea > 0 ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
            ) : null}
            <span
              className={`relative inline-flex h-4 w-4 rounded-full ${r.enLinea > 0 ? "bg-mint" : "bg-line"}`}
            />
          </span>
          <p className="font-display text-3xl font-bold text-ink">
            {r.enLinea}{" "}
            <span className="text-lg font-semibold text-muted">
              {r.enLinea === 1 ? p.onlineOne : p.online}
            </span>
          </p>
        </div>
        <p className="mt-1 text-sm text-muted">
          {p.onlineHint.replace("{min}", String(MINUTOS_EN_LINEA))}
        </p>
      </section>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { t: p.today, d: r.hoy },
          { t: p.week, d: r.semana },
          { t: p.month, d: r.mes },
        ].map((x) => (
          <div key={x.t} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{x.t}</p>
            <p className="mt-1 font-display text-3xl font-bold text-ink">{x.d.lectores}</p>
            <p className="text-sm text-muted">
              {p.readers} · {x.d.visitas} {p.views}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl font-bold text-ink">{p.countries}</h2>
        {r.paises.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{p.empty}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {r.paises.map((x) => (
              <li key={x.pais} className="flex items-center gap-3">
                <span className="w-7 text-xl" aria-hidden="true">
                  {bandera(x.pais)}
                </span>
                <span className="w-40 shrink-0 truncate text-sm font-semibold text-ink">
                  {nombreDePais(x.pais)}
                </span>
                <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${Math.round((x.lectores / maxPais) * 100)}%` }}
                  />
                </span>
                <span className="w-10 text-right text-sm font-bold text-ink">{x.lectores}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-display text-xl font-bold text-ink">{p.mostRead}</h2>
          {r.masLeidas.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{p.empty}</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {r.masLeidas.map((m, i) => (
                <li key={m.ruta} className="flex items-baseline gap-2 text-sm">
                  <span className="w-5 shrink-0 font-bold text-muted">{i + 1}.</span>
                  <a
                    href={m.ruta}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    {m.ruta}
                  </a>
                  <span className="shrink-0 font-bold text-ink">{m.visitas}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-display text-xl font-bold text-ink">{p.byHour}</h2>
          <p className="mt-1 text-xs text-muted">{p.byHourHint}</p>
          <div className="mt-4 flex h-32 items-end gap-1">
            {Array.from({ length: 24 }, (_, h) => {
              const v = r.porHora.find((x) => x.hora === h)?.lectores ?? 0;
              return (
                <div key={h} className="flex flex-1 flex-col items-center gap-1">
                  <span
                    className={`w-full rounded-t ${v > 0 ? "bg-ink" : "bg-paper"}`}
                    style={{ height: `${Math.max(2, Math.round((v / maxHora) * 100))}%` }}
                    title={`${h}:00 — ${v}`}
                  />
                  {h % 6 === 0 ? <span className="text-[10px] text-muted">{h}</span> : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <p className="mt-6 text-xs leading-relaxed text-muted">
        {p.privacy.replace("{dias}", String(DIAS_DE_HISTORIAL))}
      </p>
    </PanelShell>
  );
}
