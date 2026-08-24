import { getSetting } from "./budget";
import {
  buildStoryNotice,
  mailConfigured,
  parseRecipients,
  sendMail,
  type MailEnv,
} from "@/lib/mail";
import { getSection } from "@/lib/sections";
import { absoluteUrl } from "@/lib/urls";
import { SQL_NOW } from "../sql-time";

/**
 * Aviso de nota publicada. Va a dos sitios: al equipo (correos internos que se configuran en el
 * panel, `settings.notify_emails`, y que no se muestran en el sitio) y a los suscriptores
 * confirmados. Nunca frena la publicación: si el correo falla, la nota ya está publicada y el fallo
 * queda registrado.
 */

export type NotifyResult = { team: number; subscribers: number; errors: string[] };

export type PublishedStory = {
  articleId: string;
  title: string;
  excerpt: string;
  path: string;
  sectionId: string;
  authorName: string;
};

export async function notifyPublished(
  db: D1Database,
  env: MailEnv,
  base: string,
  story: PublishedStory,
  fetchImpl: typeof fetch = fetch,
): Promise<NotifyResult> {
  const out: NotifyResult = { team: 0, subscribers: 0, errors: [] };
  if (!mailConfigured(env)) {
    out.errors.push("correo sin configurar (faltan YAD_SITE, YAD_TOKEN o MAIL_FROM)");
    return out;
  }
  const url = absoluteUrl(base, story.path);
  const section = getSection(story.sectionId)?.name.es ?? story.sectionId;

  // 1) El equipo: aviso con todo, sin enlace de baja (son correos internos).
  try {
    const team = parseRecipients(await getSetting(db, "notify_emails"));
    if (team.length > 0) {
      const aviso = buildStoryNotice({
        title: story.title,
        excerpt: story.excerpt,
        url,
        section,
        author: story.authorName,
      });
      const res = await sendMail(env, { to: team, ...aviso }, fetchImpl);
      if (res.ok) out.team = res.sent;
      else out.errors.push(`equipo: ${res.reason}${res.detail ? ` (${res.detail})` : ""}`);
    }
  } catch (e) {
    out.errors.push(`equipo: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 2) Suscriptores confirmados: mismo aviso, cada uno con su enlace de baja.
  try {
    const { results } = await db
      .prepare(
        `SELECT email, token FROM subscribers WHERE status = 'confirmed' ORDER BY confirmed_at LIMIT 200`,
      )
      .all<{ email: string; token: string }>();
    for (const s of results) {
      const aviso = buildStoryNotice({
        title: story.title,
        excerpt: story.excerpt,
        url,
        section,
        author: story.authorName,
        unsubscribeUrl: `${base}/datos/boletin?baja=${encodeURIComponent(s.token)}`,
      });
      const res = await sendMail(env, { to: [s.email], ...aviso }, fetchImpl);
      if (res.ok) out.subscribers += 1;
      else {
        out.errors.push(`suscriptor: ${res.reason}`);
        break; // si el servicio rechaza (p. ej. tope diario), no seguimos machacando
      }
    }
    if (results.length > 0) {
      await db
        .prepare(`UPDATE subscribers SET last_sent_at = ${SQL_NOW} WHERE status = 'confirmed'`)
        .run();
    }
  } catch (e) {
    out.errors.push(`suscriptores: ${e instanceof Error ? e.message : String(e)}`);
  }
  return out;
}
