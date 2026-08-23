import { z } from "zod";
import { sessionFromRequest } from "@/lib/panel/auth";
import { panelEnv } from "@/lib/panel/server";
import { SECTIONS } from "@/lib/sections";
import { slugify } from "@/lib/slug";

export const dynamic = "force-dynamic";

const sectionIds = SECTIONS.map((s) => s.id) as [string, ...string[]];
const addSchema = z.object({
  op: z.literal("add"),
  name: z.string().trim().min(2).max(120),
  url: z.string().trim().url().max(500),
  sectionId: z.enum(sectionIds),
  lang: z.enum(["es", "en"]),
  weight: z.coerce.number().int().min(1).max(5),
});
const toggleSchema = z.object({ op: z.literal("toggle"), id: z.string().min(1).max(120) });

function back(path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}

/** POST /panel/accion/fuentes — agregar o encender/apagar una fuente RSS. */
export async function POST(request: Request) {
  const env = await panelEnv();
  if (!(await sessionFromRequest(env.DB, request))) return back("/panel/entrar");
  const form = await request.formData();
  const raw: Record<string, string> = {};
  for (const [k, v] of form.entries()) raw[k] = typeof v === "string" ? v : "";
  if (raw.op === "add") {
    const parsed = addSchema.safeParse(raw);
    if (!parsed.success) return back("/panel/fuentes?error=invalid");
    const d = parsed.data;
    const id = `${slugify(d.name).slice(0, 40)}-${crypto.randomUUID().slice(0, 6)}`;
    await env.DB.prepare(
      `INSERT INTO sources (id, section_id, name, url, kind, lang, weight, active) VALUES (?1, ?2, ?3, ?4, 'rss', ?5, ?6, 1)`,
    )
      .bind(id, d.sectionId, d.name, d.url, d.lang, d.weight)
      .run();
    return back("/panel/fuentes?ok=added");
  }
  const parsed = toggleSchema.safeParse(raw);
  if (!parsed.success) return back("/panel/fuentes?error=invalid");
  await env.DB.prepare(
    `UPDATE sources SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?1`,
  )
    .bind(parsed.data.id)
    .run();
  return back("/panel/fuentes");
}
