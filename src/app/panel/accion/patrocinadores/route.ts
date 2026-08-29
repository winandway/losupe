import { z } from "zod";
import { sessionFromRequest } from "@/lib/panel/auth";
import { panelEnv } from "@/lib/panel/server";
import { createSponsor, updateSponsor } from "@/lib/robot/queue";
import { SECTIONS } from "@/lib/sections";

export const dynamic = "force-dynamic";

const sectionIds = SECTIONS.map((s) => s.id) as [string, ...string[]];
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

const schema = z.object({
  op: z.enum(["create", "update"]),
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  website: z.string().trim().url().max(300),
  contactName: optional(120),
  contactEmail: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .pipe(z.string().email().nullable()),
  brief: optional(4000),
  sectionId: z.enum(sectionIds),
  notesTotal: z.coerce.number().int().min(1).max(365),
  sectionSponsored: z.string().max(40).optional(),
  sectionUntil: z.string().max(30).optional(),
  claimEs: z.string().max(120).optional(),
  logoUrl: z.string().max(300).optional(),
  periodStart: optional(10),
  periodEnd: optional(10),
  status: z.enum(["active", "paused", "finished", "canceled"]),
  internalNotes: optional(2000),
});

function back(path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}

/** POST /panel/accion/patrocinadores — crear o editar un patrocinador (todo validado con zod). */
export async function POST(request: Request) {
  const env = await panelEnv();
  if (!(await sessionFromRequest(env.DB, request))) return back("/panel/entrar");
  const form = await request.formData();
  const raw: Record<string, string> = {};
  for (const [k, v] of form.entries()) raw[k] = typeof v === "string" ? v : "";
  const parsed = schema.safeParse({ ...raw, id: raw.id || undefined });
  if (!parsed.success) {
    return back(
      raw.op === "update" && raw.id
        ? `/panel/encargos/${raw.id}?error=invalid`
        : "/panel/encargos?error=invalid",
    );
  }
  const d = parsed.data;
  const input = {
    name: d.name,
    website: d.website,
    contactName: d.contactName,
    contactEmail: d.contactEmail,
    brief: d.brief,
    sectionId: d.sectionId as (typeof SECTIONS)[number]["id"],
    notesTotal: d.notesTotal,
    periodStart: d.periodStart,
    periodEnd: d.periodEnd,
    status: d.status,
    internalNotes: d.internalNotes,
    sectionSponsored: d.sectionSponsored || null,
    sectionUntil: d.sectionUntil || null,
    claimEs: d.claimEs || null,
    logoUrl: d.logoUrl || null,
  };
  if (d.op === "update" && d.id) {
    await updateSponsor(env.DB, d.id, input);
    return back(`/panel/encargos/${d.id}?ok=updated`);
  }
  const id = await createSponsor(env.DB, input);
  return back(`/panel/encargos/${id}?ok=created`);
}
