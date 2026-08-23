import { assertImageModelAllowed, IMAGE_MODELS } from "./model-guard";
import { recordSpend } from "./budget";

/**
 * Ilustración de notas. Orden: Seedream 4 en fal.ai (prepago, $0.03) → Pexels (gratis, con crédito).
 * Si no hay llaves, devuelve null y la nota sale sin imagen (queda visible en el panel).
 * Modelos caros: BLOQUEADOS en código (model-guard). Nunca se escala a uno caro como respaldo.
 */

export type Illustration = {
  url: string;
  credit: string | null;
  provider: "fal" | "pexels";
  model: string;
};

export type ImageEnv = {
  BUCKET?: R2Bucket;
  FAL_KEY?: string;
  PEXELS_API_KEY?: string;
};

export type IllustrateOpts = {
  env: ImageEnv;
  db: D1Database;
  prompt: string;
  keywords: readonly string[];
  slug: string;
  runId?: string;
  fetchImpl?: typeof fetch;
};

export const FAL_SEEDREAM_MODEL = "fal-ai/bytedance/seedream/v4/text-to-image";
export const FAL_ENDPOINT = `https://fal.run/${FAL_SEEDREAM_MODEL}`;
export const PEXELS_ENDPOINT = "https://api.pexels.com/v1/search";

/** Ruta pública de un objeto guardado en R2 (la sirve el worker en /media/...). */
export function mediaPath(key: string): string {
  return `/media/${key.replace(/^\/+/, "")}`;
}

async function storeImage(
  bucket: R2Bucket | undefined,
  key: string,
  bytes: ArrayBuffer,
  contentType: string,
): Promise<string | null> {
  if (!bucket) return null;
  await bucket.put(key, bytes, {
    httpMetadata: { contentType, cacheControl: "public, max-age=31536000, immutable" },
  });
  return mediaPath(key);
}

async function download(url: string, fetchImpl: typeof fetch) {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`No se pudo descargar la imagen (${res.status})`);
  const type = res.headers.get("content-type") ?? "image/jpeg";
  return { bytes: await res.arrayBuffer(), type: type.split(";")[0] ?? "image/jpeg" };
}

export async function illustrateWithFal(opts: IllustrateOpts): Promise<Illustration | null> {
  const key = opts.env.FAL_KEY;
  if (!key) return null;
  assertImageModelAllowed(FAL_SEEDREAM_MODEL);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const res = await fetchImpl(FAL_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `${opts.prompt}. Editorial photo style, 16:9, no text, no logos, no watermarks.`,
      image_size: { width: 1600, height: 900 },
      num_images: 1,
      enable_safety_checker: true,
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`fal.ai respondió ${res.status}`);
  const body = (await res.json()) as { images?: { url?: string; content_type?: string }[] };
  const img = body.images?.[0]?.url;
  if (!img) throw new Error("fal.ai no devolvió imagen");
  await recordSpend(opts.db, {
    provider: "fal",
    model: FAL_SEEDREAM_MODEL,
    units: 1,
    costUsd: IMAGE_MODELS[FAL_SEEDREAM_MODEL],
    runId: opts.runId,
  });
  const { bytes, type } = await download(img, fetchImpl);
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const url = await storeImage(opts.env.BUCKET, `notas/${opts.slug}.${ext}`, bytes, type);
  return url
    ? {
        url,
        credit: "Imagen generada con IA (Seedream) para losupe",
        provider: "fal",
        model: FAL_SEEDREAM_MODEL,
      }
    : null;
}

export async function illustrateWithPexels(opts: IllustrateOpts): Promise<Illustration | null> {
  const key = opts.env.PEXELS_API_KEY;
  if (!key) return null;
  assertImageModelAllowed("pexels");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = new URL(PEXELS_ENDPOINT);
  url.searchParams.set("query", opts.keywords.slice(0, 3).join(" ") || "business");
  url.searchParams.set("per_page", "5");
  url.searchParams.set("orientation", "landscape");
  const res = await fetchImpl(url, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Pexels respondió ${res.status}`);
  const body = (await res.json()) as {
    photos?: { src?: { large2x?: string; large?: string }; photographer?: string; url?: string }[];
  };
  const photo = body.photos?.[0];
  const src = photo?.src?.large2x ?? photo?.src?.large;
  if (!photo || !src) return null;
  const { bytes, type } = await download(src, fetchImpl);
  const stored = await storeImage(opts.env.BUCKET, `notas/${opts.slug}.jpg`, bytes, type);
  return stored
    ? {
        url: stored,
        credit: `Foto: ${photo.photographer ?? "Pexels"} / Pexels`,
        provider: "pexels",
        model: "pexels",
      }
    : null;
}

/** Intenta cada proveedor permitido en orden; devuelve null si ninguno está configurado o todos fallan. */
export async function illustrate(
  opts: IllustrateOpts,
): Promise<{ image: Illustration | null; errors: string[] }> {
  const errors: string[] = [];
  for (const fn of [illustrateWithFal, illustrateWithPexels]) {
    try {
      const img = await fn(opts);
      if (img) return { image: img, errors };
    } catch (e) {
      errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { image: null, errors };
}
