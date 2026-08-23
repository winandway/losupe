/**
 * IndexNow: aviso inmediato a Bing, Yandex y demás buscadores que lo soportan cuando se publica
 * o cambia una URL. La clave es pública por diseño (se sirve en /<clave>.txt).
 */
// Clave pública por diseño (IndexNow la exige visible en /<clave>.txt); no es un secreto.
export const INDEXNOW_KEY = "a7c1f3e9b2d84f6c9e1a5b7d3f2c8e4a"; // gitleaks:allow

export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export function indexNowKeyPath(): string {
  return `/${INDEXNOW_KEY}.txt`;
}

export type IndexNowResult = { ok: boolean; status: number; sent: number };

export async function pingIndexNow(
  base: string,
  urls: readonly string[],
  fetchImpl: typeof fetch = fetch,
): Promise<IndexNowResult> {
  const origin = base.replace(/\/$/, "");
  const host = new URL(origin).host;
  const list = [...new Set(urls)].slice(0, 10_000);
  if (list.length === 0) return { ok: true, status: 0, sent: 0 };
  try {
    const res = await fetchImpl(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${origin}${indexNowKeyPath()}`,
        urlList: list,
      }),
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, sent: list.length };
  } catch {
    return { ok: false, status: 0, sent: list.length };
  }
}
