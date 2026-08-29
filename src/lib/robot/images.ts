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
/**
 * PESO DE LAS IMÁGENES.
 *
 * El 29 ago 2026, midiendo la portada: se descargaba una foto de **1880×1253 y 427 KB** para
 * mostrarla a **142×80 píxeles** en una tarjeta. Trece veces más grande de lo necesario, en cada
 * visita y en cada tarjeta. Es lo que más pesaba de toda la página, por delante del video.
 *
 * Pexels sirve la imagen al tamaño que se le pida por la propia dirección, así que no hace falta
 * ninguna librería: se piden dos tallas y se guardan las dos. La grande abre la nota; la pequeña va
 * en las tarjetas de portada y de sección.
 */
export const ANCHO_GRANDE = 1600;
export const ANCHO_TARJETA = 640;

/** Añade a una dirección de Pexels el ancho y la compresión. Si no es de Pexels, la deja igual. */
export function aMedida(url: string, ancho: number): string {
  if (!/images\.pexels\.com/i.test(url)) return url;
  const base = url.split("?")[0];
  return `${base}?auto=compress&cs=tinysrgb&fit=crop&w=${ancho}`;
}

/** El nombre de la versión pequeña de una imagen guardada. */
export function rutaMiniatura(url: string): string {
  return url.replace(/\.(jpg|jpeg|png|webp)$/i, "-sm.$1");
}

async function guardarMiniatura(
  bucket: R2Bucket | undefined,
  slug: string,
  url: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  try {
    const { bytes, type } = await download(url, fetchImpl);
    await storeImage(bucket, `notas/${slug}-sm.jpg`, bytes, type);
  } catch {
    // Sin miniatura la nota se ve igual, solo pesa más: nunca se cae por esto.
  }
}

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
  // Se guardan DOS tallas: la grande para la nota y una pequeña para las tarjetas. Ver `aMedida()`.
  const { bytes, type } = await download(aMedida(src, ANCHO_GRANDE), fetchImpl);
  const stored = await storeImage(opts.env.BUCKET, `notas/${opts.slug}.jpg`, bytes, type);
  if (stored) {
    await guardarMiniatura(opts.env.BUCKET, opts.slug, aMedida(src, ANCHO_TARJETA), fetchImpl);
  }
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

export const PEXELS_VIDEO_ENDPOINT = "https://api.pexels.com/videos/search";

export type StockVideo = {
  src: string;
  poster: string | null;
  credit: string;
  pageUrl: string;
  duration: number;
  width: number;
  height: number;
};

/**
 * Video corto de archivo en Pexels (gratis, con crédito). No se copia a R2: se enlaza el archivo
 * que Pexels sirve. Se elige HD apaisado de entre 5 y 40 segundos.
 */
export async function findPexelsVideo(
  keywords: readonly string[],
  apiKey: string | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<StockVideo | null> {
  if (!apiKey || keywords.length === 0) return null;
  const url = new URL(PEXELS_VIDEO_ENDPOINT);
  url.searchParams.set("query", keywords.slice(0, 3).join(" "));
  url.searchParams.set("per_page", "8");
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("size", "medium");
  const res = await fetchImpl(url, {
    headers: { Authorization: apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Pexels (videos) respondió ${res.status}`);
  const body = (await res.json()) as {
    videos?: {
      url?: string;
      image?: string;
      duration?: number;
      user?: { name?: string };
      video_files?: {
        link?: string;
        quality?: string;
        width?: number;
        height?: number;
        file_type?: string;
      }[];
    }[];
  };
  const pick = (body.videos ?? [])
    .filter((v) => (v.duration ?? 0) >= 5 && (v.duration ?? 0) <= 40)
    .map((v) => {
      const files = (v.video_files ?? [])
        .filter(
          (f) =>
            f.link &&
            (f.file_type ?? "video/mp4").includes("mp4") &&
            (f.width ?? 0) >= (f.height ?? 0),
        )
        .sort((a, b) => Math.abs((a.width ?? 0) - 1280) - Math.abs((b.width ?? 0) - 1280));
      const f = files[0];
      return f
        ? {
            src: f.link!,
            poster: v.image ?? null,
            credit: `Video: ${v.user?.name ?? "Pexels"} / Pexels`,
            pageUrl: v.url ?? "https://www.pexels.com",
            duration: v.duration ?? 0,
            width: f.width ?? 0,
            height: f.height ?? 0,
          }
        : null;
    })
    .filter((x): x is StockVideo => x !== null);
  return pick[0] ?? null;
}

/** Inserta el video como <figure> después del primer párrafo de la nota. */
export function embedVideo(contentHtml: string, video: StockVideo, caption: string): string {
  const figure = `\n<figure class="nota-video"><video controls preload="metadata" playsinline${
    video.poster ? ` poster="${video.poster}"` : ""
  } src="${video.src}" width="${video.width || 1280}" height="${video.height || 720}"></video><figcaption>${caption} · ${video.credit}</figcaption></figure>\n`;
  const i = contentHtml.indexOf("</p>");
  if (i < 0) return contentHtml + figure;
  return contentHtml.slice(0, i + 4) + figure + contentHtml.slice(i + 4);
}
