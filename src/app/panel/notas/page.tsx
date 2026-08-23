import { PanelShell } from "@/components/panel/PanelShell";
import { flashFrom, panelDict, requirePanelSession } from "@/lib/panel/server";
import { getSection } from "@/lib/sections";
import { articlePath } from "@/lib/urls";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

type Row = {
  id: string;
  status: string;
  origin: string;
  section_id: string;
  created_at: string;
  published_at: string | null;
  title: string;
  slug: string;
  image_url: string | null;
};

export default async function NotesPage({ searchParams }: Props) {
  const { env } = await requirePanelSession();
  const { lang, dict } = await panelDict();
  const p = dict.panel.notes;
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.status, a.origin, a.section_id, a.created_at, a.published_at, a.image_url, i.title, i.slug
     FROM articles a JOIN article_i18n i ON i.article_id = a.id AND i.lang = 'es'
     WHERE a.origin IN ('robot', 'sponsored') ORDER BY a.created_at DESC LIMIT 60`,
  ).all<Row>();
  const review = results.filter((r) => r.status === "review");
  const rest = results.filter((r) => r.status !== "review");
  const flash = flashFrom(await searchParams);
  const flashText = {
    ok: flash.ok ? ((p as unknown as Record<string, string>)[flash.ok] ?? flash.ok) : undefined,
    error: flash.error,
  };
  const Item = ({ r }: { r: Row }) => (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{r.title}</p>
        <p className="text-xs text-muted">
          <span
            className={`mr-2 rounded-full px-2 py-0.5 font-bold ${r.origin === "sponsored" ? "bg-accent/50" : "bg-paper"}`}
          >
            {r.origin === "sponsored" ? p.sponsored : p.universal}
          </span>
          {getSection(r.section_id)?.name[lang]} · {r.created_at.slice(0, 16).replace("T", " ")} ·{" "}
          {r.status}
          {!r.image_url ? " · sin imagen" : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">
        <a
          href={articlePath("es", r.section_id as never, r.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-line px-3 py-1 text-xs font-bold hover:bg-paper"
        >
          {p.open}
        </a>
        {r.status !== "published" ? (
          <form action="/panel/accion/notas" method="post">
            <input type="hidden" name="op" value="publish" />
            <input type="hidden" name="id" value={r.id} />
            <button className="rounded-full bg-mint px-3 py-1 text-xs font-bold text-ink">
              {p.publish}
            </button>
          </form>
        ) : (
          <form action="/panel/accion/notas" method="post">
            <input type="hidden" name="op" value="unpublish" />
            <input type="hidden" name="id" value={r.id} />
            <button className="rounded-full border border-line px-3 py-1 text-xs font-bold hover:bg-paper">
              {p.unpublish}
            </button>
          </form>
        )}
        {r.status === "review" ? (
          <form action="/panel/accion/notas" method="post">
            <input type="hidden" name="op" value="discard" />
            <input type="hidden" name="id" value={r.id} />
            <button className="rounded-full border border-line px-3 py-1 text-xs font-bold text-coral hover:bg-paper">
              {p.discard}
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
  return (
    <PanelShell lang={lang} dict={dict} active="notes" title={p.title} flash={flashText}>
      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl font-bold">{p.review}</h2>
        {review.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{p.empty}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {review.map((r) => (
              <Item key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>
      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl font-bold">{p.recent}</h2>
        {rest.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{p.empty}</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {rest.map((r) => (
              <Item key={r.id} r={r} />
            ))}
          </ul>
        )}
      </section>
    </PanelShell>
  );
}
