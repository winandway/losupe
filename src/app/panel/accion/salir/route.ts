import {
  clearSessionCookie,
  destroySession,
  isSecure,
  parseCookies,
  SESSION_COOKIE,
} from "@/lib/panel/auth";
import { panelEnv } from "@/lib/panel/server";

export const dynamic = "force-dynamic";

/** POST /panel/accion/salir — borra la sesión en la base y la cookie; el navegador recarga completo. */
export async function POST(request: Request) {
  const env = await panelEnv();
  const id = parseCookies(request.headers.get("cookie"))[SESSION_COOKIE];
  if (id) await destroySession(env.DB, id).catch(() => undefined);
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/panel/entrar",
      "Set-Cookie": clearSessionCookie(isSecure(request)),
      "Cache-Control": "no-store",
    },
  });
}
