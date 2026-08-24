import { sessionFromRequest } from "@/lib/panel/auth";
import { panelEnv } from "@/lib/panel/server";
import { createManualStory, manualSchema } from "@/lib/robot/manual";

export const dynamic = "force-dynamic";

function back(path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}

/** POST /panel/accion/escribir — crea una nota escrita a mano (con ayuda de IA). */
export async function POST(request: Request) {
  const env = await panelEnv();
  if (!(await sessionFromRequest(env.DB, request))) return back("/panel/entrar");
  const form = await request.formData();
  const raw: Record<string, string> = {};
  for (const [k, v] of form.entries()) raw[k] = typeof v === "string" ? v : "";
  const parsed = manualSchema.safeParse(raw);
  if (!parsed.success) {
    const primero = parsed.error.issues[0];
    return back(
      `/panel/escribir?error=${encodeURIComponent(`${primero?.path.join(".")}: ${primero?.message}`)}`,
    );
  }
  const result = await createManualStory(env, parsed.data);
  if (!result.ok) {
    return back(`/panel/escribir?error=${encodeURIComponent((result.error ?? "").slice(0, 200))}`);
  }
  return back(`/panel/escribir?ok=created&nota=${encodeURIComponent(result.path ?? "/")}`);
}
