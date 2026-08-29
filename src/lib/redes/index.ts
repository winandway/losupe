import { SQL_NOW } from "@/lib/sql-time";
import { bluesky } from "./bluesky";
import { facebook } from "./facebook";
import { mastodon } from "./mastodon";
import { armarMensaje, type NotaParaRedes } from "./mensaje";
import { telegram } from "./telegram";
import type { Red, RedId } from "./tipos";

export { armarMensaje, etiquetasDe, largo, recortar } from "./mensaje";
export type { NotaParaRedes } from "./mensaje";
export type { MensajeSocial, Red, RedId, ResultadoEnvio } from "./tipos";

/** Las cuatro redes, en el orden en que se pueden encender: de la más fácil a la que espera a Meta. */
export const REDES: readonly Red[] = [telegram, bluesky, mastodon, facebook];

export function redPorId(id: string): Red | undefined {
  return REDES.find((r) => r.id === id);
}

/** Qué redes tienen sus llaves puestas. Las demás ni se intentan. */
export function redesConfiguradas(env: Record<string, string | undefined>): Red[] {
  return REDES.filter((r) => r.configurada(env));
}

/** Para el panel y para /__health: el estado de cada red, sin enseñar ni un trozo de llave. */
export function estadoDeRedes(env: Record<string, string | undefined>) {
  return REDES.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    configurada: r.configurada(env),
    faltan: r.variables.filter((v) => !(env[v] ?? "").trim()),
  }));
}

export type EnvioARed = {
  red: RedId;
  ok: boolean;
  url?: string;
  error?: string;
};

export type ResultadoRedes = {
  /** Redes encendidas en este momento. */
  activas: number;
  enviados: EnvioARed[];
};

/**
 * Anuncia una nota en todas las redes encendidas.
 *
 * TRES REGLAS, y las tres nacieron de un golpe anterior:
 *  1. **Nunca frena la publicación.** La nota ya está en el sitio; que Telegram esté caído no puede
 *     tumbar nada. Todo va envuelto y cada fallo se guarda.
 *  2. **El fallo se VE.** Queda escrito en `social_posts` con su motivo y sale en el panel. Nada de
 *     tragarse el error en un `catch` vacío: eso es lo que esconde el daño durante meses.
 *  3. **Nunca dos veces la misma nota en la misma red.** Lo garantiza la propia tabla, con una
 *     restricción sobre (nota, red). La tabla nace con ella, no se le añade después sobre datos que
 *     ya existen — eso fue lo que tumbó el esquema entero el 28 ago 2026.
 */
export async function publicarEnRedes(
  db: D1Database,
  env: Record<string, string | undefined>,
  nota: NotaParaRedes & { articleId: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoRedes> {
  const activas = redesConfiguradas(env);
  const out: ResultadoRedes = { activas: activas.length, enviados: [] };
  if (activas.length === 0) return out;

  for (const red of activas) {
    // Si ya se mandó, no se repite. Se comprueba ANTES de gastar la llamada.
    if (await yaSeMando(db, nota.articleId, red.id)) continue;
    const mensaje = armarMensaje(nota, red.limite);
    let resultado;
    try {
      resultado = await red.publicar(env, mensaje, fetchImpl);
    } catch (error) {
      // Un adaptador no debería lanzar (todos devuelven el fallo), pero si uno lo hace, el resto de
      // las redes tienen que seguir saliendo.
      resultado = {
        ok: false as const,
        error: error instanceof Error ? error.message : String(error),
        reintentable: true,
      };
    }
    await anotarEnvio(db, nota.articleId, red.id, resultado);
    out.enviados.push(
      resultado.ok
        ? { red: red.id, ok: true, url: resultado.url }
        : { red: red.id, ok: false, error: resultado.error },
    );
  }
  return out;
}

async function yaSeMando(db: D1Database, articleId: string, red: RedId): Promise<boolean> {
  try {
    const fila = await db
      .prepare(`SELECT status FROM social_posts WHERE article_id = ?1 AND network = ?2`)
      .bind(articleId, red)
      .first<{ status: string }>();
    return fila?.status === "sent";
  } catch {
    // Sin tabla (base a medio crear) se deja pasar: mejor un post repetido que ninguno.
    return false;
  }
}

async function anotarEnvio(
  db: D1Database,
  articleId: string,
  red: RedId,
  resultado: { ok: boolean; url?: string; error?: string },
): Promise<void> {
  const estado = resultado.ok ? "sent" : "error";
  try {
    // UPDATE y, solo si no había fila, INSERT. Mismo patrón que el contador de lectores: evita
    // depender de un ON CONFLICT y funciona igual en bases viejas.
    const upd = await db
      .prepare(
        `UPDATE social_posts
            SET status = ?3, url = ?4, error = ?5, attempts = attempts + 1,
                sent_at = CASE WHEN ?3 = 'sent' THEN ${SQL_NOW} ELSE sent_at END
          WHERE article_id = ?1 AND network = ?2`,
      )
      .bind(articleId, red, estado, resultado.url ?? null, resultado.error ?? null)
      .run();
    if ((upd.meta?.changes ?? 0) > 0) return;
    await db
      .prepare(
        `INSERT INTO social_posts (id, article_id, network, status, url, error, attempts, created_at, sent_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ${SQL_NOW},
                 CASE WHEN ?4 = 'sent' THEN ${SQL_NOW} ELSE NULL END)`,
      )
      .bind(
        crypto.randomUUID(),
        articleId,
        red,
        estado,
        resultado.url ?? null,
        resultado.error ?? null,
      )
      .run();
  } catch {
    // Si ni siquiera se puede anotar, la nota ya salió y el post también. No se rompe nada.
  }
}

export type FilaSocial = {
  id: string;
  articleId: string;
  network: RedId;
  status: string;
  url: string | null;
  error: string | null;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
  title?: string;
};

/** Lo último que se mandó, para la tarjeta del panel. */
export async function ultimosEnvios(db: D1Database, limite = 30): Promise<FilaSocial[]> {
  try {
    const { results } = await db
      .prepare(
        `SELECT s.id, s.article_id, s.network, s.status, s.url, s.error, s.attempts,
                s.created_at, s.sent_at, a.title
           FROM social_posts s
           LEFT JOIN articles a ON a.id = s.article_id
          ORDER BY s.created_at DESC
          LIMIT ?1`,
      )
      .bind(limite)
      .all<{
        id: string;
        article_id: string;
        network: string;
        status: string;
        url: string | null;
        error: string | null;
        attempts: number;
        created_at: string;
        sent_at: string | null;
        title: string | null;
      }>();
    return (results ?? []).map((r) => ({
      id: r.id,
      articleId: r.article_id,
      network: r.network as RedId,
      status: r.status,
      url: r.url,
      error: r.error,
      attempts: r.attempts,
      createdAt: r.created_at,
      sentAt: r.sent_at,
      title: r.title ?? undefined,
    }));
  } catch {
    return [];
  }
}
