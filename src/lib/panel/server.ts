import { connection } from "next/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDict, toLang } from "@/i18n";
import type { Lang } from "@/i18n/config";
import { getSession, SESSION_COOKIE } from "./auth";

export const PANEL_LANG_COOKIE = "panel_lang";

/** Entorno del worker (base, bucket, variables) desde un componente/ruta del panel. */
export async function panelEnv(): Promise<CloudflareEnv> {
  await connection();
  const { env } = await getCloudflareContext({ async: true });
  return env;
}

/** Idioma del panel: cookie `panel_lang`, luego Accept-Language, por defecto español. */
export async function panelLang(): Promise<Lang> {
  const jar = await cookies();
  const fromCookie = jar.get(PANEL_LANG_COOKIE)?.value;
  if (fromCookie === "es" || fromCookie === "en") return fromCookie;
  const accept = (await headers()).get("accept-language") ?? "";
  return toLang(accept.toLowerCase().startsWith("en") ? "en" : "es");
}

export async function panelDict() {
  const lang = await panelLang();
  return { lang, dict: getDict(lang) };
}

/** Exige sesión válida; si no hay, manda a /panel/entrar. Devuelve env + sesión. */
export async function requirePanelSession() {
  const env = await panelEnv();
  const jar = await cookies();
  const session = await getSession(env.DB, jar.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/panel/entrar");
  return { env, session };
}

/** Mensajes de resultado (?ok=…&error=…) que las acciones dejan al redirigir. */
export function flashFrom(searchParams: Record<string, string | string[] | undefined>) {
  const pick = (k: string) => {
    const v = searchParams[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  };
  return { ok: pick("ok"), error: pick("error") };
}
