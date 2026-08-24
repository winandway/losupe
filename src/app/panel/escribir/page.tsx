import { PanelShell } from "@/components/panel/PanelShell";
import { flashFrom, panelDict, requirePanelSession } from "@/lib/panel/server";
import { listWriters } from "@/lib/queries";
import { SECTIONS } from "@/lib/sections";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const field =
  "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-accent";

export default async function WritePage({ searchParams }: Props) {
  const { env } = await requirePanelSession();
  const { lang, dict } = await panelDict();
  const p = dict.panel.write;
  const writers = await listWriters(env.DB, lang);
  const sp = await searchParams;
  const flash = flashFrom(sp);
  const creada = typeof sp.nota === "string" ? sp.nota : undefined;

  return (
    <PanelShell
      lang={lang}
      dict={dict}
      active="write"
      title={p.title}
      intro={p.intro}
      flash={{
        ok: flash.ok === "created" ? p.created : undefined,
        error: flash.error ? `${p.failed}: ${decodeURIComponent(flash.error)}` : undefined,
      }}
    >
      {creada ? (
        <p className="mb-5 rounded-xl border border-mint bg-mint/15 px-4 py-3 text-sm">
          <a
            href={creada}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline"
          >
            Ver la nota →
          </a>
        </p>
      ) : null}

      <form action="/panel/accion/escribir" method="post" className="grid gap-5">
        <fieldset className="rounded-2xl border border-line bg-white p-5">
          <legend className="px-2 text-xs font-bold uppercase tracking-widest text-muted">
            {p.mode}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 has-[:checked]:border-accent has-[:checked]:bg-accent/10">
              <input type="radio" name="modo" value="ia" defaultChecked className="mt-1" />
              <span>
                <span className="block text-sm font-bold">{p.modeIa}</span>
                <span className="mt-1 block text-xs text-muted">{p.modeIaHint}</span>
              </span>
            </label>
            <label className="flex cursor-pointer gap-3 rounded-xl border border-line p-3 has-[:checked]:border-accent has-[:checked]:bg-accent/10">
              <input type="radio" name="modo" value="propio" className="mt-1" />
              <span>
                <span className="block text-sm font-bold">{p.modeOwn}</span>
                <span className="mt-1 block text-xs text-muted">{p.modeOwnHint}</span>
              </span>
            </label>
          </div>
        </fieldset>

        <div className="rounded-2xl border border-line bg-white p-5">
          <label className="block text-sm font-semibold">
            {p.headline}
            <input name="titulo" required minLength={6} maxLength={200} className={field} />
            <span className="mt-1 block text-xs font-normal text-muted">{p.headlineHint}</span>
          </label>
          <label className="mt-4 block text-sm font-semibold">
            {p.body}
            <textarea
              name="cuerpo"
              required
              rows={12}
              minLength={40}
              maxLength={30000}
              className={field}
            />
            <span className="mt-1 block text-xs font-normal text-muted">{p.bodyHint}</span>
          </label>
          <label className="mt-4 block text-sm font-semibold">
            {p.sources}
            <textarea
              name="fuentes"
              rows={3}
              maxLength={2000}
              className={field}
              placeholder="https://www.reuters.com/... Reuters"
            />
            <span className="mt-1 block text-xs font-normal text-muted">{p.sourcesHint}</span>
          </label>
        </div>

        <div className="grid gap-4 rounded-2xl border border-line bg-white p-5 sm:grid-cols-2">
          <label className="block text-sm font-semibold">
            {p.section}
            <select name="sectionId" defaultValue="economia" className={field}>
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name[lang]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            {p.kind}
            <select name="kind" defaultValue="news" className={field}>
              <option value="news">{p.kindNews}</option>
              <option value="evergreen">{p.kindEvergreen}</option>
            </select>
          </label>
          <label className="block text-sm font-semibold">
            {p.author}
            <select name="autorId" defaultValue="" className={field}>
              <option value="">{p.authorAuto}</option>
              {writers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            {p.publish}
            <select name="publicar" defaultValue="no" className={field}>
              <option value="no">{p.publishNo}</option>
              <option value="si">{p.publishYes}</option>
            </select>
          </label>
        </div>

        <div>
          <button
            type="submit"
            className="rounded-full bg-accent px-6 py-3 text-sm font-extrabold uppercase tracking-wide text-ink hover:brightness-95"
          >
            {p.submit}
          </button>
          <p className="mt-2 text-xs text-muted">{p.working}</p>
        </div>
      </form>
    </PanelShell>
  );
}
