import { z } from "zod";
import type { Lang } from "@/i18n/config";
import { sendMail, type MailEnv } from "@/lib/mail";
import { SQL_NOW } from "./sql-time";

/**
 * Suscriptores del aviso de notas nuevas. Doble confirmación (nadie queda apuntado sin haber tocado
 * el enlace de su correo): así no somos spam y el servicio de correo del sitio no se quema.
 */

export const subscribeSchema = z.object({
  email: z.string().trim().email().max(200),
  lang: z.enum(["es", "en"]).default("es"),
});

export type SubscribeResult =
  | { ok: true; state: "pending" | "already" }
  | { ok: false; reason: "invalid" | "mail" | "error"; detail?: string };

function newToken(): string {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().slice(0, 8);
}

const TEXTS = {
  es: {
    subject: "Confirma que quieres recibir las notas de losupe",
    intro:
      "Casi listo. Toca el botón para empezar a recibir un aviso corto cada vez que publiquemos.",
    button: "Sí, quiero recibirlas",
    ignore: "Si no fuiste tú, ignora este correo y no pasa nada.",
  },
  en: {
    subject: "Confirm you want losupe stories",
    intro: "Almost there. Tap the button to start getting a short alert every time we publish.",
    button: "Yes, send them to me",
    ignore: "If this wasn't you, just ignore this email.",
  },
} as const;

export async function subscribe(
  db: D1Database,
  env: MailEnv,
  base: string,
  input: { email: string; lang: Lang },
  fetchImpl: typeof fetch = fetch,
): Promise<SubscribeResult> {
  const email = input.email.trim().toLowerCase();
  try {
    const existing = await db
      .prepare(`SELECT status FROM subscribers WHERE email = ?1`)
      .bind(email)
      .first<{ status: string }>();
    if (existing?.status === "confirmed") return { ok: true, state: "already" };

    const token = newToken();
    await db
      .prepare(
        `INSERT INTO subscribers (id, email, lang, status, token) VALUES (?1, ?2, ?3, 'pending', ?4)
         ON CONFLICT(email) DO UPDATE SET token = ?4, lang = ?3, status = 'pending'`,
      )
      .bind(crypto.randomUUID(), email, input.lang, token)
      .run();

    const t = TEXTS[input.lang];
    const url = `${base}/datos/boletin?alta=${encodeURIComponent(token)}`;
    const res = await sendMail(
      env,
      {
        to: [email],
        subject: t.subject,
        text: `${t.intro}\n\n${url}\n\n${t.ignore}`,
        html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;color:#0b1f3a">
<p style="font-size:16px;line-height:1.6;margin:0 0 20px">${t.intro}</p>
<p style="margin:0 0 24px"><a href="${url}" style="background:#FFD60A;color:#0b1f3a;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;display:inline-block">${t.button}</a></p>
<p style="font-size:12px;color:#5b6b82;margin:0">${t.ignore}</p></div>`,
      },
      fetchImpl,
    );
    if (!res.ok) return { ok: false, reason: "mail", detail: res.reason };
    return { ok: true, state: "pending" };
  } catch (error) {
    return { ok: false, reason: "error", detail: error instanceof Error ? error.message : "" };
  }
}

export async function confirmSubscriber(db: D1Database, token: string): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE subscribers SET status = 'confirmed', confirmed_at = ${SQL_NOW} WHERE token = ?1 AND status = 'pending'`,
    )
    .bind(token)
    .run();
  if ((res.meta?.changes ?? 0) > 0) return true;
  const ya = await db
    .prepare(`SELECT 1 AS x FROM subscribers WHERE token = ?1 AND status = 'confirmed'`)
    .bind(token)
    .first();
  return Boolean(ya);
}

export async function unsubscribe(db: D1Database, token: string): Promise<boolean> {
  const res = await db
    .prepare(
      `UPDATE subscribers SET status = 'unsubscribed', unsubscribed_at = ${SQL_NOW} WHERE token = ?1`,
    )
    .bind(token)
    .run();
  return (res.meta?.changes ?? 0) > 0;
}

export async function countConfirmed(db: D1Database): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM subscribers WHERE status = 'confirmed'`)
    .first<{ n: number }>();
  return Number(row?.n ?? 0);
}
