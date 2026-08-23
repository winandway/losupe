import { z } from "zod";
import { sessionFromRequest } from "@/lib/panel/auth";
import { panelEnv } from "@/lib/panel/server";
import { setSetting } from "@/lib/robot/budget";
import { runScheduled } from "@/lib/robot/scheduled";

export const dynamic = "force-dynamic";

const schema = z.object({
  op: z.enum(["pause", "resume", "auto_on", "auto_off", "run", "settings"]),
  notesPerDay: z.coerce.number().int().min(1).max(24).optional(),
  evergreenPercent: z.coerce.number().int().min(0).max(100).optional(),
  dailyBudget: z.coerce.number().min(0).max(10).optional(),
});

function back(path: string, status = 303) {
  return new Response(null, { status, headers: { Location: path, "Cache-Control": "no-store" } });
}

/** POST /panel/accion/robot — pausar/encender, publicación automática, ejecutar ahora. */
export async function POST(request: Request) {
  const env = await panelEnv();
  if (!(await sessionFromRequest(env.DB, request))) return back("/panel/entrar");
  const form = await request.formData();
  const parsed = schema.safeParse({
    op: String(form.get("op") ?? ""),
    notesPerDay: form.get("notesPerDay") ?? undefined,
    evergreenPercent: form.get("evergreenPercent") ?? undefined,
    dailyBudget: form.get("dailyBudget") ?? undefined,
  });
  if (!parsed.success) return back("/panel?error=op");
  const { op } = parsed.data;
  try {
    if (op === "settings") {
      const d = parsed.data;
      if (d.notesPerDay !== undefined)
        await setSetting(env.DB, "notes_per_day", String(d.notesPerDay));
      if (d.evergreenPercent !== undefined) {
        await setSetting(env.DB, "evergreen_ratio", String(d.evergreenPercent / 100));
      }
      if (d.dailyBudget !== undefined) {
        await setSetting(env.DB, "daily_budget_usd", d.dailyBudget.toFixed(2));
      }
      return back("/panel?ok=settingsSaved");
    }
    if (op === "pause") {
      await setSetting(env.DB, "robot_paused", "1");
      return back("/panel?ok=robotPaused");
    }
    if (op === "resume") {
      await setSetting(env.DB, "robot_paused", "0");
      return back("/panel?ok=robotResumed");
    }
    if (op === "auto_on") {
      await setSetting(env.DB, "robot_auto_publish", "1");
      return back("/panel?ok=autoOn");
    }
    if (op === "auto_off") {
      await setSetting(env.DB, "robot_auto_publish", "0");
      return back("/panel?ok=autoOff");
    }
    const base = env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(request.url).origin;
    const result = await runScheduled(env, "manual", { base, maxNotes: 1, force: true });
    return back(
      result.ok ? "/panel?ok=ran" : `/panel?error=${encodeURIComponent(result.reason ?? "run")}`,
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return back(`/panel?error=${encodeURIComponent(msg.slice(0, 200))}`);
  }
}
