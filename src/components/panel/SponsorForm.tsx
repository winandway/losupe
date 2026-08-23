import type { Dict } from "@/i18n/es";
import type { Lang } from "@/i18n/config";
import { SECTIONS } from "@/lib/sections";
import type { SponsorWithCounts } from "@/lib/robot/queue";

const input =
  "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink focus:ring-2 focus:ring-accent";

/** Formulario de patrocinador (crear o editar). Envía a /panel/accion/patrocinadores. */
export function SponsorForm({
  lang,
  dict,
  sponsor,
}: {
  lang: Lang;
  dict: Dict;
  sponsor?: SponsorWithCounts | null;
}) {
  const p = dict.panel.sponsors;
  return (
    <form action="/panel/accion/patrocinadores" method="post" className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="op" value={sponsor ? "update" : "create"} />
      {sponsor ? <input type="hidden" name="id" value={sponsor.id} /> : null}
      <label className="block text-sm font-semibold">
        {p.name}
        <input
          name="name"
          required
          maxLength={120}
          defaultValue={sponsor?.name ?? ""}
          className={input}
        />
      </label>
      <label className="block text-sm font-semibold">
        {p.website}
        <input
          name="website"
          type="url"
          required
          placeholder="https://"
          defaultValue={sponsor?.website ?? ""}
          className={input}
        />
      </label>
      <label className="block text-sm font-semibold">
        {p.contactName}
        <input
          name="contactName"
          maxLength={120}
          defaultValue={sponsor?.contactName ?? ""}
          className={input}
        />
      </label>
      <label className="block text-sm font-semibold">
        {p.contactEmail}
        <input
          name="contactEmail"
          type="email"
          maxLength={200}
          defaultValue={sponsor?.contactEmail ?? ""}
          className={input}
        />
      </label>
      <label className="block text-sm font-semibold md:col-span-2">
        {p.brief}
        <textarea
          name="brief"
          rows={4}
          maxLength={4000}
          defaultValue={sponsor?.brief ?? ""}
          className={input}
        />
        <span className="mt-1 block text-xs font-normal text-muted">{p.briefHint}</span>
      </label>
      <label className="block text-sm font-semibold">
        {p.section}
        <select name="sectionId" defaultValue={sponsor?.sectionId ?? "ventas"} className={input}>
          {SECTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name[lang]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold">
        {p.notesTotal}
        <input
          name="notesTotal"
          type="number"
          min={1}
          max={365}
          required
          defaultValue={sponsor?.notesTotal ?? 1}
          className={input}
        />
      </label>
      <label className="block text-sm font-semibold">
        {p.periodStart}
        <input
          name="periodStart"
          type="date"
          defaultValue={sponsor?.periodStart ?? ""}
          className={input}
        />
      </label>
      <label className="block text-sm font-semibold">
        {p.periodEnd}
        <input
          name="periodEnd"
          type="date"
          defaultValue={sponsor?.periodEnd ?? ""}
          className={input}
        />
      </label>
      <label className="block text-sm font-semibold">
        {p.status}
        <select name="status" defaultValue={sponsor?.status ?? "active"} className={input}>
          {(["active", "paused", "finished", "canceled"] as const).map((s) => (
            <option key={s} value={s}>
              {p.statuses[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold md:col-span-2">
        {p.internalNotes}
        <textarea
          name="internalNotes"
          rows={2}
          maxLength={2000}
          defaultValue={sponsor?.internalNotes ?? ""}
          className={input}
        />
      </label>
      <div className="md:col-span-2">
        <button
          type="submit"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-white hover:bg-ink-2"
        >
          {sponsor ? p.save : p.create}
        </button>
      </div>
    </form>
  );
}
