import { z } from "zod";
import { buildStoryNotice, parseRecipients, sendMail } from "@/lib/mail";
import { sessionFromRequest } from "@/lib/panel/auth";
import { panelEnv } from "@/lib/panel/server";
import { setSetting } from "@/lib/robot/budget";

export const dynamic = "force-dynamic";

const schema = z.object({ op: z.enum(["save", "test"]), emails: z.string().max(4000).optional() });

function back(path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}

/** POST /panel/accion/correos — guarda los correos del equipo o manda un aviso de prueba. */
export async function POST(request: Request) {
  const env = await panelEnv();
  if (!(await sessionFromRequest(env.DB, request))) return back("/panel/entrar");
  const form = await request.formData();
  const parsed = schema.safeParse({
    op: String(form.get("op") ?? ""),
    emails: form.get("emails") ? String(form.get("emails")) : undefined,
  });
  if (!parsed.success) return back("/panel?error=invalid");

  if (parsed.data.op === "save") {
    const lista = parseRecipients(parsed.data.emails);
    await setSetting(env.DB, "notify_emails", lista.join("\n"));
    return back("/panel?ok=mailSaved");
  }

  const lista = parseRecipients(
    (
      await env.DB.prepare(`SELECT value FROM settings WHERE key = 'notify_emails'`).first<{
        value: string;
      }>()
    )?.value,
  );
  if (lista.length === 0)
    return back("/panel?error=" + encodeURIComponent("sin correos guardados"));
  const base = env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const aviso = buildStoryNotice({
    title: "Prueba de aviso de losupe",
    excerpt:
      "Si estás leyendo esto, los avisos por correo funcionan. A partir de ahora te llegará uno cada vez que se publique una nota.",
    url: base,
    section: "Prueba",
    author: "Panel de losupe",
  });
  const res = await sendMail(env, { to: lista, ...aviso });
  return back(
    res.ok
      ? "/panel?ok=mailTested"
      : `/panel?error=${encodeURIComponent(`${res.reason}${res.detail ? `: ${res.detail}` : ""}`)}`,
  );
}
