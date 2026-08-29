import Link from "next/link";
import { PanelShell } from "@/components/panel/PanelShell";
import { flashFrom, panelDict, requirePanelSession } from "@/lib/panel/server";
import { robotStatus } from "@/lib/robot/pipeline";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Dot({ ok }: { ok: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2.5 w-2.5 rounded-full ${ok ? "bg-mint" : "bg-coral"}`}
    />
  );
}

export default async function PanelHome({ searchParams }: Props) {
  const { env } = await requirePanelSession();
  const { lang, dict } = await panelDict();
  const p = dict.panel;
  const status = await robotStatus(env);
  const sp = await searchParams;
  const flash = flashFrom(sp);
  const flashText = {
    ok: flash.ok ? ((p.flash as Record<string, string>)[flash.ok] ?? flash.ok) : undefined,
    error: flash.error ? `${p.flash.error}: ${flash.error}` : undefined,
  };
  const summary = status.lastRun?.summary as
    | {
        reason?: string;
        notes?: {
          kind: string;
          ok: boolean;
          title?: string;
          path?: string;
          status?: string;
          error?: string;
          sponsor?: string;
        }[];
      }
    | null
    | undefined;

  return (
    <PanelShell
      lang={lang}
      dict={dict}
      active="dashboard"
      title={p.dashboard.title}
      intro={p.dashboard.howItWorks}
      flash={flashText}
      actions={
        <form action="/panel/accion/robot" method="post">
          <input type="hidden" name="op" value={status.paused ? "resume" : "pause"} />
          <button
            type="submit"
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              status.paused ? "bg-mint text-ink" : "bg-ink text-white"
            }`}
          >
            {status.paused ? p.dashboard.resume : p.dashboard.pause}
          </button>
        </form>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card title={p.dashboard.status}>
          <p className="flex items-center gap-2 text-lg font-bold">
            <Dot ok={!status.paused} /> {status.paused ? p.dashboard.paused : p.dashboard.running}
          </p>
          <p className="mt-1 flex items-center gap-2 text-sm">
            <Dot ok={status.missing.length === 0} />
            {status.missing.length === 0 ? p.dashboard.ready : p.dashboard.notReady}
          </p>
          {status.missing.length > 0 ? (
            <ul className="mt-2 space-y-1 text-sm text-coral">
              {status.missing.map((m) => (
                <li key={m}>
                  {p.dashboard.missing}: <code className="rounded bg-paper px-1">{m}</code>
                </li>
              ))}
            </ul>
          ) : null}
          <form action="/panel/accion/robot" method="post" className="mt-4">
            <input type="hidden" name="op" value="run" />
            <button
              type="submit"
              className="rounded-full bg-accent px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-ink hover:brightness-95"
            >
              {p.dashboard.runNow}
            </button>
          </form>
        </Card>

        <Card title={p.dashboard.keys}>
          <ul className="space-y-1.5 text-sm">
            {(
              [
                ["GEMINI_API_KEY", status.keys.gemini],
                ["FAL_KEY", status.keys.fal],
                ["PEXELS_API_KEY", status.keys.pexels],
                ["BRAVE_API_KEY", status.keys.brave],
                ["ADMIN_PASSWORD", status.keys.admin],
              ] as const
            ).map(([k, ok]) => (
              <li key={k} className="flex items-center gap-2">
                <Dot ok={ok} />
                <code className="rounded bg-paper px-1">{k}</code>
                <span className="text-muted">{ok ? p.dashboard.present : p.dashboard.absent}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={p.dashboard.budget}>
          <p className="text-2xl font-bold">
            ${status.budget.spentTodayUsd.toFixed(3)}{" "}
            <span className="text-base font-semibold text-muted">
              {p.dashboard.of} ${status.budget.limitUsd.toFixed(2)}
            </span>
          </p>
          <p className="mt-2 text-sm text-muted">
            {p.dashboard.quota}: <strong className="text-ink">{status.quota.today}</strong>{" "}
            {p.dashboard.of} {status.quota.notesPerDay}
          </p>
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {p.dashboard.schedule}
            </p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {status.horario.franjas.map((f) => {
                const hecha = status.horario.turnoHecho?.endsWith(`:${f.key}`) ?? false;
                const abierta = status.horario.franjaAbierta === f.key;
                return (
                  <li
                    key={f.key}
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      hecha ? "bg-mint/30" : abierta ? "bg-accent text-ink" : "bg-paper text-muted"
                    }`}
                  >
                    {f.nombre}
                    {hecha ? " ✓" : abierta ? " ●" : ""}
                    <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-70">
                      {f.genero}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5 text-xs text-muted">
              {p.dashboard.scheduleHint.replace("{hora}", status.horario.ahora)}
            </p>
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <Dot ok={status.autoPublish} />
            {p.dashboard.autoPublish}:{" "}
            {status.autoPublish ? p.dashboard.autoOn : p.dashboard.autoOff}
          </p>
          <form action="/panel/accion/robot" method="post" className="mt-3">
            <input type="hidden" name="op" value={status.autoPublish ? "auto_off" : "auto_on"} />
            <button
              type="submit"
              className="rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink hover:bg-paper"
            >
              {status.autoPublish ? p.dashboard.autoToggleOff : p.dashboard.autoToggleOn}
            </button>
          </form>
        </Card>

        <Card title={p.dashboard.queue}>
          <p className="text-sm">
            <strong>{status.queue.sponsorsActive}</strong> {p.dashboard.sponsorsActive} ·{" "}
            <strong>{status.queue.queued}</strong> {p.dashboard.queued} ·{" "}
            <strong>{status.queue.inReview}</strong> {p.dashboard.inReview}
          </p>
          <p className="mt-2 text-sm text-muted">
            {p.dashboard.next}:{" "}
            {status.queue.nextTitle ? (
              <strong className="text-ink">
                {status.queue.nextTitle}
                {status.queue.nextSponsor ? ` — ${status.queue.nextSponsor}` : ""}
              </strong>
            ) : (
              p.dashboard.none
            )}
          </p>
          <Link
            href="/panel/encargos"
            className="mt-3 inline-block text-sm font-bold text-ink hover:underline"
          >
            {p.nav.sponsors} →
          </Link>
        </Card>

        <Card title={p.dashboard.settings}>
          <form action="/panel/accion/robot" method="post" className="grid gap-3 text-sm">
            <input type="hidden" name="op" value="settings" />
            <label className="block font-semibold">
              {p.dashboard.notesPerDay}
              <input
                name="notesPerDay"
                type="number"
                min={1}
                max={24}
                defaultValue={status.quota.notesPerDay}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 font-normal"
              />
            </label>
            <label className="block font-semibold">
              {p.dashboard.ownPieces}
              <input
                name="mesaRatioPropias"
                type="number"
                min={0}
                max={100}
                step={10}
                defaultValue={Math.round(status.mesa.ratioPropias * 100)}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 font-normal"
              />
              <span className="mt-1 block text-xs font-normal text-muted">
                {p.dashboard.ownPiecesHint}
              </span>
            </label>
            <label className="block font-semibold">
              {p.dashboard.evergreenShare}
              <input
                name="evergreenPercent"
                type="number"
                min={0}
                max={100}
                step={10}
                defaultValue={Math.round(status.evergreenRatio * 100)}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 font-normal"
              />
            </label>
            <label className="block font-semibold">
              {p.sponsors.gap}
              <input
                name="sponsorGapHours"
                type="number"
                min={0}
                max={720}
                defaultValue={status.sponsorPace.gapHours}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 font-normal"
              />
            </label>
            <label className="block font-semibold">
              {p.sponsors.maxWeek}
              <input
                name="sponsorMaxPerWeek"
                type="number"
                min={1}
                max={14}
                defaultValue={status.sponsorPace.maxPerWeek}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 font-normal"
              />
            </label>
            <label className="block font-semibold">
              {p.dashboard.dailyBudget}
              <input
                name="dailyBudget"
                type="number"
                min={0}
                max={10}
                step={0.25}
                defaultValue={status.budget.limitUsd}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 font-normal"
              />
            </label>
            <div>
              <button
                type="submit"
                className="rounded-full border border-line px-4 py-2 text-xs font-bold text-ink hover:bg-paper"
              >
                {p.dashboard.saveSettings}
              </button>
            </div>
          </form>
        </Card>

        <Card title={p.mailSettings.title}>
          <p className="text-xs text-muted">{p.mailSettings.intro}</p>
          <p className="mt-2 flex items-center gap-2 text-sm">
            <Dot ok={status.mail.configured} />
            {status.mail.configured ? p.mailSettings.ready : p.mailSettings.missing}
          </p>
          <form action="/panel/accion/correos" method="post" className="mt-3">
            <input type="hidden" name="op" value="save" />
            <label className="block text-sm font-semibold">
              {p.mailSettings.emails}
              <textarea
                name="emails"
                rows={3}
                defaultValue={status.mail.recipients.join("\n")}
                className="mt-1 w-full rounded-xl border border-line px-3 py-2 text-sm font-normal"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="submit"
                className="rounded-full border border-line px-4 py-2 text-xs font-bold text-ink hover:bg-paper"
              >
                {p.mailSettings.save}
              </button>
            </div>
          </form>
          {/* Los suscriptores por estado. Sin esto no se entiende por qué un aviso «no llega a
              nadie»: quien no toca el enlace de su correo no recibe nada, y eso era invisible. */}
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {p.mailSettings.subscribers}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
              <li className="rounded-full bg-mint/30 px-2.5 py-1">
                {status.subscribers.confirmed} {p.mailSettings.confirmed}
              </li>
              <li className="rounded-full bg-accent/40 px-2.5 py-1">
                {status.subscribers.pending} {p.mailSettings.pending}
              </li>
              {status.subscribers.withError > 0 ? (
                <li className="rounded-full bg-coral/20 px-2.5 py-1 text-coral">
                  {status.subscribers.withError} {p.mailSettings.failed}
                </li>
              ) : null}
            </ul>
            {status.subscribers.pending > 0 ? (
              <p className="mt-1.5 text-xs text-muted">{p.mailSettings.pendingHint}</p>
            ) : null}
          </div>
          {/* El boletín de resumen: uno cada pocos días con lo mejor, en vez de un correo por nota. */}
          <div className="mt-4 border-t border-line pt-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {p.mailSettings.digest}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm">
              <Dot ok={status.boletin.activo} />
              {status.boletin.activo
                ? p.mailSettings.digestEvery.replace("{n}", String(status.boletin.cada))
                : p.mailSettings.digestOff}
            </p>
            {status.boletin.activo ? (
              <p className="mt-1 text-xs text-muted">
                {status.boletin.ultimo
                  ? p.mailSettings.digestNext.replace("{fecha}", status.boletin.proximo ?? "—")
                  : p.mailSettings.digestFirst}
              </p>
            ) : null}
          </div>
          <form action="/panel/accion/correos" method="post" className="mt-3">
            <input type="hidden" name="op" value="test" />
            <button
              type="submit"
              className="rounded-full bg-ink px-4 py-2 text-xs font-bold text-white hover:bg-ink-2"
            >
              {p.mailSettings.test}
            </button>
          </form>
        </Card>

        <Card title={p.dashboard.lastRun}>
          {status.lastRun ? (
            <div className="text-sm">
              <p>
                <Dot ok={status.lastRun.status === "done"} />{" "}
                <strong>{status.lastRun.status}</strong> · {status.lastRun.trigger} ·{" "}
                <time dateTime={status.lastRun.startedAt}>
                  {status.lastRun.startedAt.replace("T", " ").slice(0, 16)} UTC
                </time>
              </p>
              {summary?.reason ? <p className="mt-1 text-muted">{summary.reason}</p> : null}
              {status.lastRun.error ? (
                <p className="mt-1 font-semibold text-coral">{status.lastRun.error}</p>
              ) : null}
              {summary?.notes && summary.notes.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {summary.notes.map((n, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Dot ok={n.ok} />
                      <span>
                        <span className="font-semibold">
                          {n.kind === "sponsored" ? p.notes.sponsored : p.notes.universal}
                          {n.sponsor ? ` (${n.sponsor})` : ""}:
                        </span>{" "}
                        {n.ok && n.path ? (
                          <a
                            href={n.path}
                            className="underline"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {n.title}
                          </a>
                        ) : (
                          <span className="text-coral">{n.error}</span>
                        )}
                        {n.status ? <span className="text-muted"> · {n.status}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">{p.dashboard.never}</p>
          )}
        </Card>
      </div>
    </PanelShell>
  );
}
