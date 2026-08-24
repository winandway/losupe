import { getDb } from "@/lib/db";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { confirmSubscriber, subscribe, subscribeSchema, unsubscribe } from "@/lib/subscribers";
import { toLang } from "@/i18n";
import { homePath } from "@/lib/urls";

export const dynamic = "force-dynamic";

function back(path: string) {
  return new Response(null, {
    status: 303,
    headers: { Location: path, "Cache-Control": "no-store" },
  });
}

/** GET /datos/boletin?alta=TOKEN | ?baja=TOKEN — confirmar o darse de baja desde el correo. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const db = await getDb();
  const alta = url.searchParams.get("alta");
  const baja = url.searchParams.get("baja");
  if (alta) {
    const ok = await confirmSubscriber(db, alta);
    return back(`${homePath("es")}?boletin=${ok ? "confirmado" : "invalido"}`);
  }
  if (baja) {
    const ok = await unsubscribe(db, baja);
    return back(`${homePath("es")}?boletin=${ok ? "baja" : "invalido"}`);
  }
  return back(homePath("es"));
}

/** POST /datos/boletin — alta desde el formulario del sitio (manda el correo de confirmación). */
export async function POST(request: Request) {
  const form = await request.formData();
  const lang = toLang(String(form.get("lang") ?? "es"));
  const parsed = subscribeSchema.safeParse({
    email: String(form.get("email") ?? ""),
    lang,
  });
  const to = (estado: string) => back(`${homePath(lang)}?boletin=${estado}#boletin`);
  if (!parsed.success) return to("invalido");
  const { env } = await getCloudflareContext({ async: true });
  const db = await getDb();
  const base = env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || new URL(request.url).origin;
  const res = await subscribe(db, env, base, parsed.data);
  if (!res.ok) return to(res.reason === "mail" ? "sincorreo" : "invalido");
  return to(res.state === "already" ? "yaestabas" : "revisa");
}
