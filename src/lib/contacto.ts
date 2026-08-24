import { z } from "zod";
import { mailConfigured, sendMail, parseRecipients, type MailEnv } from "@/lib/mail";
import { getSetting } from "./robot/budget";

/**
 * Formulario de contacto.
 *
 * No es un adorno: Google Noticias exige saber **quién está detrás** de un medio y penaliza la
 * opacidad. Una dirección de correo visible y una forma real de escribirnos son de las primeras
 * cosas que se miran, tanto un revisor como el algoritmo.
 *
 * El mensaje llega a los mismos correos internos que ya reciben el aviso de nota publicada
 * (`settings.notify_emails`), así no hay una segunda lista que mantener.
 */

export const contactoSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  asunto: z.string().trim().max(160).optional().default(""),
  mensaje: z.string().trim().min(10).max(4000),
  lang: z.enum(["es", "en"]).default("es"),
  // Campo trampa: los formularios los rellenan robots que completan TODO lo que ven. Una persona
  // nunca lo ve, porque va escondido. Si viene lleno, el mensaje se descarta sin decir nada.
  web: z.string().max(200).optional().default(""),
});

export type ContactoInput = z.infer<typeof contactoSchema>;

export type ContactoResult =
  | { ok: true; state: "enviado" | "descartado" }
  | { ok: false; reason: "invalido" | "sincorreo" | "error"; detail?: string };

function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Limpia un texto que va a una CABECERA del correo (el asunto).
 *
 * Dos motivos, y el segundo es de seguridad de verdad: un salto de línea dentro del asunto permite
 * inyectar cabeceras nuevas —incluida una copia oculta a un tercero—, que es un truco viejo y muy
 * conocido contra los formularios de contacto. Y de paso, un asunto con etiquetas HTML se ve fatal
 * en la bandeja de entrada.
 */
export function limpiarCabecera(texto: string): string {
  return texto
    .replace(/[\r\n\t]+/g, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function construirMensaje(input: ContactoInput): {
  subject: string;
  text: string;
  html: string;
} {
  const asunto =
    limpiarCabecera(input.asunto) || (input.lang === "en" ? "New message" : "Mensaje nuevo");
  const subject = `✉️ ${asunto} — ${limpiarCabecera(input.nombre)}`.slice(0, 160);
  const text = `${input.nombre} <${input.email}>\n\n${input.mensaje}\n\n— Formulario de contacto de losupe.com (${input.lang})`;
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;color:#0b1f3a">
<p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5b6b82;margin:0 0 6px">Contacto · losupe.com</p>
<h1 style="font-size:20px;line-height:1.3;margin:0 0 4px">${escapar(asunto)}</h1>
<p style="margin:0 0 16px;font-size:14px;color:#5b6b82">De: <strong>${escapar(input.nombre)}</strong> &lt;${escapar(input.email)}&gt;</p>
<p style="font-size:15px;line-height:1.7;white-space:pre-wrap;margin:0 0 20px">${escapar(input.mensaje)}</p>
<p style="font-size:12px;color:#5b6b82;border-top:1px solid #e6e2d6;padding-top:12px;margin:0">Responde directamente a este correo para contestarle.</p>
</div>`;
  return { subject, text, html };
}

export async function enviarContacto(
  db: D1Database,
  env: MailEnv,
  input: ContactoInput,
  fetchImpl: typeof fetch = fetch,
  enSegundoPlano?: (p: Promise<unknown>) => void,
): Promise<ContactoResult> {
  // Robot cazado: se le contesta igual que a una persona para que no aprenda nada, pero no se manda
  // nada a nadie.
  if (input.web.trim() !== "") return { ok: true, state: "descartado" };
  if (!mailConfigured(env)) return { ok: false, reason: "sincorreo" };
  try {
    const destinos = parseRecipients(await getSetting(db, "notify_emails"));
    if (destinos.length === 0) return { ok: false, reason: "sincorreo" };
    const mensaje = construirMensaje(input);
    // `replyTo` con el correo de quien escribe: se le contesta dándole a «Responder», sin copiar
    // direcciones a mano.
    const envio = () =>
      sendMail(env, { to: destinos, replyTo: input.email, ...mensaje }, fetchImpl);
    if (enSegundoPlano) {
      enSegundoPlano(envio());
      return { ok: true, state: "enviado" };
    }
    const res = await envio();
    if (!res.ok) return { ok: false, reason: "error", detail: res.reason };
    return { ok: true, state: "enviado" };
  } catch (e) {
    return { ok: false, reason: "error", detail: e instanceof Error ? e.message : String(e) };
  }
}
