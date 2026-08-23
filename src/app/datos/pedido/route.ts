import { getDb } from "@/lib/db";
import { createOrder, orderSchema } from "@/lib/orders";
import { staticPath } from "@/lib/urls";
import { toLang } from "@/i18n";

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
    await createOrder(db, parsed.data, {
      ip:
        request.headers.get("cf-connecting-ip") ??
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
    return to("ok");
  } catch {
    return to("error");
  }
}
