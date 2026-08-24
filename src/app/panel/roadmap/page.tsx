import { PanelShell } from "@/components/panel/PanelShell";
import { panelDict, requirePanelSession } from "@/lib/panel/server";
import { contarRoadmap, pendientesDeRichard, ROADMAP, type EstadoTarea } from "@/lib/roadmap";

export const metadata = { title: "Roadmap · losupe" };

const ESTILO: Record<EstadoTarea, { fondo: string; punto: string; etiqueta: string }> = {
  hecho: { fondo: "border-line bg-white", punto: "bg-mint", etiqueta: "Hecho" },
  falta: { fondo: "border-coral/50 bg-coral/5", punto: "bg-coral", etiqueta: "Falta" },
  espera: { fondo: "border-accent/60 bg-accent/10", punto: "bg-accent", etiqueta: "Te toca a ti" },
};

export default async function RoadmapPage() {
  await requirePanelSession();
  const { lang, dict } = await panelDict();
  const resumen = contarRoadmap();
  const mios = pendientesDeRichard();

  return (
    <PanelShell lang={lang} dict={dict} active="dashboard" title="Roadmap">
      <p className="-mt-1 mb-5 max-w-3xl text-sm text-muted">
        Dónde está el proyecto y qué falta. En <strong className="text-coral">rojo</strong> lo que
        falta por hacer; en <strong className="text-ink">amarillo</strong>, lo que espera un dato o
        una cuenta tuya. Se actualiza con cada cambio: si aquí dice «hecho», está publicado.
      </p>

      <div className="grid grid-cols-3 gap-3">
        {[
          { n: resumen.hecho, t: "Hecho", c: "text-ink" },
          { n: resumen.falta, t: "Falta", c: "text-coral" },
          { n: resumen.espera, t: "Te toca a ti", c: "text-ink" },
        ].map((x) => (
          <div key={x.t} className="rounded-2xl border border-line bg-white p-4 text-center">
            <p className={`font-display text-3xl font-bold ${x.c}`}>{x.n}</p>
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-muted">{x.t}</p>
          </div>
        ))}
      </div>

      {mios.length > 0 ? (
        <section className="mt-6 rounded-2xl border-2 border-accent bg-accent/10 p-5">
          <h2 className="font-display text-xl font-bold text-ink">
            Lo que hace falta de ti ({mios.length})
          </h2>
          <p className="mt-1 text-sm text-muted">
            Son datos o cuentas que solo tienes tú. Cada uno destraba lo que hay debajo.
          </p>
          <ul className="mt-3 space-y-2">
            {mios.map((t) => (
              <li key={t.titulo} className="rounded-xl bg-white/70 px-4 py-3">
                <p className="font-semibold text-ink">{t.titulo}</p>
                <p className="mt-0.5 text-sm text-muted">{t.detalle}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {ROADMAP.map((bloque) => (
        <section key={bloque.id} className="mt-8">
          <h2 className="font-display text-2xl font-bold text-ink">{bloque.titulo}</h2>
          <p className="mt-1 text-sm text-muted">{bloque.resumen}</p>
          <ul className="mt-4 space-y-2.5">
            {bloque.tareas.map((t) => {
              const e = ESTILO[t.estado];
              return (
                <li key={t.titulo} className={`rounded-2xl border p-4 ${e.fondo}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${e.punto}`} />
                    <p
                      className={`font-semibold ${t.estado === "falta" ? "text-coral" : "text-ink"}`}
                    >
                      {t.titulo}
                    </p>
                    <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted">
                      {e.etiqueta}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{t.detalle}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </PanelShell>
  );
}
