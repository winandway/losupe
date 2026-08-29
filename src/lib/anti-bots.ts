import { SQL_NOW } from "./sql-time";

/**
 * BLINDAJE DE LOS FORMULARIOS PÚBLICOS.
 *
 * El 25 ago 2026 entró por el formulario de contacto un correo de spam vendiendo «indexación en
 * Google». Richard: *«que solo humanos puedan mandar información, nada de robots, bloquéalos a
 * todos con sistemas de seguridad robustos»*.
 *
 * CUATRO CAPAS, y a propósito. Ninguna barrera sirve sola, y las tres primeras funcionan **sin
 * depender de ningún servicio ajeno ni de ninguna llave**: si mañana se cae el proveedor de la
 * cuarta, el formulario sigue protegido.
 *
 *   1. **Pase del formulario.** La página entrega un pase firmado por nosotros, con su hora dentro.
 *      Quien manda un POST directo —que es como trabajan casi todos los que envían spam— no tiene
 *      pase y no pasa. Y el pase caduca, así que no se puede guardar y reutilizar mil veces.
 *   2. **Tiempo mínimo.** Una persona tarda unos segundos en escribir. Un robot rellena y envía en
 *      milisegundos. Si el pase se usa demasiado rápido, no era una persona.
 *   3. **Límite por dirección.** Aunque alguien pase las dos anteriores, no puede mandar diez
 *      mensajes en una hora.
 *   4. **Turnstile de Cloudflare**, la comprobación de siempre, que además **no le pide nada al
 *      lector normal**. Se activa sola cuando estén las llaves; sin ellas el resto sigue en pie.
 *
 * Y la trampa (un campo escondido que una persona no ve) sigue en cada formulario, que es gratis y
 * caza a los robots más simples.
 */

/**
 * Cuánto tarda como mínimo una persona en rellenar cada formulario.
 *
 * No es el mismo número para todos, y ahí está el detalle: el boletín es UN campo que el navegador
 * puede autocompletar —alguien puede enviarlo en un segundo y medio siendo perfectamente humano—,
 * mientras que «publica tu noticia» tiene siete campos y nadie los escribe en tres segundos.
 * Poner el listón alto en el corto sería echar a lectores de verdad, que es peor que un spam.
 */
export const MINIMO_SEGUNDOS = 3;
export const MINIMO_BOLETIN = 1.5;
export const VALIDEZ_MINUTOS = 90;
/**
 * Cuántos envíos se admiten desde una misma dirección en una hora.
 *
 * Diez, y no cinco: **varias personas pueden compartir la misma dirección** — una oficina, un
 * colegio, una red móvil. Con el listón bajo se bloquea a gente de verdad, y esta es la ÚLTIMA red:
 * lo gordo ya lo frenan el pase firmado y el tiempo mínimo. Se descubrió con una prueba que empezó
 * a fallar por agotar el cupo desde la misma máquina (29 ago 2026).
 */
export const MAX_POR_HORA = 10;

/** El secreto con el que se firman los pases. Se genera solo la primera vez y vive en la base. */
export async function secretoDeFormularios(db: D1Database): Promise<string> {
  const row = await db
    .prepare(`SELECT value FROM settings WHERE key = 'form_secret'`)
    .first<{ value: string }>();
  if (row?.value) return row.value;
  const nuevo = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await db
    .prepare(
      `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('form_secret', ?1, ${SQL_NOW})`,
    )
    .bind(nuevo)
    .run();
  return nuevo;
}

async function firmar(secreto: string, datos: string): Promise<string> {
  const clave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const firma = await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(datos));
  return [...new Uint8Array(firma)]
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Crea el pase que la página le da al formulario. Lleva la hora dentro y va firmado. */
export async function crearPase(db: D1Database, ahora = new Date()): Promise<string> {
  const secreto = await secretoDeFormularios(db);
  const t = ahora.getTime().toString(36);
  return `${t}.${await firmar(secreto, t)}`;
}

export type VeredictoPase =
  | { ok: true; segundos: number }
  | { ok: false; motivo: "sin_pase" | "falso" | "caducado" | "demasiado_rapido" };

/** Comprueba el pase: que lo hayamos dado nosotros, que no haya caducado y que no venga instantáneo. */
export async function revisarPase(
  db: D1Database,
  pase: string | null | undefined,
  ahora = new Date(),
  minimoSegundos = MINIMO_SEGUNDOS,
): Promise<VeredictoPase> {
  if (!pase || !pase.includes(".")) return { ok: false, motivo: "sin_pase" };
  const [t, firma] = pase.split(".");
  if (!t || !firma) return { ok: false, motivo: "sin_pase" };
  const emitido = Number.parseInt(t, 36);
  if (!Number.isFinite(emitido)) return { ok: false, motivo: "falso" };

  const secreto = await secretoDeFormularios(db);
  const esperada = await firmar(secreto, t);
  // Comparación de tiempo constante: no se filtra información por lo que tarda en fallar.
  if (esperada.length !== firma.length) return { ok: false, motivo: "falso" };
  let iguales = 0;
  for (let i = 0; i < esperada.length; i++) iguales |= esperada.charCodeAt(i) ^ firma.charCodeAt(i);
  if (iguales !== 0) return { ok: false, motivo: "falso" };

  const segundos = (ahora.getTime() - emitido) / 1000;
  if (segundos > VALIDEZ_MINUTOS * 60) return { ok: false, motivo: "caducado" };
  if (segundos < minimoSegundos) return { ok: false, motivo: "demasiado_rapido" };
  return { ok: true, segundos };
}

/**
 * ¿Esta dirección ya mandó demasiados en la última hora? Se apoya en la tabla que ya existía para
 * los intentos de entrada al panel, con una marca distinta.
 */
export async function demasiadosEnvios(
  db: D1Database,
  ip: string,
  ahora = new Date(),
): Promise<boolean> {
  try {
    const desde = new Date(ahora.getTime() - 3_600_000).toISOString();
    const row = await db
      .prepare(`SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ?1 AND ok = 2 AND at > ?2`)
      .bind(`form:${ip}`, desde)
      .first<{ n: number }>();
    return Number(row?.n ?? 0) >= MAX_POR_HORA;
  } catch {
    // Ante la duda se deja pasar: cerrar el formulario a todo el mundo por un fallo de la base es
    // peor que un mensaje de spam.
    return false;
  }
}

export async function anotarEnvio(db: D1Database, ip: string): Promise<void> {
  await db
    .prepare(`INSERT INTO login_attempts (ip, ok, at) VALUES (?1, 2, ${SQL_NOW})`)
    .bind(`form:${ip}`)
    .run()
    .catch(() => undefined);
}

/* ------------------------------------------------------------------ Turnstile */

export const TURNSTILE_VERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type TurnstileEnv = { TURNSTILE_SECRET_KEY?: string; TURNSTILE_SITE_KEY?: string };

export function turnstileConfigurado(env: TurnstileEnv): boolean {
  return Boolean(env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY);
}

/**
 * Comprueba el pase de Turnstile **en el servidor**, que es donde cuenta: el recuadro del navegador
 * solo lo pide; cualquiera puede saltárselo y hablarle directo a la dirección del formulario.
 *
 * Si Cloudflare no responde se deja pasar: detrás siguen las otras tres capas, y tumbar el
 * formulario de todos los lectores por un mal minuto de un servicio ajeno no compensa.
 */
export async function turnstileValido(
  env: TurnstileEnv,
  token: string | null | undefined,
  ip: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (!turnstileConfigurado(env)) return true; // apagado: no bloquea a nadie
  if (!token) return false;
  try {
    const res = await fetchImpl(TURNSTILE_VERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return true;
    const body = (await res.json()) as { success?: boolean };
    return body.success === true;
  } catch {
    return true;
  }
}

export type Guardia = { ok: true } | { ok: false; motivo: "robot" | "demasiados" | "turnstile" };

/**
 * La puerta de todos los formularios públicos: las cuatro capas en el orden correcto (primero lo
 * que no cuesta nada, al final lo que llama a un servicio de fuera).
 */
export async function guardiaDeFormulario(
  db: D1Database,
  env: TurnstileEnv,
  datos: {
    pase: string | null;
    trampa: string;
    turnstile: string | null;
    ip: string;
    /** Cuánto tarda como mínimo una persona en ESTE formulario. */
    minimoSegundos?: number;
  },
  ahora = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<Guardia> {
  if (datos.trampa.trim() !== "") return { ok: false, motivo: "robot" };
  const pase = await revisarPase(db, datos.pase, ahora, datos.minimoSegundos);
  if (!pase.ok) return { ok: false, motivo: "robot" };
  if (await demasiadosEnvios(db, datos.ip, ahora)) return { ok: false, motivo: "demasiados" };
  if (!(await turnstileValido(env, datos.turnstile, datos.ip, fetchImpl))) {
    return { ok: false, motivo: "turnstile" };
  }
  await anotarEnvio(db, datos.ip);
  return { ok: true };
}
