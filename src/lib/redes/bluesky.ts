import { fallo, leerVar, reintentablePorEstado, tieneVariables, type Red } from "./tipos";

/**
 * BLUESKY. Gratis, abierta y sin revisión: hace falta el usuario y una «contraseña de aplicación»
 * (Ajustes → Privacidad y seguridad → Contraseñas de aplicación), que NO es la contraseña de la
 * cuenta y se puede anular sin cambiar nada más.
 *
 * Tiene dos particularidades que hay que respetar o el post sale roto:
 *  1. **El enlace no se detecta solo.** Hay que marcarlo con un «facet» que dice en qué BYTES del
 *     texto empieza y acaba. Se cuenta en bytes UTF-8, no en letras: con un acento o un emoji
 *     delante, contar letras deja el enlace descuadrado y el post sale con texto plano.
 *  2. **Caben 300 caracteres** y los cuenta por símbolos visibles.
 */
export const bluesky: Red = {
  id: "bluesky",
  nombre: "Bluesky",
  limite: 300,
  variables: ["BLUESKY_IDENTIFIER", "BLUESKY_APP_PASSWORD"],
  configurada: (env) => tieneVariables(env, bluesky.variables),
  async publicar(env, mensaje, fetchImpl = fetch) {
    const host = (leerVar(env, "BLUESKY_HOST") || "https://bsky.social").replace(/\/+$/, "");
    try {
      // 1) Abrir sesión. La contraseña de aplicación se cambia por un pase de corta vida.
      const login = await fetchImpl(`${host}/xrpc/com.atproto.server.createSession`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          identifier: leerVar(env, "BLUESKY_IDENTIFIER"),
          password: leerVar(env, "BLUESKY_APP_PASSWORD"),
        }),
      });
      if (!login.ok) {
        const detalle = await login.text().catch(() => "");
        return {
          ok: false,
          error: `Bluesky (entrar) ${login.status}: ${detalle.slice(0, 200) || "sin detalle"}`,
          reintentable: reintentablePorEstado(login.status),
        };
      }
      const sesion = (await login.json()) as { accessJwt?: string; did?: string };
      if (!sesion.accessJwt || !sesion.did) {
        return { ok: false, error: "Bluesky: la sesión vino sin pase", reintentable: true };
      }

      // 2) Publicar, con el enlace marcado y su tarjeta de vista previa.
      const record = {
        $type: "app.bsky.feed.post",
        text: mensaje.texto,
        createdAt: new Date().toISOString(),
        langs: ["es"],
        facets: facetsDeEnlace(mensaje.texto, mensaje.url),
        embed: {
          $type: "app.bsky.embed.external",
          external: {
            uri: mensaje.url,
            title: mensaje.titulo.slice(0, 300),
            description: mensaje.resumen.slice(0, 1000),
          },
        },
      };
      const res = await fetchImpl(`${host}/xrpc/com.atproto.repo.createRecord`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${sesion.accessJwt}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          repo: sesion.did,
          collection: "app.bsky.feed.post",
          record,
        }),
      });
      if (!res.ok) {
        const detalle = await res.text().catch(() => "");
        return {
          ok: false,
          error: `Bluesky ${res.status}: ${detalle.slice(0, 200) || "sin detalle"}`,
          reintentable: reintentablePorEstado(res.status),
        };
      }
      const datos = (await res.json().catch(() => ({}))) as { uri?: string };
      return { ok: true, url: enlaceDeBluesky(sesion.did, datos.uri) };
    } catch (error) {
      return fallo(error);
    }
  },
};

/**
 * Marca dónde está el enlace dentro del texto, EN BYTES UTF-8. Este es el detalle que se escapa: si
 * se cuentan letras, un titular con tildes desplaza el enlace y Bluesky lo pinta como texto muerto.
 */
export function facetsDeEnlace(texto: string, url: string) {
  const bytes = new TextEncoder().encode(texto);
  const aguja = new TextEncoder().encode(url);
  const inicio = indiceDeBytes(bytes, aguja);
  if (inicio < 0) return [];
  return [
    {
      index: { byteStart: inicio, byteEnd: inicio + aguja.length },
      features: [{ $type: "app.bsky.richtext.facet#link", uri: url }],
    },
  ];
}

function indiceDeBytes(heno: Uint8Array, aguja: Uint8Array): number {
  if (aguja.length === 0 || aguja.length > heno.length) return -1;
  for (let i = 0; i <= heno.length - aguja.length; i++) {
    let igual = true;
    for (let j = 0; j < aguja.length; j++) {
      if (heno[i + j] !== aguja[j]) {
        igual = false;
        break;
      }
    }
    if (igual) return i;
  }
  return -1;
}

/** De `at://did:plc:xxx/app.bsky.feed.post/3kabc` al enlace que abre una persona. */
export function enlaceDeBluesky(did: string, uri?: string): string | undefined {
  const clave = uri?.split("/").pop();
  return clave ? `https://bsky.app/profile/${did}/post/${clave}` : undefined;
}
