import { findPexelsVideo } from "./images";
import { palabrasParaFoto } from "./rescate-imagenes";

/**
 * EL VIDEO DE CADA NOTA.
 *
 * Antes el video dependía de que el redactor se acordara de pedirlo (`wants_video`), y casi nunca
 * lo pedía: de 222 notas publicadas, ninguna de las recientes traía video. Richard lo quiere al
 * revés —«que los videos se vean en las lecturas»—, así que el video se busca DESPUÉS, igual que
 * la foto y el guion: una pasada al final de cada corrida, sin frenar ninguna publicación.
 *
 * Tres reglas, y las tres son editoriales, no técnicas:
 *
 *  1. **En una nota delicada no va video de archivo.** Una muerte, una tragedia o una guerra con
 *     un video bonito de banco de imágenes al lado es una falta de respeto. Esas notas se marcan
 *     como «sin video» y no se vuelven a intentar.
 *  2. **Solo si hay de qué.** Se buscan las mismas palabras concretas que se usan para la foto
 *     (`palabrasParaFoto`): si de la nota no sale ni una palabra fotografiable, no hay video.
 *  3. **Nunca se toca `updated_at`.** Poner un video no es actualizar la noticia (candado 53).
 */

/** Temas donde un video de archivo sobra. Se mira el titular y la entradilla. */
export const TEMA_DELICADO =
  /\bmuere\b|\bmueren\b|muert|muri[oó]|falleci|asesinat|homicid|tragedia|masacre|tiroteo|v[ií]ctima|herido|secuestr|abus|violaci[oó]n|violencia|guerra|bombarde|atentado|terremoto|huracan|incendi|accidente|c[aá]ncer|enfermedad|suicid|funeral|luto|death|died|killed|murder|shooting|victim|war|attack|bombing|hurricane|wildfire|crash|cancer|suicide|funeral/i;

export type FilaSinVideo = {
  id: string;
  title: string;
  title_en: string | null;
  excerpt: string | null;
};

export type ResultadoRescateVideo = {
  encontradas: number;
  conVideo: number;
  sinTema: number;
  errores: string[];
};

/**
 * Notas publicadas hace poco a las que todavía no se les buscó video.
 *
 * `video_url` vacío (no nulo) significa «ya se miró y no corresponde»: así una nota delicada no se
 * vuelve a mirar en cada corrida.
 */
export async function notasSinVideo(
  db: D1Database,
  limite = 4,
  ahora = new Date(),
): Promise<FilaSinVideo[]> {
  const desde = new Date(ahora.getTime() - 30 * 86_400_000).toISOString();
  const { results } = await db
    .prepare(
      `SELECT a.id, es.title AS title, en.title AS title_en, es.excerpt AS excerpt
         FROM articles a
         JOIN article_i18n es ON es.article_id = a.id AND es.lang = 'es'
         LEFT JOIN article_i18n en ON en.article_id = a.id AND en.lang = 'en'
        WHERE a.status = 'published' AND a.video_url IS NULL AND a.published_at >= ?2
          -- Y si el redactor ya le metió uno dentro del texto, no se le pone otro encima.
          AND es.content_html NOT LIKE '%nota-video%'
        ORDER BY a.published_at DESC
        LIMIT ?1`,
    )
    .bind(limite, desde)
    .all<FilaSinVideo>();
  return results ?? [];
}

/** Marca una nota como mirada y sin video, para no volver a intentarlo. */
async function marcarSinVideo(db: D1Database, id: string): Promise<void> {
  await db
    .prepare(`UPDATE articles SET video_url = '' WHERE id = ?1`)
    .bind(id)
    .run()
    .catch(() => undefined);
}

export async function rescatarVideos(
  db: D1Database,
  env: { PEXELS_API_KEY?: string },
  opts: { limite?: number; fetchImpl?: typeof fetch; ahora?: Date } = {},
): Promise<ResultadoRescateVideo> {
  const out: ResultadoRescateVideo = { encontradas: 0, conVideo: 0, sinTema: 0, errores: [] };
  if (!env.PEXELS_API_KEY) return out;
  try {
    const notas = await notasSinVideo(db, opts.limite ?? 4, opts.ahora);
    out.encontradas = notas.length;
    for (const nota of notas) {
      try {
        const texto = `${nota.title} ${nota.excerpt ?? ""}`;
        if (TEMA_DELICADO.test(texto)) {
          await marcarSinVideo(db, nota.id);
          out.sinTema += 1;
          continue;
        }
        const palabras = palabrasParaFoto(nota.title, nota.title_en);
        if (palabras.length === 0) {
          await marcarSinVideo(db, nota.id);
          out.sinTema += 1;
          continue;
        }
        const video = await findPexelsVideo(palabras, env.PEXELS_API_KEY, opts.fetchImpl ?? fetch);
        if (!video) {
          await marcarSinVideo(db, nota.id);
          out.sinTema += 1;
          continue;
        }
        await db
          .prepare(
            // Sin `updated_at`: poner el video no cambia la noticia (candado 53).
            `UPDATE articles SET video_url = ?2, video_poster = ?3, video_credit = ?4 WHERE id = ?1`,
          )
          .bind(nota.id, video.src, video.poster, video.credit)
          .run();
        out.conVideo += 1;
      } catch (error) {
        out.errores.push(`${nota.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } catch (error) {
    out.errores.push(error instanceof Error ? error.message : String(error));
  }
  return out;
}
