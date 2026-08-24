import Link from "next/link";
import { notFound } from "next/navigation";
import { PanelShell } from "@/components/panel/PanelShell";
import { SponsorForm } from "@/components/panel/SponsorForm";
import { flashFrom, panelDict, requirePanelSession } from "@/lib/panel/server";
import { getSponsor, getSponsorPace, listAssignments, sponsorNextSlot } from "@/lib/robot/queue";
import { articlePath } from "@/lib/urls";
import { getSection, SECTIONS } from "@/lib/sections";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SponsorDetailPage({ params, searchParams }: Props) {
  const { env } = await requirePanelSession();
  const { lang, dict } = await panelDict();
  const p = dict.panel.sponsors;
  const { id } = await params;
  const sponsor = await getSponsor(env.DB, id);
  if (!sponsor) notFound();
  const assignments = await listAssignments(env.DB, id);
  const [pace, slot] = await Promise.all([getSponsorPace(env.DB), sponsorNextSlot(env.DB, id)]);
  const flash = flashFrom(await searchParams);
  const flashText = {
    ok: flash.ok ? ((p as unknown as Record<string, string>)[flash.ok] ?? flash.ok) : undefined,
    error: flash.error
      ? ((p as unknown as Record<string, string>)[flash.error] ?? flash.error)
      : undefined,
  };
  // Para enlazar a la nota publicada hace falta el slug: lo resolvemos por artículo.
  const articleLinks = new Map<string, string>();
  for (const a of assignments) {
    if (!a.articleId) continue;
    const row = await env.DB.prepare(
      `SELECT i.slug, ar.section_id FROM article_i18n i JOIN articles ar ON ar.id = i.article_id WHERE i.article_id = ?1 AND i.lang = 'es'`,
    )
      .bind(a.articleId)
      .first<{ slug: string; section_id: string }>();
    if (row) articleLinks.set(a.id, articlePath("es", row.section_id as never, row.slug));
  }

  return (
    <PanelShell
      lang={lang}
      dict={dict}
      active="sponsors"
      title={sponsor.name}
      flash={flashText}
      actions={
        <Link
          href="/panel/encargos"
          className="rounded-full border border-line px-3 py-1.5 text-xs font-bold hover:bg-white"
        >
          ← {p.title}
        </Link>
      }
    >
      <p className="mb-4 rounded-xl border border-line bg-white px-4 py-3 text-sm">
        <strong>{p.nextSlot}:</strong>{" "}
        {slot.availableAt === null ? (
          <span className="font-semibold text-ink">{p.available}</span>
        ) : slot.availableAt === "semana" ? (
          <span className="font-semibold text-coral">{p.weekFull}</span>
        ) : (
          <span className="font-semibold text-coral">
            {p.waitingUntil} {slot.availableAt.slice(0, 16).replace("T", " ")} UTC
          </span>
        )}
        <span className="ml-2 text-muted">
          ({slot.publishedThisWeek}/{slot.maxPerWeek} {p.thisWeek})
        </span>
        <span className="mt-1 block text-xs text-muted">
          {p.paceHint.replace("{h}", String(pace.gapHours)).replace("{n}", String(pace.maxPerWeek))}
        </span>
      </p>
      <p className="mb-5 text-sm">
        <strong>{sponsor.published}</strong> {p.published} · <strong>{sponsor.queued}</strong>{" "}
        {p.queuedShort} · <strong>{sponsor.remaining}</strong> {p.remaining} ·{" "}
        <a
          href={sponsor.website}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="underline"
        >
          {sponsor.website}
        </a>
      </p>

      <section className="rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl font-bold">{p.ideas}</h2>
        {assignments.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{p.noIdeas}</p>
        ) : (
          <ol className="mt-3 divide-y divide-line">
            {assignments.map((a, i) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    <span className="mr-2 text-muted">{i + 1}.</span>
                    {a.titleIdea}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    <span
                      className={`mr-2 rounded-full px-2 py-0.5 font-bold ${
                        a.status === "published"
                          ? "bg-mint/30"
                          : a.status === "error"
                            ? "bg-coral/20"
                            : a.status === "queued"
                              ? "bg-paper"
                              : "bg-accent/40"
                      }`}
                    >
                      {p.assignmentStatus[a.status]}
                    </span>
                    {a.sectionId ? getSection(a.sectionId)?.name[lang] : null}
                    {a.scheduledFor ? ` · ${p.scheduledFor}: ${a.scheduledFor.slice(0, 10)}` : null}
                    {a.brief ? ` · ${a.brief}` : null}
                  </p>
                  {a.error ? (
                    <p className="mt-1 text-xs font-semibold text-coral">{a.error}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1">
                  {articleLinks.get(a.id) ? (
                    <a
                      href={articleLinks.get(a.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-ink px-3 py-1 text-xs font-bold text-white"
                    >
                      {p.seeArticle}
                    </a>
                  ) : null}
                  {a.status === "queued" ? (
                    <>
                      <form action="/panel/accion/encargos" method="post">
                        <input type="hidden" name="op" value="up" />
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          className="rounded-full border border-line px-3 py-1 text-xs font-bold hover:bg-paper"
                          aria-label={p.up}
                        >
                          ↑
                        </button>
                      </form>
                      <form action="/panel/accion/encargos" method="post">
                        <input type="hidden" name="op" value="down" />
                        <input type="hidden" name="id" value={a.id} />
                        <button
                          className="rounded-full border border-line px-3 py-1 text-xs font-bold hover:bg-paper"
                          aria-label={p.down}
                        >
                          ↓
                        </button>
                      </form>
                      <form action="/panel/accion/encargos" method="post">
                        <input type="hidden" name="op" value="cancel" />
                        <input type="hidden" name="id" value={a.id} />
                        <button className="rounded-full border border-line px-3 py-1 text-xs font-bold text-coral hover:bg-paper">
                          {p.cancel}
                        </button>
                      </form>
                    </>
                  ) : null}
                  {a.status === "error" || a.status === "canceled" ? (
                    <form action="/panel/accion/encargos" method="post">
                      <input type="hidden" name="op" value="requeue" />
                      <input type="hidden" name="id" value={a.id} />
                      <button className="rounded-full border border-line px-3 py-1 text-xs font-bold hover:bg-paper">
                        {p.requeue}
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}

        <form
          action="/panel/accion/encargos"
          method="post"
          className="mt-5 grid gap-3 md:grid-cols-2"
        >
          <input type="hidden" name="op" value="add" />
          <input type="hidden" name="sponsorId" value={sponsor.id} />
          <label className="block text-sm font-semibold md:col-span-2">
            {p.addIdeas}
            <textarea
              name="ideas"
              rows={5}
              required
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-accent"
            />
            <span className="mt-1 block text-xs font-normal text-muted">{p.addIdeasHint}</span>
          </label>
          <label className="block text-sm font-semibold">
            {p.section}
            <select
              name="sectionId"
              defaultValue={sponsor.sectionId ?? "ventas"}
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
            >
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name[lang]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold">
            {p.scheduledFor}
            <input
              name="scheduledFor"
              type="date"
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold md:col-span-2">
            {p.sourceUrls}
            <textarea
              name="sourceUrls"
              rows={2}
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm"
            />
          </label>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-extrabold uppercase tracking-wide text-ink hover:brightness-95"
            >
              {p.addIdeasButton}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-display text-xl font-bold">{p.save}</h2>
        <div className="mt-4">
          <SponsorForm lang={lang} dict={dict} sponsor={sponsor} />
        </div>
      </section>
    </PanelShell>
  );
}
