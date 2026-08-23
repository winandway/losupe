import { PANEL_LANG_COOKIE } from "@/lib/panel/server";

export const dynamic = "force-dynamic";

/** GET /panel/accion/idioma?lang=es|en — guarda el idioma del panel y vuelve a la página anterior. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lang = url.searchParams.get("lang") === "en" ? "en" : "es";
  const referer = request.headers.get("referer");
  let back = "/panel";
  if (referer) {
    try {
      const r = new URL(referer);
      if (r.origin === url.origin && r.pathname.startsWith("/panel")) back = r.pathname + r.search;
    } catch {
      /* referer raro: vuelve al inicio del panel */
    }
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: back,
      "Set-Cookie": `${PANEL_LANG_COOKIE}=${lang}; Path=/panel; SameSite=Lax; Max-Age=31536000`,
      "Cache-Control": "no-store",
    },
  });
}
