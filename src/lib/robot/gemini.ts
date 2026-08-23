import { assertTextModelAllowed, textCostUsd, type TextModel } from "./model-guard";

/**
 * Cliente mínimo de Gemini (REST, sin SDK): una llamada, respuesta JSON, costo calculado.
 * La clave viaja en la cabecera `x-goog-api-key` (nunca en la URL).
 */

export const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export type GeminiJsonResult<T> = {
  data: T;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  model: TextModel;
};

export class GeminiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export type GeminiOptions = {
  apiKey: string;
  model: TextModel;
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** Quita vallas ```json ... ``` si el modelo las devuelve igual. */
export function extractJson(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = fenced?.[1] ?? trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

export async function generateJson<T>(opts: GeminiOptions): Promise<GeminiJsonResult<T>> {
  assertTextModelAllowed(opts.model);
  if (!opts.apiKey) throw new GeminiError("Falta GEMINI_API_KEY");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(`${GEMINI_ENDPOINT}/${opts.model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: opts.temperature ?? 0.7,
        maxOutputTokens: opts.maxOutputTokens ?? 8192,
      },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new GeminiError(`Gemini respondió ${res.status}: ${detail}`, res.status);
  }
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    promptFeedback?: { blockReason?: string };
  };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) {
    const why = body.promptFeedback?.blockReason ?? body.candidates?.[0]?.finishReason ?? "vacío";
    throw new GeminiError(`Gemini no devolvió texto (${why})`);
  }
  let data: T;
  try {
    data = JSON.parse(extractJson(text)) as T;
  } catch {
    throw new GeminiError("Gemini devolvió un JSON inválido");
  }
  const inputTokens = body.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = body.usageMetadata?.candidatesTokenCount ?? 0;
  return {
    data,
    inputTokens,
    outputTokens,
    costUsd: textCostUsd(opts.model, inputTokens, outputTokens),
    model: opts.model,
  };
}
