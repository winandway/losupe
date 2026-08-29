import { fallo, leerVar, reintentablePorEstado, tieneVariables, type Red } from "./tipos";

/**
 * MASTODON. Cada servidor es independiente, así que hacen falta dos datos: en cuál está la cuenta y
 * su llave. La llave se saca en Preferencias → Desarrollo → Nueva aplicación, con permiso de
 * escritura. Tampoco hay revisión ni costo.
 */
export const mastodon: Red = {
  id: "mastodon",
  nombre: "Mastodon",
  limite: 500,
  variables: ["MASTODON_HOST", "MASTODON_TOKEN"],
  configurada: (env) => tieneVariables(env, mastodon.variables),
  async publicar(env, mensaje, fetchImpl = fetch) {
    const host = normalizarHost(leerVar(env, "MASTODON_HOST"));
    const token = leerVar(env, "MASTODON_TOKEN");
    try {
      const res = await fetchImpl(`${host}/api/v1/statuses`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
          // Si un reintento repite el mismo post, Mastodon devuelve el original en vez de duplicar.
          "Idempotency-Key": await huella(mensaje.url),
        },
        body: JSON.stringify({ status: mensaje.texto, visibility: "public", language: "es" }),
      });
      if (!res.ok) {
        const detalle = await res.text().catch(() => "");
        return {
          ok: false,
          error: `Mastodon ${res.status}: ${detalle.slice(0, 200) || "sin detalle"}`,
          reintentable: reintentablePorEstado(res.status),
        };
      }
      const datos = (await res.json().catch(() => ({}))) as { url?: string };
      return { ok: true, url: datos.url };
    } catch (error) {
      return fallo(error);
    }
  },
};

/** Acepta que Richard pegue «mastodon.social» o «https://mastodon.social/» y funcione igual. */
export function normalizarHost(valor: string): string {
  const limpio = valor.trim().replace(/\/+$/, "");
  if (!limpio) return "";
  return /^https?:\/\//i.test(limpio) ? limpio : `https://${limpio}`;
}

async function huella(texto: string): Promise<string> {
  const datos = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest("SHA-256", datos);
  return Array.from(new Uint8Array(hash).slice(0, 16))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
