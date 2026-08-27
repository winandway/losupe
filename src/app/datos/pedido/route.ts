import { getDb } from "@/lib/db";
import { createOrder, orderSchema } from "@/lib/orders";
import { staticPath } from "@/lib/urls";
import { toLang } from "@/i18n";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { guardiaDeFormulario } from "@/lib/anti-bots";
import { ipDe } from "@/lib/ip";

export const dynamic = "force-dynamic";

/** POST /datos/pedido — recibe el formulario público «Publica tu noticia». */
export async function POST(request: Request) {
  const form = await request.formData();
  const raw: Record<string, string> = {};
  for (const [k, v] of form.entries()) raw[k] = typeof v === "string" ? v.trim() : "";
  const lang = toLang(raw.lang);
  const to = (state: "ok" | "error") =>
    new Response(null, {
      status: 303,
      headers: {
        Location: `${staticPath("publish", lang)}?estado=${state}${state === "error" ? "#pedido" : ""}`,
        "Cache-Control": "no-store",
      },
    });
  const parsed = orderSchema.safeParse({
    company: raw.company,
    website: raw.website,
    contactName: raw.contactName,
    email: raw.email,
    phone: raw.phone,
    plan: raw.plan,
    sectionId: raw.sectionId || undefined,
    lang: raw.mainLang === "en" ? "en" : "es",
    brief: raw.brief,
    ideas: raw.ideas,
  });
  if (!parsed.success) return to("error");
  try {
    const db = await getDb();
    // La misma puerta que el resto de formularios públicos. Este es el más goloso para el spam:
    // aquí se pide un servicio de pago.
    const { env } = await getCloudflareContext({ async: true });
    const guardia = await guardiaDeFormulario(db, env, {
      pase: raw.pase || null,
      trampa: raw.web ?? "",
      turnstile: raw["cf-turnstile-response"] || null,
      ip: ipDe(request),
    });
    // Al robot se le responde «ok» para que no aprenda, pero no se guarda el pedido.
    if (!guardia.ok) return to("ok");
    await createOrder(db, parsed.data, {
      ip: ipDe(request),
    });
    return to("ok");
  } catch {
    return to("error");
  }
}
