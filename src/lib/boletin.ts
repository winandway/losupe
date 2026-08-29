import { getSetting } from "./robot/budget";
import { diaLocal } from "./robot/franjas";
import { buildStoryNotice, mailConfigured, sendMail, type MailEnv } from "./mail";
import { SQL_NOW } from "./sql-time";
import { absoluteUrl, articlePath } from "./urls";

/**
 * EL BOLETÍN DE RESUMEN.
 *
 * Hasta ahora salía un aviso por cada nota publicada. Está bien para el equipo, pero para un lector
 * son cuatro correos al día — y cuatro correos al día es la vía rápida a que te marquen como spam.
 *
 * El boletín es otra cosa: **un solo correo cada pocos días con lo mejor**. Es el formato que la
 * gente abre, lee entero y reenvía, y el único canal de lectores que no depende de Google ni de
 * ninguna red social. Si mañana cambia un algoritmo, esta lista sigue siendo nuestra.
 *
 * Se manda desde la propia corrida del robot: no hace falta otro reloj para algo que sale cada
 * cuatro días.
 */

/** Cada cuántos días sale. Cuatro es el ritmo que acordamos: ni pesado ni olvidable. */
export const DIAS_ENTRE_BOLETINES = 4;
/** Cuántas notas van dentro. Más de seis y deja de leerse. */
export const NOTAS_POR_BOLETIN = 6;

export type NotaDelBoletin = {
  title: string;
  excerpt: string;
  slug: string;
  section_id: string;
  image_url: string | null;
  published_at: string;
};

export type ResultadoBoletin =
  | { ok: true; enviados: number; notas: number }
  | {
      ok: false;
      motivo: "sin_correo" | "sin_suscriptores" | "sin_notas" | "aun_no_toca" | "error";
    };

/** ¿Toca boletín hoy? */
export async function tocaBoletin(db: D1Database, ahora = new Date()): Promise<boolean> {
  try {
    if ((await getSetting(db, "boletin_activo")) === "0") return false;
    const ultimo = await getSetting(db, "boletin_ultimo");
    if (!ultimo) return true;
    const dias = (ahora.getTime() - Date.parse(ultimo)) / 86_400_000;
    const cada = Number((await getSetting(db, "boletin_dias")) ?? "") || DIAS_ENTRE_BOLETINES;
    return !Number.isFinite(dias) || dias >= cada;
  } catch {
    return false;
  }
}

/** Las mejores notas desde el último boletín: las más leídas primero, y si no hay datos, las últimas. */
export async function notasDelBoletin(
  db: D1Database,
  desde: string,
  limite = NOTAS_POR_BOLETIN,
): Promise<NotaDelBoletin[]> {
  const { results } = await db
    .prepare(
      `SELECT i.title, i.excerpt, i.slug, a.section_id, a.image_url, a.published_at,
              COALESCE((SELECT COUNT(DISTINCT v.visitante) FROM visitas v
                        WHERE v.ruta LIKE '%/' || i.slug), 0) AS lectores
       FROM articles a JOIN article_i18n i ON i.article_id = a.id AND i.lang = 'es'
       WHERE a.status = 'published' AND a.published_at > ?1
       ORDER BY lectores DESC, a.published_at DESC
       LIMIT ?2`,
    )
    .bind(desde, limite)
    .all<NotaDelBoletin & { lectores: number }>();
  return results;
}

function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** El correo: una portada en pequeño, no una lista de enlaces. */
export function construirBoletin(
  base: string,
  notas: readonly NotaDelBoletin[],
  bajaUrl: string,
): { subject: string; text: string; html: string } {
  const principal = notas[0];
  const subject = principal ? `📰 ${principal.title.slice(0, 110)}` : "📰 Lo nuevo en losupe.com";
  const url = (n: NotaDelBoletin) =>
    absoluteUrl(base, articlePath("es", n.section_id as "economia", n.slug));

  const text = [
    "Lo mejor de estos días en losupe.com",
    "",
    ...notas.map((n) => `• ${n.title}\n  ${url(n)}`),
    "",
    `Si ya no quieres estos correos: ${bajaUrl}`,
  ].join("\n");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#0b1f3a">
<p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5b6b82;margin:0 0 18px">losupe.com · lo mejor de estos días</p>
${notas
  .map(
    (
      n,
      i,
    ) => `<div style="${i > 0 ? "border-top:1px solid #e6e2d6;padding-top:18px;" : ""}margin:0 0 18px">
${n.image_url && i === 0 ? `<a href="${url(n)}"><img src="${absoluteUrl(base, n.image_url)}" alt="" width="560" style="width:100%;max-width:560px;height:auto;border-radius:12px;margin:0 0 12px"></a>` : ""}
<h2 style="font-size:${i === 0 ? 22 : 17}px;line-height:1.3;margin:0 0 6px"><a href="${url(n)}" style="color:#0b1f3a;text-decoration:none">${escapar(n.title)}</a></h2>
<p style="font-size:14px;line-height:1.6;color:#5b6b82;margin:0 0 8px">${escapar(n.excerpt)}</p>
<a href="${url(n)}" style="font-size:13px;font-weight:700;color:#0b1f3a">Leer la nota →</a>
</div>`,
  )
  .join("")}
<p style="font-size:12px;color:#5b6b82;border-top:1px solid #e6e2d6;padding-top:14px;margin:0">
Recibes esto porque confirmaste tu correo en losupe.com · <a href="${bajaUrl}" style="color:#5b6b82">darse de baja</a>
</p></div>`;
  return { subject, text, html };
}

/**
 * Manda el boletín si toca. Nunca lanza: que falle un correo no puede tumbar la corrida del robot.
 */
export async function enviarBoletin(
  db: D1Database,
  env: MailEnv,
  base: string,
  ahora = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoBoletin> {
  try {
    if (!mailConfigured(env)) return { ok: false, motivo: "sin_correo" };
    if (!(await tocaBoletin(db, ahora))) return { ok: false, motivo: "aun_no_toca" };

    const { results: gente } = await db
      .prepare(
        `SELECT email, token FROM subscribers WHERE status = 'confirmed' ORDER BY confirmed_at LIMIT 500`,
      )
      .all<{ email: string; token: string }>();
    if (gente.length === 0) {
      // Sin nadie a quien mandarlo no se gasta el turno: cuando haya suscriptores, sale.
      return { ok: false, motivo: "sin_suscriptores" };
    }

    const desde =
      (await getSetting(db, "boletin_ultimo")) ??
      new Date(ahora.getTime() - DIAS_ENTRE_BOLETINES * 86_400_000).toISOString();
    const notas = await notasDelBoletin(db, desde);
    if (notas.length === 0) return { ok: false, motivo: "sin_notas" };

    let enviados = 0;
    for (const s of gente) {
      const correo = construirBoletin(
        base,
        notas,
        `${base}/datos/boletin?baja=${encodeURIComponent(s.token)}`,
      );
      const res = await sendMail(env, { to: [s.email], ...correo }, fetchImpl);
      if (res.ok) enviados += 1;
      // Si el servicio rechaza (por ejemplo, tope diario), se para: insistir es quemar el dominio.
      else break;
    }

    await db
      .prepare(
        `INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('boletin_ultimo', ?1, ${SQL_NOW})`,
      )
      .bind(ahora.toISOString())
      .run();
    await db
      .prepare(`UPDATE subscribers SET last_sent_at = ${SQL_NOW} WHERE status = 'confirmed'`)
      .run()
      .catch(() => undefined);

    return { ok: true, enviados, notas: notas.length };
  } catch {
    return { ok: false, motivo: "error" };
  }
}

/** Para el panel: cuándo salió el último y cuándo sale el siguiente. */
export async function estadoBoletin(
  db: D1Database,
  ahora = new Date(),
): Promise<{ activo: boolean; cada: number; ultimo: string | null; proximo: string | null }> {
  try {
    const activo = (await getSetting(db, "boletin_activo")) !== "0";
    const cada = Number((await getSetting(db, "boletin_dias")) ?? "") || DIAS_ENTRE_BOLETINES;
    const ultimo = await getSetting(db, "boletin_ultimo");
    const proximo = ultimo
      ? diaLocal(new Date(Date.parse(ultimo) + cada * 86_400_000))
      : diaLocal(ahora);
    return { activo, cada, ultimo, proximo };
  } catch {
    return { activo: true, cada: DIAS_ENTRE_BOLETINES, ultimo: null, proximo: null };
  }
}

export { buildStoryNotice };
