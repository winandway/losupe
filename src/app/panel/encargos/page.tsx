import Link from "next/link";
import { PanelShell } from "@/components/panel/PanelShell";
import { SponsorForm } from "@/components/panel/SponsorForm";
import { flashFrom, panelDict, requirePanelSession } from "@/lib/panel/server";
import { listSponsors } from "@/lib/robot/queue";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SponsorsPage({ searchParams }: Props) {
  const { env } = await requirePanelSession();
  const { lang, dict } = await panelDict();
  const p = dict.panel.sponsors;
  const sponsors = await listSponsors(env.DB);
  const flash = flashFrom(await searchParams);
  const flashText = {
    ok: flash.ok ? ((p as unknown as Record<string, string>)[flash.ok] ?? flash.ok) : undefined,
    error: flash.error
      ? ((p as unknown as Record<string, string>)[flash.error] ?? flash.error)
      : undefined,
  };
  return (
    <PanelShell
      lang={lang}
      dict={dict}
      active="sponsors"
      title={p.title}
      intro={p.intro}
      flash={flashText}
    >
      <section className="overflow-x-auto rounded-2xl border border-line bg-white">
        {sponsors.length === 0 ? (
          <p className="p-5 text-sm text-muted">{p.empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-paper text-left text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-2">{p.name}</th>
                <th className="px-4 py-2">{p.status}</th>
                <th className="px-4 py-2">{p.notesTotal}</th>
                <th className="px-4 py-2">{p.published}</th>
                <th className="px-4 py-2">{p.queuedShort}</th>
                <th className="px-4 py-2">{p.remaining}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {sponsors.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-4 py-2 font-semibold">
                    <Link href={`/panel/encargos/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                    <div className="text-xs font-normal text-muted">{s.website}</div>
                  </td>
                  <td className="px-4 py-2">{p.statuses[s.status]}</td>
                  <td className="px-4 py-2">{s.notesTotal}</td>
                  <td className="px-4 py-2">{s.published}</td>
                  <td className="px-4 py-2">{s.queued}</td>
                  <td className="px-4 py-2 font-bold">{s.remaining}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/panel/encargos/${s.id}`}
                      className="rounded-full border border-line px-3 py-1 text-xs font-bold hover:bg-paper"
                    >
                      {p.view}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl font-bold">{p.new}</h2>
        <div className="mt-4">
          <SponsorForm lang={lang} dict={dict} />
        </div>
      </section>
    </PanelShell>
  );
}
