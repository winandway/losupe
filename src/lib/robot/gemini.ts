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

/**
 * EL FALLO QUE NO ES NUESTRO: «User location is not supported for the API use».
 *
 * El robot corre dentro del worker, y el worker corre en el centro de datos de Cloudflare más
 * cercano a quien entró al sitio. Si esa visita llega desde un país donde Google no da servicio,
 * Gemini responde 400 y la corrida muere — aunque la llave esté bien y el diario esté perfecto.
 * Medido en producción el 1 de octubre de 2026.
 *
 * No se arregla reintentando en el momento (el centro de datos es el mismo): se marca aparte para
 * que la corrida termine como SALTADA y no como error, y para que el tema vuelva a la cola intacto.
 * La siguiente visita, desde otro sitio, lo escribe.
 */
export class GeminiUbicacionError extends GeminiError {
  constructor(detalle: string) {
    super(`Gemini no atiende desde este centro de datos: ${detalle}`, 400);
    this.name = "GeminiUbicacionError";
  }
}

/** Fallos pasajeros del proveedor: aquí sí vale la pena volver a intentarlo. */
const REINTENTABLES = new Set([429, 500, 502, 503, 504]);
/** Dos reintentos como mucho, con una espera corta. Más sería hacer esperar a la corrida entera. */
export const REINTENTOS_GEMINI = 2;

export type GeminiOptions = {
  apiKey: string;
  model: TextModel;
  system: string;
  prompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Esquema de la respuesta. Con esto la API GARANTIZA JSON válido; sin esto, hay que rezar. */
  responseSchema?: unknown;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/** Quita vallas ```json ... ``` si el modelo las devuelve igual. */
export function extractJson(text: string): string {
  let trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  // Valla de markdown sin cerrar: pasa cuando la respuesta se corta a media escritura. Se quita la
  // de apertura igual, porque el JSON de dentro puede estar completo aunque falte el cierre.
  if (!fenced && /^```(?:json)?\s/i.test(trimmed)) {
    trimmed = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  const body = fenced?.[1] ?? trimmed;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  return start >= 0 && end > start ? body.slice(start, end + 1) : body;
}

/**
 * Arregla el JSON que devuelve el modelo cuando trae saltos de línea DENTRO de un texto.
 *
 * Este fue el fallo del 25 ago 2026, y costó dos días de diario sin publicar. El modelo devolvía un
 * JSON completo y bien cerrado —el error decía «motivo: STOP, 15107 caracteres» y terminaba en `}`—
 * pero `JSON.parse` lo rechazaba igual. El motivo: dentro del HTML de la nota venían saltos de línea
 * de verdad, y el formato JSON exige que ahí vaya `\n` escrito, no un salto real. Es un descuido
 * clásico de los modelos y no hay forma de pedirle que no lo haga: se arregla al leer.
 *
 * Recorre el texto sabiendo si está dentro o fuera de unas comillas, y escapa solo los caracteres de
 * control que estén dentro. Lo de fuera (los saltos entre campos) no se toca: ahí son legales.
 */
export function repararJson(texto: string): string {
  let out = "";
  let dentro = false;
  let escapado = false;
  for (const ch of texto) {
    if (escapado) {
      out += ch;
      escapado = false;
      continue;
    }
    if (ch === "\\") {
      out += ch;
      escapado = dentro;
      continue;
    }
    if (ch === '"') {
      dentro = !dentro;
      out += ch;
      continue;
    }
    if (dentro && ch === "\n") out += "\\n";
    else if (dentro && ch === "\r") out += "\\r";
    else if (dentro && ch === "\t") out += "\\t";
    else out += ch;
  }
  return out;
}

export async function generateJson<T>(opts: GeminiOptions): Promise<GeminiJsonResult<T>> {
  assertTextModelAllowed(opts.model);
  if (!opts.apiKey) throw new GeminiError("Falta GEMINI_API_KEY");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const pedir = () =>
    fetchImpl(`${GEMINI_ENDPOINT}/${opts.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
          temperature: opts.temperature ?? 0.7,
          maxOutputTokens: opts.maxOutputTokens ?? 8192,
        },
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 90_000),
    });
  let res = await pedir();
  // «Está muy ocupado» no es un fallo del diario: es un mal minuto del proveedor. Antes tumbaba la
  // corrida entera y la nota de esa franja no salía (1 oct 2026).
  for (let intento = 0; intento < REINTENTOS_GEMINI && REINTENTABLES.has(res.status); intento++) {
    await new Promise((listo) => setTimeout(listo, 1500 * (intento + 1)));
    res = await pedir();
  }
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    if (res.status === 400 && /location is not supported/i.test(detail)) {
      throw new GeminiUbicacionError(detail);
    }
    throw new GeminiError(`Gemini respondió ${res.status}: ${detail}`, res.status);
  }
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    promptFeedback?: { blockReason?: string };
  };
  const terminar = (data: T): GeminiJsonResult<T> => {
    const inputTokens = body.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = body.usageMetadata?.candidatesTokenCount ?? 0;
    return {
      data,
      inputTokens,
      outputTokens,
      costUsd: textCostUsd(opts.model, inputTokens, outputTokens),
      model: opts.model,
    };
  };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) {
    const why = body.promptFeedback?.blockReason ?? body.candidates?.[0]?.finishReason ?? "vacío";
    throw new GeminiError(`Gemini no devolvió texto (${why})`);
  }
  let data: T;
  const crudo = extractJson(text);
  try {
    data = JSON.parse(crudo) as T;
  } catch {
    // Segundo intento: casi siempre son saltos de línea sin escapar dentro del HTML de la nota.
    try {
      data = JSON.parse(repararJson(crudo)) as T;
      return terminar(data);
    } catch {
      /* si tampoco así, se cae al error de abajo, que sí explica qué pasó */
    }
    // NADA DE ERRORES MUDOS. «JSON inválido» a secas no dice si la respuesta se cortó, si vino con
    // texto de más o si el modelo se fue por otro lado, y sin eso no hay forma de arreglarlo: pasó
    // el 24 ago 2026 y costó una tarde. Aquí va la evidencia: por qué paró el modelo, cuánto
    // escribió y cómo termina el texto, que es donde se ve el corte.
    const razon = body.candidates?.[0]?.finishReason ?? "?";
    // La posición exacta del fallo: es lo que dice si sobra una comilla, falta una coma o hay un
    // carácter de control. Sin ella solo se sabe «está mal», que no lleva a ninguna parte.
    let donde = "";
    try {
      JSON.parse(crudo);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      const pos = Number(/position (\d+)/.exec(msg)?.[1] ?? NaN);
      donde = Number.isFinite(pos)
        ? ` Falla en el carácter ${pos}: «…${crudo.slice(Math.max(0, pos - 60), pos + 40).replace(/\s+/g, " ")}…»`
        : ` ${msg}`;
    }
    const final = text.slice(-80).replace(/\s+/g, " ");
    const cortada = razon === "MAX_TOKENS";
    throw new GeminiError(
      cortada
        ? `La respuesta se cortó por el límite de tokens (${text.length} caracteres escritos). Termina en: «…${final}»`
        : `Gemini devolvió un JSON inválido (motivo del modelo: ${razon}, ${text.length} caracteres).${donde} Termina en: «…${final}»`,
    );
  }
  return terminar(data);
}
