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
  format: string | null;
  social_json: string | null;
};

type Redes = {
  facebook_instagram?: { titulo?: string; texto?: string };
  tiktok?: string;
  youtube?: { titulo?: string; descripcion?: string; etiquetas?: string };
  whatsapp?: string;
};

function leerRedes(json: string | null): Redes | null {
  if (!json) return null;
  try {
    const r = JSON.parse(json) as Redes;
    return r && typeof r === "object" ? r : null;
  } catch {
    return null;
  }
}

export default async function NotesPage({ searchParams }: Props) {
  const { env } = await requirePanelSession();
  const { lang, dict } = await panelDict();
  const p = dict.panel.notes;
  const { results } = await env.DB.prepare(
    `SELECT a.id, a.status, a.origin, a.section_id, a.created_at, a.published_at, a.image_url, i.title, i.slug, h.format, h.social_json
     FROM articles a JOIN article_i18n i ON i.article_id = a.id AND i.lang = 'es'
     LEFT JOIN house_notes h ON h.article_id = a.id
     WHERE a.origin IN ('robot', 'sponsored', 'casa') ORDER BY a.created_at DESC LIMIT 60`,
  ).all<Row>();
  const review = results.filter((r) => r.status === "review");
  const rest = results.filter((r) => r.status !== "review");
  const flash = flashFrom(await searchParams);
  const flashText = {
    ok: flash.ok ? ((p as unknown as Record<string, string>)[flash.ok] ?? flash.ok) : undefined,
    error: flash.error
      ? ((p as unknown as Record<string, string>)[flash.error] ?? flash.error)
      : undefined,
  };
  const Item = ({ r }: { r: Row }) => (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{r.title}</p>
        <p className="text-xs text-muted">
          <span
            className={`mr-2 rounded-full px-2 py-0.5 font-bold ${r.origin === "sponsored" ? "bg-accent/50" : r.origin === "casa" ? "bg-ink text-white" : "bg-paper"}`}
          >
            {r.origin === "sponsored" ? p.sponsored : r.origin === "casa" ? p.casa : p.universal}
          </span>
          {r.format ? `${p.casaFormato}: ${r.format} · ` : ""}
          {getSection(r.section_id)?.name[lang]} · {r.created_at.slice(0, 16).replace("T", " ")} ·{" "}
          {r.status}
          {!r.image_url ? " · sin imagen" : ""}
        </p>
        {(() => {
          // Textos para redes de las notas de la casa: listos para copiar y pegar.
          const redes = leerRedes(r.social_json);
          if (!redes) return null;
          const bloques: [string, string][] = [
            [
              "Facebook / Instagram",
              [redes.facebook_instagram?.titulo, redes.facebook_instagram?.texto]
                .filter(Boolean)
                .join("\n\n"),
            ],
            ["TikTok", redes.tiktok ?? ""],
            [
              "YouTube Shorts",
              [redes.youtube?.titulo, redes.youtube?.descripcion, redes.youtube?.etiquetas]
                .filter(Boolean)
                .join("\n\n"),
            ],
            ["WhatsApp", redes.whatsapp ?? ""],
          ];
          return (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer font-bold">{p.casaRedes}</summary>
              {bloques
                .filter(([, t]) => t)
                .map(([red, texto]) => (
                  <div key={red} className="mt-2">
                    <p className="font-bold">{red}</p>
                    <pre className="whitespace-pre-wrap rounded-lg bg-paper p-2 font-sans">
                      {texto}
                    </pre>
                  </div>
                ))}
            </details>
          );
        })()}
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
        {/* «Otra foto»: quien decide si una imagen pega con la nota es una persona, no un modelo. */}
        <form action="/panel/accion/robot" method="post">
          <input type="hidden" name="op" value="fotos" />
          <input type="hidden" name="articleId" value={r.id} />
          <button className="rounded-full border border-line px-3 py-1 text-xs font-bold hover:bg-paper">
            {p.otraFoto}
          </button>
        </form>
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
