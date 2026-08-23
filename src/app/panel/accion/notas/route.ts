import { z } from "zod";
import { pingIndexNow } from "@/lib/indexnow";
import { sessionFromRequest } from "@/lib/panel/auth";
import { panelEnv } from "@/lib/panel/server";
import { setArticleStatus } from "@/lib/robot/publish";
import { absoluteUrl, articlePath } from "@/lib/urls";

export const dynamic = "force-dynamic";

const schema = z.object({
  op: z.enum(["publish", "unpublish", "discard"]),
  id: z.string().min(8).max(80),
});

function back(path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}

/** POST /panel/accion/notas — publicar, despublicar o descartar una nota del robot. */
export async function POST(request: Request) {
  const env = await panelEnv();
  if (!(await sessionFromRequest(env.DB, request))) return back("/panel/entrar");
  const form = await request.formData();
  const parsed = schema.safeParse({ op: form.get("op"), id: form.get("id") });
  if (!parsed.success) return back("/panel/notas?error=invalid");
  const { op, id } = parsed.data;
  const status = op === "publish" ? "published" : op === "unpublish" ? "draft" : "archived";
  await setArticleStatus(env.DB, id, status);
  // El encargo ligado (si lo hay) sigue el mismo destino.
  await env.DB.prepare(
    `UPDATE assignments SET status = ?2, published_at = CASE WHEN ?2 = 'published' THEN COALESCE(published_at, datetime('now')) ELSE published_at END, updated_at = datetime('now') WHERE article_id = ?1`,
  )
    .bind(id, op === "publish" ? "published" : op === "unpublish" ? "review" : "canceled")
    .run();
  if (op === "publish") {
    const base = env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    const { results } = await env.DB.prepare(
      `SELECT i.lang, i.slug, a.section_id FROM article_i18n i JOIN articles a ON a.id = i.article_id WHERE i.article_id = ?1`,
    )
      .bind(id)
      .all<{ lang: "es" | "en"; slug: string; section_id: string }>();
    const urls = results.map((r) =>
      absoluteUrl(base, articlePath(r.lang, r.section_id as never, r.slug)),
    );
    await pingIndexNow(base, urls).catch(() => undefined);
  }
  return back(
    `/panel/notas?ok=${op === "publish" ? "published" : op === "unpublish" ? "unpublished" : "discarded"}`,
  );
}
