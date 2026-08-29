import { fallo, leerVar, reintentablePorEstado, tieneVariables, type Red } from "./tipos";

/**
 * FACEBOOK (página, no perfil). Se publica en el muro de la página con un token de página de larga
 * duración. Es la única de las cuatro que pide pasar por la revisión de Meta para el permiso
 * `pages_manage_posts`, y por eso está la última: el código ya está, la espera es de ellos.
 */
export const facebook: Red = {
  id: "facebook",
  nombre: "Facebook",
  limite: 5000,
  variables: ["FACEBOOK_PAGE_ID", "FACEBOOK_PAGE_TOKEN"],
  configurada: (env) => tieneVariables(env, facebook.variables),
  async publicar(env, mensaje, fetchImpl = fetch) {
    const pagina = leerVar(env, "FACEBOOK_PAGE_ID");
    const token = leerVar(env, "FACEBOOK_PAGE_TOKEN");
    try {
      const res = await fetchImpl(`https://graph.facebook.com/v21.0/${pagina}/feed`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // El token va en el cuerpo, nunca en la URL: en la URL queda escrito en los registros.
        body: JSON.stringify({
          message: mensaje.texto,
          link: mensaje.url,
          access_token: token,
        }),
      });
      const datos = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: { message?: string; code?: number };
      };
      if (!res.ok || datos.error) {
        return {
          ok: false,
          error: `Facebook ${res.status}: ${datos.error?.message ?? "sin detalle"}`,
          reintentable: reintentablePorEstado(res.status),
        };
      }
      return {
        ok: true,
        url: datos.id ? `https://www.facebook.com/${datos.id}` : undefined,
      };
    } catch (error) {
      return fallo(error);
    }
  },
};
