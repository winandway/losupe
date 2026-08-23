import { z } from "zod";
import { sessionFromRequest } from "@/lib/panel/auth";
import { panelEnv } from "@/lib/panel/server";
import { addAssignments, getAssignment, moveAssignment, updateAssignment } from "@/lib/robot/queue";
import { SECTIONS } from "@/lib/sections";
import { parseIdeas, parseUrls } from "@/lib/panel/forms";

export const dynamic = "force-dynamic";

const sectionIds = SECTIONS.map((s) => s.id) as [string, ...string[]];

const addSchema = z.object({
  op: z.literal("add"),
  sponsorId: z.string().uuid(),
  ideas: z.string().trim().min(3).max(20_000),
  sectionId: z.enum(sectionIds).optional(),
  scheduledFor: z
    .string()
    .trim()
    .max(10)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  sourceUrls: z.string().max(5000).optional(),
});

const opSchema = z.object({
  op: z.enum(["up", "down", "cancel", "requeue"]),
  id: z.string().uuid(),
});

function back(path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}

/** POST /panel/accion/encargos — agregar ideas, mover, cancelar o reencolar un encargo. */
export async function POST(request: Request) {
  const env = await panelEnv();
  if (!(await sessionFromRequest(env.DB, request))) return back("/panel/entrar");
  const form = await request.formData();
  const raw: Record<string, string> = {};
  for (const [k, v] of form.entries()) raw[k] = typeof v === "string" ? v : "";

  if (raw.op === "add") {
    const parsed = addSchema.safeParse(raw);
    if (!parsed.success) return back(`/panel/encargos/${raw.sponsorId ?? ""}?error=invalid`);
    const d = parsed.data;
    const ideas = parseIdeas(d.ideas);
    if (ideas.length === 0) return back(`/panel/encargos/${d.sponsorId}?error=invalid`);
    const urls = parseUrls(d.sourceUrls);
    await addAssignments(
      env.DB,
      d.sponsorId,
      ideas.map((i) => ({
        titleIdea: i.titleIdea,
        brief: i.brief,
        sectionId: (d.sectionId as (typeof SECTIONS)[number]["id"] | undefined) ?? null,
        sourceUrls: urls,
        scheduledFor: d.scheduledFor ? `${d.scheduledFor}T00:00:00.000Z` : null,
      })),
    );
    return back(`/panel/encargos/${d.sponsorId}?ok=ideasAdded`);
  }

  const parsed = opSchema.safeParse(raw);
  if (!parsed.success) return back("/panel/encargos?error=invalid");
  const a = await getAssignment(env.DB, parsed.data.id);
  if (!a) return back("/panel/encargos?error=invalid");
  const to = `/panel/encargos/${a.sponsorId}`;
  switch (parsed.data.op) {
    case "up":
    case "down":
      await moveAssignment(env.DB, a.id, parsed.data.op);
      return back(to);
    case "cancel":
      await updateAssignment(env.DB, a.id, { status: "canceled" });
      return back(`${to}?ok=updated`);
    case "requeue":
      await updateAssignment(env.DB, a.id, { status: "queued" });
      await env.DB.prepare(`UPDATE assignments SET error = NULL WHERE id = ?1`).bind(a.id).run();
      return back(`${to}?ok=updated`);
  }
}
