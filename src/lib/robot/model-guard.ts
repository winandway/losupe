/**
 * BLOQUEO EN CÓDIGO de modelos caros (regla global obligatoria).
 *
 * Dos facturas desastrosas ($500+ y $200+) por modelos de imagen caros. Las reglas escritas no
 * bastaron: el bloqueo va aquí, delante de cada llamada. Cambiar la lista blanca requiere
 * autorización EXPLÍCITA de Richard con el costo por imagen por escrito.
 */

/** Modelos de texto permitidos y su precio por millón de tokens (entrada / salida), en USD. */
export const TEXT_MODELS = {
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
} as const;
export type TextModel = keyof typeof TEXT_MODELS;

/** Modelos/proveedores de imagen permitidos y su costo por imagen (USD). Tope: $0.05. */
export const IMAGE_MODELS = {
  "fal-ai/bytedance/seedream/v4/text-to-image": 0.03,
  "workers-ai/@cf/black-forest-labs/flux-1-schnell": 0.0002,
  pexels: 0,
} as const;
export type ImageModel = keyof typeof IMAGE_MODELS;

export const MAX_IMAGE_COST_USD = 0.05;

/** Lista negra explícita (por si alguien los escribe en un ajuste del panel). NUNCA corren. */
export const BLOCKED_IMAGE_MODELS: readonly string[] = [
  "gpt-image-1",
  "gpt-image-1-high",
  "gpt-image-1-medium",
  "dall-e-3",
  "dall-e-2",
  "imagen-4",
  "imagen-4-ultra",
  "imagen-3",
  "fal-ai/flux-pro",
  "fal-ai/flux-pro/v1.1",
  "fal-ai/flux-pro/v1.1-ultra",
  "fal-ai/ideogram/v2",
  "fal-ai/ideogram/v3",
  "fal-ai/recraft-v3",
  "fal-ai/stable-diffusion-v35-large",
  "midjourney",
  "stability-ai/sd3",
  "stability-ai/stable-image-ultra",
];

export class ModelBlockedError extends Error {
  constructor(model: string, reason: string) {
    super(`Modelo bloqueado: ${model} (${reason})`);
    this.name = "ModelBlockedError";
  }
}

/** Lanza si el modelo de imagen no está en la lista blanca o supera el tope por imagen. */
export function assertImageModelAllowed(model: string): asserts model is ImageModel {
  if (BLOCKED_IMAGE_MODELS.includes(model)) {
    throw new ModelBlockedError(model, "está en la lista negra de modelos caros");
  }
  if (!(model in IMAGE_MODELS)) {
    throw new ModelBlockedError(model, "no está en la lista blanca");
  }
  const cost = IMAGE_MODELS[model as ImageModel];
  if (cost > MAX_IMAGE_COST_USD) {
    throw new ModelBlockedError(model, `cuesta $${cost} por imagen, tope $${MAX_IMAGE_COST_USD}`);
  }
}

/** Lanza si el modelo de texto no está en la lista blanca. */
export function assertTextModelAllowed(model: string): asserts model is TextModel {
  if (!(model in TEXT_MODELS)) {
    throw new ModelBlockedError(model, "no está en la lista blanca de modelos de texto");
  }
}

/** Costo en USD de una llamada de texto según tokens. */
export function textCostUsd(model: TextModel, inputTokens: number, outputTokens: number): number {
  const p = TEXT_MODELS[model];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}
