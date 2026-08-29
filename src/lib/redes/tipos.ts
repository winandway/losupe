/**
 * PUBLICACIÓN EN REDES SOCIALES.
 *
 * Cada nota que sale del robot se anuncia sola en las redes del diario. Todo el código está escrito,
 * probado y enchufado: **lo único que falta para encenderlo es pegar las llaves** de cada red en
 * YaDominios Cloud → tarjeta del sitio → Variables de entorno. Sin llaves, el sistema no falla ni
 * molesta: sencillamente dice que esa red está apagada y sigue.
 *
 * Se eligieron cuatro redes por un motivo práctico: son las cuatro que se pueden encender **hoy**,
 * sin esperar la aprobación de nadie y sin pagar. X (Twitter) e Instagram se quedaron fuera a
 * propósito — la primera cobra por publicar desde un programa y la segunda solo deja hacerlo con una
 * cuenta de empresa aprobada. Cuando Richard las tenga, se añaden con este mismo molde.
 */

export type RedId = "telegram" | "bluesky" | "mastodon" | "facebook";

/** Lo que se publica: ya viene recortado a la medida de cada red. */
export type MensajeSocial = {
  /** El texto tal cual va a salir. */
  texto: string;
  /** El enlace a la nota, completo y con https. */
  url: string;
  /** Titular sin recortar, para las tarjetas de enlace que lo piden aparte. */
  titulo: string;
  /** Entradilla, para lo mismo. */
  resumen: string;
};

export type ResultadoEnvio =
  { ok: true; url?: string } | { ok: false; error: string; reintentable: boolean };

/**
 * Un adaptador de red. Todos tienen la misma forma para que añadir la quinta red sea escribir un
 * archivo y nada más.
 */
export type Red = {
  id: RedId;
  /** Cómo se llama para una persona. */
  nombre: string;
  /** Cuántos caracteres caben, contando el enlace. */
  limite: number;
  /** Los nombres EXACTOS de las variables de entorno que hacen falta. */
  variables: readonly string[];
  /** ¿Están todas las llaves? */
  configurada(env: Record<string, string | undefined>): boolean;
  publicar(
    env: Record<string, string | undefined>,
    mensaje: MensajeSocial,
    fetchImpl?: typeof fetch,
  ): Promise<ResultadoEnvio>;
};

/** Lee una variable de entorno tolerando el espacio de más al pegarla. */
export function leerVar(env: Record<string, string | undefined>, nombre: string): string {
  return (env[nombre] ?? "").trim();
}

/** ¿Están TODAS las variables de esta red? Una a medias es lo mismo que ninguna. */
export function tieneVariables(
  env: Record<string, string | undefined>,
  variables: readonly string[],
): boolean {
  return variables.every((v) => leerVar(env, v) !== "");
}

/**
 * Un fallo de red o un 5xx del otro lado se puede reintentar; un 401 o un 400 no, porque la llave
 * está mal o el texto no le gusta y reintentar solo gasta.
 */
export function reintentablePorEstado(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Convierte cualquier excepción en un resultado legible, sin tragarse el motivo. */
export function fallo(error: unknown, reintentable = true): ResultadoEnvio {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    reintentable,
  };
}
