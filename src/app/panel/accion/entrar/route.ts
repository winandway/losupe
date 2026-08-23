import { z } from "zod";
import { clientIp, isSecure, login, sessionCookie } from "@/lib/panel/auth";
import { panelEnv } from "@/lib/panel/server";

export const dynamic = "force-dynamic";

const schema = z.object({
  password: z.string().min(1).max(200),
  turnstile: z.string().max(4000).nullable(),
});

/** POST /panel/accion/entrar — comprueba contraseña (y Turnstile) y abre sesión. */
export async function POST(request: Request) {
  const env = await panelEnv();
  const form = await request.formData();
  const parsed = schema.safeParse({
    password: String(form.get("password") ?? ""),
    turnstile:
      request.headers.get("x-turnstile-token") ??
      (form.get("cf-turnstile-response") ? String(form.get("cf-turnstile-response")) : null),
  });
  const back = (reason: string) =>
    new Response(null, {
      status: 303,
      headers: { Location: `/panel/entrar?error=${reason}`, "Cache-Control": "no-store" },
    });
  if (!parsed.success) return back("wrong");
  const result = await login(env, {
    password: parsed.data.password,
    turnstileToken: parsed.data.turnstile,
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });
  if (!result.ok) {
    return new Response(null, {
      status: result.reason === "too_many" ? 429 : 303,
      headers: { Location: `/panel/entrar?error=${result.reason}`, "Cache-Control": "no-store" },
    });
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/panel",
      "Set-Cookie": sessionCookie(result.sessionId, isSecure(request)),
      "Cache-Control": "no-store",
    },
  });
}
