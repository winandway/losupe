import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/lib/db";
import { anotarVisita } from "@/lib/lectores";

export const dynamic = "force-dynamic";

/**
 * POST /datos/visita — el sensor de lectores.
 *
 * Lo llama el navegador desde la propia página, así que llegar hasta aquí ya es la prueba de que
 * hay una persona con un navegador de verdad al otro lado: los rastreadores piden el HTML y se van.
 *
 * Responde 204 (sin contenido) y anota por detrás: nadie tiene que esperar a un contador.
 */
export async function POST(request: Request) {
  const sinContenido = new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
  try {
    const body = (await request.json().catch(() => null)) as {
      ruta?: string;
      lang?: string;
      referente?: string;
    } | null;
    if (!body?.ruta) return sinContenido;

    const { env, ctx } = await getCloudflareContext({ async: true });
    const db = await getDb();
    // El país lo pone la plataforma en la cabecera; la IP se usa solo para la huella anónima del
    // día y NO se guarda en ninguna parte.
    const pais = request.headers.get("cf-ipcountry") ?? request.headers.get("x-vercel-ip-country");
    const ip =
      request.headers.get("cf-connecting-ip") ??
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "0.0.0.0";
    void env;
    ctx.waitUntil(
      anotarVisita(db, {
        ruta: String(body.ruta),
        lang: body.lang === "en" ? "en" : "es",
        pais,
        referente: body.referente ? String(body.referente) : null,
        ip,
        userAgent: request.headers.get("user-agent") ?? "",
      }).catch(() => false),
    );
  } catch {
    /* un contador nunca puede tumbar una página */
  }
  return sinContenido;
}
