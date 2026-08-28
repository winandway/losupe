import { PanelShell } from "@/components/panel/PanelShell";
import { getDb } from "@/lib/db";
import { panelDict, requirePanelSession } from "@/lib/panel/server";
import { DIAS_DE_HISTORIAL, MINUTOS_EN_LINEA, resumenDeLectores } from "@/lib/lectores";
import { diaLegible, NOMBRE_ORIGEN, resumenDeTrafico, tiempoLegible } from "@/lib/trafico";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tráfico · losupe" };

/** Se refresca sola: es un tablero para mirar, no una página para recargar. */
const REFRESCO = 60;

function Variacion({ v }: { v: number | null }) {
  if (v === null) return null;
  const sube = v >= 0;
  return (
    <span
      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${
        sube ? "bg-mint/40 text-ink" : "bg-coral/20 text-coral"
      }`}
    >
      {sube ? "▲" : "▼"} {Math.abs(v)}%
    </span>
  );
}

export default async function TraficoPage() {
  await requirePanelSession();
  const { lang, dict } = await panelDict();
  const p = dict.panel.traffic;
  const db = await getDb();
  const [t, ahoraMismo] = await Promise.all([resumenDeTrafico(db), resumenDeLectores(db)]);
  const maxDia = Math.max(1, ...t.porDia.map((d) => d.lectores));
  const maxPais = Math.max(1, ...t.paises.map((x) => x.lectores));

  return (
    <PanelShell lang={lang} dict={dict} active="traffic" title={p.title}>
      <meta httpEquiv="refresh" content={String(REFRESCO)} />

      <section className="rounded-2xl border-2 border-mint bg-mint/10 p-5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-4 w-4">
            {ahoraMismo.enLinea > 0 ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-75" />
            ) : null}
            <span
              className={`relative inline-flex h-4 w-4 rounded-full ${ahoraMismo.enLinea > 0 ? "bg-mint" : "bg-line"}`}
            />
          </span>
          <p className="font-display text-3xl font-bold text-ink">
            {ahoraMismo.enLinea}{" "}
            <span className="text-lg font-semibold text-muted">{p.online}</span>
          </p>
        </div>
        <p className="mt-1 text-sm text-muted">
          {p.onlineHint.replace("{min}", String(MINUTOS_EN_LINEA))}
        </p>
      </section>

      {/* LOS PERIODOS, cada uno comparado con el anterior. */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {t.periodos.map((x) => (
          <div key={x.clave} className="rounded-2xl border border-line bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">{x.etiqueta}</p>
            <p className="mt-1 flex items-baseline font-display text-3xl font-bold text-ink">
              {x.lectores}
              <Variacion v={x.variacion} />
            </p>
            <p className="text-sm text-muted">
              {p.readers} · {x.lecturas} {p.readings}
            </p>
            <p className="mt-1 text-xs text-muted">
              {p.avgTime}: <strong className="text-ink">{tiempoLegible(x.tiempoMedio)}</strong>
            </p>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl font-bold text-ink">{p.byDay}</h2>
        {t.porDia.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{p.empty}</p>
        ) : (
          <div className="mt-4 flex h-36 items-end gap-1 overflow-x-auto">
            {t.porDia.map((d) => (
              <div key={d.dia} className="flex min-w-[18px] flex-1 flex-col items-center gap-1">
                <span
                  className="w-full rounded-t bg-ink"
                  style={{ height: `${Math.max(3, Math.round((d.lectores / maxDia) * 100))}%` }}
                  title={`${diaLegible(d.dia)} — ${d.lectores} ${p.readers}`}
                />
                <span className="text-[10px] leading-none text-muted">{d.dia.slice(8)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-display text-xl font-bold text-ink">{p.origins}</h2>
          <p className="mt-1 text-xs text-muted">{p.originsHint}</p>
          {t.origenes.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{p.empty}</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {t.origenes.map((o) => (
                <li key={o.origen}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-ink">{NOMBRE_ORIGEN[o.origen]}</span>
                    <span className="text-muted">
                      {o.lectores} · {o.porcentaje}%
                    </span>
                  </div>
                  <span className="mt-1 block h-2.5 overflow-hidden rounded-full bg-paper">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${o.porcentaje}%` }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {t.referentes.length > 0 ? (
            <>
              <h3 className="mt-5 text-xs font-bold uppercase tracking-wide text-muted">
                {p.referrers}
              </h3>
              <ul className="mt-2 space-y-1 text-sm">
                {t.referentes.map((r) => (
                  <li key={r.referente} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate text-muted">{r.referente}</span>
                    <span className="shrink-0 font-bold text-ink">{r.lectores}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-display text-xl font-bold text-ink">{p.countries}</h2>
          {t.paises.length === 0 ? (
            <p className="mt-2 text-sm text-muted">{p.empty}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {t.paises.map((x) => (
                <li key={x.pais} className="flex items-center gap-3">
                  <span className="w-7 text-xl" aria-hidden="true">
                    {x.bandera}
                  </span>
                  <span className="w-32 shrink-0 truncate text-sm font-semibold text-ink">
                    {x.nombre}
                  </span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${Math.round((x.lectores / maxPais) * 100)}%` }}
                    />
                  </span>
                  <span className="w-8 text-right text-sm font-bold text-ink">{x.lectores}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl font-bold text-ink">{p.mostRead}</h2>
        <p className="mt-1 text-xs text-muted">{p.mostReadHint}</p>
        {t.masLeidas.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{p.empty}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-bold">{p.page}</th>
                  <th className="py-2 pr-3 text-right font-bold">{p.readers}</th>
                  <th className="py-2 pr-3 text-right font-bold">{p.readings}</th>
                  <th className="py-2 text-right font-bold">{p.avgTime}</th>
                </tr>
              </thead>
              <tbody>
                {t.masLeidas.map((m) => (
                  <tr key={m.ruta} className="border-b border-line/60">
                    <td className="max-w-0 py-2 pr-3">
                      <a
                        href={m.ruta}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate hover:underline"
                      >
                        {m.ruta}
                      </a>
                    </td>
                    <td className="py-2 pr-3 text-right font-bold text-ink">{m.lectores}</td>
                    <td className="py-2 pr-3 text-right text-muted">{m.lecturas}</td>
                    <td className="py-2 text-right text-muted">{tiempoLegible(m.tiempoMedio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-6 text-xs leading-relaxed text-muted">
        {p.privacy.replace("{dias}", String(DIAS_DE_HISTORIAL))}
        {t.total.desde ? ` ${p.since.replace("{fecha}", diaLegible(t.total.desde))}` : ""}
      </p>
    </PanelShell>
  );
}
