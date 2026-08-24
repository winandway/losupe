/**
 * Envío de correo con el servicio transaccional de YaDominios Cloud (incluido en el plan del sitio).
 * No hace falta SMTP ni un proveedor externo: es un POST al panel con el token del sitio.
 *
 * Documentación: https://yadominios.com/docs/correos-desde-tu-dominio
 * Límite por plan (50/100/300/1000 al día): si se pasa, el envío se pausa hasta el día siguiente,
 * sin cobros sorpresa. El remitente debe ser de un dominio conectado al sitio.
 */

export const MAIL_ENDPOINT = "https://yapanel.yadominios.com/api/hosting/correo/enviar";

export type MailEnv = {
  YAD_SITE?: string;
  YAD_TOKEN?: string;
  MAIL_FROM?: string;
  MAIL_FROM_NAME?: string;
};

export type MailInput = {
  to: readonly string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type MailResult =
  | { ok: true; sent: number }
  | {
      ok: false;
      reason: "not_configured" | "no_recipients" | "rejected" | "network";
      detail?: string;
    };

/** ¿Está listo el envío de correo? (para el canario del panel y de /__health). */
export function mailConfigured(env: MailEnv): boolean {
  return Boolean(env.YAD_SITE && env.YAD_TOKEN && env.MAIL_FROM);
}

/** Correos separados por coma, punto y coma o saltos de línea; sin repetidos ni basura. */
export function parseRecipients(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out = new Set<string>();
  for (const part of raw.split(/[,;\s]+/)) {
    const email = part.trim().toLowerCase();
    if (/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) out.add(email);
  }
  return [...out];
}

export async function sendMail(
  env: MailEnv,
  input: MailInput,
  fetchImpl: typeof fetch = fetch,
): Promise<MailResult> {
  if (!mailConfigured(env)) return { ok: false, reason: "not_configured" };
  const to = [...new Set(input.to.map((t) => t.trim().toLowerCase()).filter(Boolean))];
  if (to.length === 0) return { ok: false, reason: "no_recipients" };
  try {
    const res = await fetchImpl(MAIL_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sitio: env.YAD_SITE,
        token: env.YAD_TOKEN,
        from: { address: env.MAIL_FROM, name: env.MAIL_FROM_NAME || "losupe" },
        to: to.map((address) => ({ address })),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return { ok: false, reason: "rejected", detail: `${res.status} ${detail}` };
    }
    return { ok: true, sent: to.length };
  } catch (error) {
    return {
      ok: false,
      reason: "network",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Aviso corto de nota publicada: título, entradilla y el enlace. Sirve para el equipo y para quien se suscriba. */
export function buildStoryNotice(article: {
  title: string;
  excerpt: string;
  url: string;
  section: string;
  author: string;
  unsubscribeUrl?: string;
}): { subject: string; text: string; html: string } {
  const subject = `📰 ${article.title.slice(0, 120)}`;
  const pie = article.unsubscribeUrl
    ? `\n\nSi ya no quieres estos avisos: ${article.unsubscribeUrl}`
    : "";
  const text = `${article.section} · por ${article.author}\n\n${article.title}\n\n${article.excerpt}\n\nLeer la nota: ${article.url}${pie}`;
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#0b1f3a">
<p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5b6b82;margin:0 0 6px">${escapeHtml(article.section)} · por ${escapeHtml(article.author)}</p>
<h1 style="font-size:22px;line-height:1.25;margin:0 0 12px">${escapeHtml(article.title)}</h1>
<p style="font-size:15px;line-height:1.6;color:#1f2a3d;margin:0 0 20px">${escapeHtml(article.excerpt)}</p>
<p style="margin:0 0 24px"><a href="${article.url}" style="background:#FFD60A;color:#0b1f3a;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:999px;display:inline-block">Leer la nota</a></p>
<p style="font-size:12px;color:#5b6b82;border-top:1px solid #e6e2d6;padding-top:12px;margin:0">losupe.com${
    article.unsubscribeUrl
      ? ` · <a href="${article.unsubscribeUrl}" style="color:#5b6b82">darse de baja</a>`
      : ""
  }</p>
</div>`;
  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
