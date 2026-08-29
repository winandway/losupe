import { escapeHtml } from "@/lib/html";
import { fallo, leerVar, reintentablePorEstado, tieneVariables, type Red } from "./tipos";

/**
 * TELEGRAM. La más fácil de encender de las cuatro: se crea un bot hablando con @BotFather, se le
 * pone de administrador en el canal, y ya. No hay revisión, no hay aprobación y no cuesta nada.
 */
export const telegram: Red = {
  id: "telegram",
  nombre: "Telegram",
  limite: 4096,
  variables: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
  configurada: (env) => tieneVariables(env, telegram.variables),
  async publicar(env, mensaje, fetchImpl = fetch) {
    const token = leerVar(env, "TELEGRAM_BOT_TOKEN");
    const chat = leerVar(env, "TELEGRAM_CHAT_ID");
    try {
      const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chat,
          // El texto va como HTML y escapado: un titular con un `<` rompía el envío entero.
          text: escapeHtml(mensaje.texto),
          parse_mode: "HTML",
          disable_web_page_preview: false,
        }),
      });
      const datos = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        description?: string;
        result?: { message_id?: number };
      };
      if (!res.ok || datos.ok === false) {
        return {
          ok: false,
          error: `Telegram ${res.status}: ${datos.description ?? "sin detalle"}`,
          reintentable: reintentablePorEstado(res.status),
        };
      }
      return { ok: true, url: enlaceDeTelegram(chat, datos.result?.message_id) };
    } catch (error) {
      return fallo(error);
    }
  },
};

/** El enlace al mensaje publicado, si el canal es público (@nombre). En privados no existe. */
function enlaceDeTelegram(chat: string, id?: number): string | undefined {
  if (!id || !chat.startsWith("@")) return undefined;
  return `https://t.me/${chat.slice(1)}/${id}`;
}
