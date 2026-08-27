import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { contactoSchema, enviarContacto } from "@/lib/contacto";
import { guardiaDeFormulario } from "@/lib/anti-bots";
import { ipDe } from "@/lib/ip";
import { toLang } from "@/i18n";
import { contactPath } from "@/lib/urls";

export const dynamic = "force-dynamic";

/**
 * POST /datos/contacto — el formulario público.
 *
 * Igual que el boletín: el correo sale por detrás y la respuesta es inmediata, porque hacer esperar
 * a alguien dos segundos delante de una pantalla quieta es la forma más rápida de que crea que está
 * roto y se vaya.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const lang = toLang(String(form.get("lang") ?? "es"));
  const quiereJson = (request.headers.get("accept") ?? "").includes("application/json");
  const responder = (estado: string) =>
    quiereJson
      ? Response.json({ estado }, { headers: { "Cache-Control": "no-store" } })
      : new Response(null, {
          status: 303,
          headers: {
            Location: `${contactPath(lang)}?enviado=${estado}#contacto`,
            "Cache-Control": "no-store",
          },
        });

  const parsed = contactoSchema.safeParse({
    nombre: String(form.get("nombre") ?? ""),
    email: String(form.get("email") ?? ""),
    asunto: String(form.get("asunto") ?? ""),
    mensaje: String(form.get("mensaje") ?? ""),
    web: String(form.get("web") ?? ""),
    lang,
  });
  if (!parsed.success) return responder("invalido");

  const { env, ctx } = await getCloudflareContext({ async: true });
  const db = await getDb();

  // La puerta: pase firmado, tiempo mínimo, límite por dirección y Turnstile si está encendido.
  const guardia = await guardiaDeFormulario(db, env, {
    pase: String(form.get("pase") ?? "") || null,
    trampa: String(form.get("web") ?? ""),
    turnstile: String(form.get("cf-turnstile-response") ?? "") || null,
    ip: ipDe(request),
  });
  if (!guardia.ok) {
    // Al robot se le contesta como a una persona para que no aprenda nada, pero no se manda nada.
    return responder(guardia.motivo === "demasiados" ? "demasiados" : "gracias");
  }

  const res = await enviarContacto(db, env, parsed.data, fetch, (p) => ctx.waitUntil(p));
  if (!res.ok) return responder(res.reason === "sincorreo" ? "sincorreo" : "error");
  return responder("gracias");
}
