import { PanelShell } from "@/components/panel/PanelShell";
import { flashFrom, panelDict, requirePanelSession } from "@/lib/panel/server";
import { listOrders, ordersSummary, PLANS } from "@/lib/orders";
import { getSection } from "@/lib/sections";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OrdersPage({ searchParams }: Props) {
  const { env } = await requirePanelSession();
  const { lang, dict } = await panelDict();
  const p = dict.panel.orders;
  const [orders, summary] = await Promise.all([listOrders(env.DB), ordersSummary(env.DB)]);
  const flash = flashFrom(await searchParams);
  const flashText = {
    ok: flash.ok ? ((p as unknown as Record<string, string>)[flash.ok] ?? flash.ok) : undefined,
    error: flash.error,
  };
  return (
    <PanelShell
      lang={lang}
      dict={dict}
      active="orders"
      title={p.title}
      intro={p.intro}
      flash={flashText}
    >
      <div className="grid gap-3 sm:grid-cols-4">
        {(
          [
            [p.newOnes, summary.newCount],
            [p.paidOnes, summary.paid],
            [p.queuedOnes, summary.queued],
            [p.revenue, `$${summary.revenueUsd.toFixed(0)}`],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-2xl bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white">
        {orders.length === 0 ? (
          <p className="p-5 text-sm text-muted">{p.empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2">{p.company}</th>
                <th className="px-4 py-2">{p.plan}</th>
                <th className="px-4 py-2">{p.contact}</th>
                <th className="px-4 py-2">{p.status}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-t border-line align-top">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{o.company}</div>
                    <a
                      href={o.website}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="text-xs text-muted underline"
                    >
                      {o.website}
                    </a>
                    <div className="mt-1 text-xs text-muted">
                      {o.sectionId ? getSection(o.sectionId)?.name[lang] : "—"} ·{" "}
                      {o.createdAt.slice(0, 16).replace("T", " ")}
                    </div>
                    {o.brief ? (
                      <p className="mt-1 max-w-md text-xs text-muted">{o.brief.slice(0, 220)}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{p.plans[o.plan]}</div>
                    <div className="text-xs text-muted">
                      ${o.priceUsd} · {o.notesTotal} {p.notes}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>{o.contactName ?? "—"}</div>
                    <a href={`mailto:${o.email}`} className="underline">
                      {o.email}
                    </a>
                    {o.phone ? (
                      <div>
                        <a
                          href={`https://wa.me/${o.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          {o.phone}
                        </a>
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        o.status === "new"
                          ? "bg-accent/40"
                          : o.status === "paid"
                            ? "bg-mint/30"
                            : o.status === "queued"
                              ? "bg-paper"
                              : "bg-line"
                      }`}
                    >
                      {p.statuses[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-1">
                      {o.status === "new" ? (
                        <form action="/panel/accion/pedidos" method="post">
                          <input type="hidden" name="op" value="paid" />
                          <input type="hidden" name="id" value={o.id} />
                          <button className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-ink">
                            {p.markPaid}
                          </button>
                        </form>
                      ) : null}
                      {(o.status === "paid" || o.status === "new") && !o.sponsorId ? (
                        <form action="/panel/accion/pedidos" method="post">
                          <input type="hidden" name="op" value="queue" />
                          <input type="hidden" name="id" value={o.id} />
                          <button className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">
                            {p.toQueue}
                          </button>
                        </form>
                      ) : null}
                      {o.sponsorId ? (
                        <a
                          href={`/panel/encargos/${o.sponsorId}`}
                          className="rounded-full border border-line px-3 py-1 text-xs font-bold hover:bg-paper"
                        >
                          {p.seeSponsor}
                        </a>
                      ) : null}
                      {o.status !== "canceled" ? (
                        <form action="/panel/accion/pedidos" method="post">
                          <input type="hidden" name="op" value="cancel" />
                          <input type="hidden" name="id" value={o.id} />
                          <button className="rounded-full border border-line px-3 py-1 text-xs font-bold text-coral hover:bg-paper">
                            {p.cancel}
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      <p className="mt-4 text-xs text-muted">
        {p.publicPage}:{" "}
        <a href="/es/publica" className="underline" target="_blank" rel="noopener noreferrer">
          losupe.com/es/publica
        </a>{" "}
        ·{" "}
        <a href="/en/publish" className="underline" target="_blank" rel="noopener noreferrer">
          losupe.com/en/publish
        </a>{" "}
        · {p.planPrices}:{" "}
        {Object.entries(PLANS)
          .map(([k, v]) => `${k} $${v.priceUsd}`)
          .join(" · ")}
      </p>
    </PanelShell>
  );
}
