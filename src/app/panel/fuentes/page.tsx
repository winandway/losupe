import { PanelShell } from "@/components/panel/PanelShell";
import { flashFrom, panelDict, requirePanelSession } from "@/lib/panel/server";
import type { SourceRow } from "@/lib/robot/universal";
import { getSection, SECTIONS } from "@/lib/sections";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SourcesPage({ searchParams }: Props) {
  const { env } = await requirePanelSession();
  const { lang, dict } = await panelDict();
  const p = dict.panel.sources;
  const { results } = await env.DB.prepare(
    `SELECT * FROM sources ORDER BY section_id, active DESC, name`,
  ).all<SourceRow & { last_ok_at: string | null; last_error: string | null }>();
  const flash = flashFrom(await searchParams);
  const flashText = {
    ok: flash.ok ? ((p as unknown as Record<string, string>)[flash.ok] ?? flash.ok) : undefined,
    error: flash.error,
  };
  const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm";
  return (
    <PanelShell
      lang={lang}
      dict={dict}
      active="sources"
      title={p.title}
      intro={p.intro}
      flash={flashText}
    >
      <section className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="bg-paper text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-2">{p.name}</th>
              <th className="px-4 py-2">{p.section}</th>
              <th className="px-4 py-2">{p.lang}</th>
              <th className="px-4 py-2">{p.weight}</th>
              <th className="px-4 py-2">{p.lastOk}</th>
              <th className="px-4 py-2">{p.active}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((s) => (
              <tr key={s.id} className={`border-t border-line ${s.active ? "" : "opacity-60"}`}>
                <td className="px-4 py-2">
                  <div className="font-semibold">{s.name}</div>
                  <div className="max-w-xs truncate text-xs text-muted" title={s.url}>
                    {s.url}
                  </div>
                  {s.last_error ? (
                    <div className="text-xs font-semibold text-coral">
                      {p.lastError}: {s.last_error}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-2">
                  {getSection(s.section_id)?.name[lang] ?? s.section_id}
                </td>
                <td className="px-4 py-2 uppercase">{s.lang}</td>
                <td className="px-4 py-2">{s.weight}</td>
                <td className="px-4 py-2 text-xs text-muted">
                  {s.last_ok_at ? s.last_ok_at.slice(0, 16).replace("T", " ") : "—"}
                </td>
                <td className="px-4 py-2">
                  <form action="/panel/accion/fuentes" method="post">
                    <input type="hidden" name="op" value="toggle" />
                    <input type="hidden" name="id" value={s.id} />
                    <button className="rounded-full border border-line px-3 py-1 text-xs font-bold hover:bg-paper">
                      {s.active ? p.toggleOff : p.toggleOn}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl font-bold">{p.add}</h2>
        <form
          action="/panel/accion/fuentes"
          method="post"
          className="mt-3 grid gap-3 md:grid-cols-4"
        >
          <input type="hidden" name="op" value="add" />
          <label className="block text-sm font-semibold md:col-span-1">
            {p.name}
            <input name="name" required maxLength={120} className={input} />
          </label>
          <label className="block text-sm font-semibold md:col-span-2">
            {p.url}
            <input name="url" type="url" required className={input} placeholder="https://" />
          </label>
          <label className="block text-sm font-semibold">
            {p.section}
            <select name="sectionId" className={input}>
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name[lang]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            {p.lang}
            <select name="lang" className={input}>
              <option value="es">ES</option>
              <option value="en">EN</option>
            </select>
          </label>
          <label className="block text-sm font-semibold">
            {p.weight}
            <input name="weight" type="number" min={1} max={5} defaultValue={1} className={input} />
          </label>
          <div className="flex items-end md:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-ink-2"
            >
              {p.add}
            </button>
          </div>
        </form>
      </section>
    </PanelShell>
  );
}
