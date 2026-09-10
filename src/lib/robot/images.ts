import { CON_MINIATURA } from "@/lib/miniaturas-locales";
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
/**
 * La versión pequeña de una imagen, para las tarjetas.
 *
 * Se pide en dos casos, y **solo cuando existe de verdad**:
 *  - Imágenes de `/media/` (R2): el robot guarda las dos tallas, y además el worker sirve la grande
 *    si la pequeña falta. Siempre seguro.
 *  - Imágenes locales que están en `CON_MINIATURA`, la lista que genera `npm run miniaturas`.
 *
 * Antes inventaba el `-sm` para TODAS y ahí estaba el fallo que vio Richard el 10 sep 2026: las
 * notas sembradas a mano llevan sus imágenes en `/img/notas/...`, que las sirve el servidor de
 * estáticos. Ese servidor **no tiene el respaldo que sí tiene R2**, así que devolvía 404 y en la
 * portada salía el recuadro roto con el texto alternativo. La nota se veía bien al abrirla y muerta
 * en la miniatura — que es justo donde se decide si alguien entra.
 *
 * La lista se genera, no se escribe a mano: en el worker no hay disco que consultar, y una lista a
 * mano se desactualiza al primer descuido.
 */
export function rutaMiniatura(url: string): string {
  const pequena = url.replace(/\.(jpg|jpeg|png|webp)$/i, "-sm.$1");
  if (pequena === url) return url; // no es una imagen con extensión conocida
  if (url.startsWith("/media/")) return pequena;
  return CON_MINIATURA.has(url) ? pequena : url;
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

/**
 * ELIGE LA FOTO QUE DE VERDAD CORRESPONDE, y si ninguna corresponde, no elige.
 *
 * El banco de fotos **siempre devuelve algo**, tenga que ver o no. Quedarse con la primera es lo que
 * puso una ola del mar en una nota de bancos (31 ago 2026) y un edificio nevado de Milwaukee en una
 * guía sobre un casillero en Miami (10 sep 2026). Afinar las palabras de búsqueda ayudó, pero no
 * cierra el agujero: mientras nadie mire el resultado, va a volver a pasar.
 *
 * Así que se mira. Cada foto trae su propia descripción (`alt`), y se exige que **coincida con lo
 * que se buscó**. Si ninguna de las quince coincide, se devuelve `null` y la nota se queda con su
 * portada dibujada — que es honesta. **Una foto que no tiene nada que ver es peor que no tener
 * foto**: el hueco no engaña, la foto equivocada sí, y hace pensar que el diario no lo mira nadie.
 */
export function elegirFoto<T extends { alt?: string }>(
  fotos: readonly T[],
  buscadas: readonly string[],
): T | undefined {
  if (fotos.length === 0) return undefined;
  const claves = buscadas.map((k) => k.toLowerCase().trim()).filter((k) => k.length > 2);
  // Sin palabras con las que comparar no se puede verificar NADA, y aceptar a ciegas es justo lo
  // que trajo la ola y el edificio nevado. Sin verificación no hay foto.
  if (claves.length === 0) return undefined;

  const puntos = (foto: T) => {
    const alt = (foto.alt ?? "").toLowerCase();
    if (!alt) return 0;
    return claves.filter((k) => alt.includes(k)).length;
  };
  let mejor: T | undefined;
  let mejorPuntos = 0;
  for (const foto of fotos) {
    const p = puntos(foto);
    if (p > mejorPuntos) {
      mejor = foto;
      mejorPuntos = p;
    }
  }
  // Ninguna descripción menciona nada de lo que buscábamos: mejor sin foto.
  return mejorPuntos > 0 ? mejor : undefined;
}

export async function illustrateWithPexels(opts: IllustrateOpts): Promise<Illustration | null> {
  const key = opts.env.PEXELS_API_KEY;
  if (!key) return null;
  assertImageModelAllowed("pexels");
  const fetchImpl = opts.fetchImpl ?? fetch;
  const buscadas = opts.keywords.slice(0, 3);
  const url = new URL(PEXELS_ENDPOINT);
  url.searchParams.set("query", buscadas.join(" ") || "business");
  // Se piden VARIAS y se elige la que de verdad corresponde, en vez de quedarse con la primera.
  url.searchParams.set("per_page", "15");
  url.searchParams.set("orientation", "landscape");
  const res = await fetchImpl(url, {
    headers: { Authorization: key },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Pexels respondió ${res.status}`);
  const body = (await res.json()) as {
    photos?: {
      src?: { large2x?: string; large?: string };
      photographer?: string;
      url?: string;
      alt?: string;
    }[];
  };
  const photo = elegirFoto(body.photos ?? [], buscadas);
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
