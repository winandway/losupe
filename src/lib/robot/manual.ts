import { z } from "zod";
import type { SectionId } from "@/lib/sections";
import { SECTIONS } from "@/lib/sections";
import { saveArticle } from "./publish";
import { generateJson } from "./gemini";
import { finalizeDraft, SYSTEM_PROMPT, type Draft } from "./writer";
import { illustrate } from "./images";
import { pickWriter } from "./authors";
import { getSetting } from "./budget";

/**
 * Notas escritas a mano desde el panel. Dos caminos:
 *  - «Redactar con IA»: se le da el tema y unas notas sueltas, y la IA escribe la nota completa en
 *    español e inglés con las mismas reglas del robot (voz humana, fuentes citadas, nada inventado).
 *  - «Tal cual»: se publica el texto escrito por la persona; la IA solo lo traduce al inglés y arma
 *    los datos que faltan (extracto, meta, etiquetas), sin cambiar el fondo de lo escrito.
 */

const sectionIds = SECTIONS.map((s) => s.id) as [string, ...string[]];

export const manualSchema = z.object({
  modo: z.enum(["ia", "propio"]),
  titulo: z.string().trim().min(6).max(200),
  cuerpo: z.string().trim().min(40).max(30_000),
  sectionId: z.enum(sectionIds),
  kind: z.enum(["news", "evergreen"]).default("news"),
  fuentes: z.string().trim().max(2000).optional().default(""),
  autorId: z.string().trim().max(60).optional().default(""),
  publicar: z.enum(["si", "no"]).default("no"),
});
export type ManualInput = z.infer<typeof manualSchema>;

export function parseSourceLines(raw: string): { title: string; url: string }[] {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^https?:\/\/\S+$/i.test(l.split(/\s+/)[0] ?? ""))
    .slice(0, 8)
    .map((l) => {
      const [url, ...rest] = l.split(/\s+/);
      const title = rest.join(" ").trim();
      let host = url ?? "";
      try {
        host = new URL(url!).hostname.replace(/^www\./, "");
      } catch {
        /* se queda la URL como nombre */
      }
      return { title: title || host, url: url! };
    });
}

/** Prompt para el modo «Redactar con IA»: el tema y las notas de la persona son el material. */
export function buildManualPrompt(
  input: ManualInput,
  sources: { title: string; url: string }[],
): string {
  const section = SECTIONS.find((s) => s.id === input.sectionId);
  return `ENCARGO DE LA REDACCIÓN: escribe esta nota para la sección "${section?.name.es ?? input.sectionId}".

TITULAR PROPUESTO (puedes mejorarlo manteniendo el sentido): ${input.titulo}
TIPO: ${input.kind === "evergreen" ? "GUÍA DURADERA que siga sirviendo dentro de un año" : "NOTICIA del día"}

LO QUE NOS PASÓ LA REDACCIÓN (material de base, escrito por una persona del equipo). Respétalo: no lo contradigas ni añadas datos que no estén aquí o en las fuentes.

${input.cuerpo}
${
  sources.length > 0
    ? `\nFUENTES PARA CITAR (enlázalas en la frase donde uses su dato):\n${sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}`
    : "\nNo hay fuentes externas: no inventes ninguna ni cites medios que no estén aquí."
}`;
}

/** Modo «Tal cual»: se conserva el texto de la persona y la IA solo completa lo que falta. */
export function buildTranslatePrompt(input: ManualInput): string {
  const section = SECTIONS.find((s) => s.id === input.sectionId);
  return `TAREA: esta nota ya está escrita por una persona de la redacción de losupe, para la sección "${section?.name.es ?? input.sectionId}".

NO reescribas el fondo ni cambies los datos. Tu trabajo es:
1. Dejar el texto en español limpio y bien maquetado en HTML (<p>, <h2>, <h3>, <ul>, <li>, <strong>, <em>, <a>), respetando lo que dice. Corrige solo ortografía y puntuación.
2. Escribir la versión en inglés, nativa y natural (no traducción literal).
3. Completar lo que falta: extracto, meta_title, meta_description y etiquetas, en los dos idiomas.

TITULAR: ${input.titulo}

TEXTO DE LA REDACCIÓN:
${input.cuerpo}`;
}

export type ManualEnv = {
  DB: D1Database;
  GEMINI_API_KEY?: string;
  BUCKET?: R2Bucket;
  FAL_KEY?: string;
  PEXELS_API_KEY?: string;
};

export type ManualResult = {
  ok: boolean;
  articleId?: string;
  path?: string;
  status?: "published" | "review";
  title?: string;
  costUsd?: number;
  error?: string;
};

/** Escribe (o maqueta) la nota manual, la ilustra y la guarda. */
export async function createManualStory(
  env: ManualEnv,
  input: ManualInput,
  opts: { fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<ManualResult> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? new Date();
  if (!env.GEMINI_API_KEY) {
    return {
      ok: false,
      error: "Falta GEMINI_API_KEY: sin ella no se puede armar la versión en inglés.",
    };
  }
  const sources = parseSourceLines(input.fuentes ?? "");
  const prompt =
    input.modo === "ia" ? buildManualPrompt(input, sources) : buildTranslatePrompt(input);
  try {
    const usage = await generateJson<unknown>({
      apiKey: env.GEMINI_API_KEY,
      model: "gemini-2.5-flash",
      system: SYSTEM_PROMPT,
      prompt,
      temperature: input.modo === "ia" ? 0.7 : 0.35,
      maxOutputTokens: 16_000,
      fetchImpl,
    });
    // El texto lo trae la propia redacción: no se aplica el control anticopia contra él.
    const draft: Draft = finalizeDraft(usage.data, []);
    const sectionId = input.sectionId as SectionId;
    // Nunca se firma con alguien inactivo, aunque el ajuste lo diga.
    const porTurno = (await pickWriter(env.DB, sectionId).catch(() => null))?.id;
    const ajuste = await getSetting(env.DB, "default_author");
    const ajusteValido = ajuste
      ? (
          await env.DB.prepare(`SELECT id FROM authors WHERE id = ?1 AND active = 1`)
            .bind(ajuste)
            .first<{ id: string }>()
        )?.id
      : undefined;
    const authorId = input.autorId || porTurno || ajusteValido || "equipo-losupe";

    const { image } = await illustrate({
      env,
      db: env.DB,
      prompt: draft.image_prompt,
      keywords: draft.image_keywords,
      slug: `${now.toISOString().slice(0, 10)}-${draft.es.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 60)}`,
      fetchImpl,
    });

    const saved = await saveArticle(env.DB, {
      draft,
      sectionId,
      authorId,
      origin: "robot",
      status: input.publicar === "si" ? "published" : "review",
      sources,
      image: image ? { url: image.url, credit: image.credit } : null,
      now,
    });
    return {
      ok: true,
      articleId: saved.articleId,
      path: saved.pathEs,
      status: saved.status,
      title: draft.es.title,
      costUsd: usage.costUsd,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
