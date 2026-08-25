/**
 * Wikipedia como fuente para las piezas propias.
 *
 * Una lista de «10 curiosidades sobre bitcoin» es justo el género donde una IA se pone a inventar
 * datos que suenan bien y no lo son. La regla del proyecto no cambia por ser una pieza propia: cada
 * dato sale de algo que se pueda enlazar. Wikipedia sirve para esto porque es abierta, no cuesta
 * nada, cita sus propias fuentes y se puede enlazar sin problema.
 *
 * No es la única fuente ni la mejor para actualidad —para eso están los medios del RSS—, pero para
 * datos históricos y de contexto es exactamente lo que hace falta.
 */

const BUSQUEDA = "https://es.wikipedia.org/w/api.php";

type RespuestaBusqueda = { query?: { search?: { title?: string; pageid?: number }[] } };

export function urlDeArticulo(titulo: string): string {
  return `https://es.wikipedia.org/wiki/${encodeURIComponent(titulo.replace(/ /g, "_"))}`;
}

/**
 * Artículos de Wikipedia sobre un tema, para documentar una pieza propia. Devuelve lista vacía si
 * algo falla: el diario sigue con lo demás en vez de caerse.
 */
export async function buscarArticulos(
  tema: string,
  limite = 3,
  fetchImpl: typeof fetch = fetch,
): Promise<{ titulo: string; url: string }[]> {
  const url = `${BUSQUEDA}?action=query&list=search&srsearch=${encodeURIComponent(
    tema,
  )}&srlimit=${limite}&format=json&origin=*`;
  try {
    const res = await fetchImpl(url, {
      headers: { "user-agent": "losupe.com/1.0 (https://losupe.com)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as RespuestaBusqueda;
    return (body.query?.search ?? [])
      .map((r) => r.title ?? "")
      .filter(Boolean)
      .map((titulo) => ({ titulo, url: urlDeArticulo(titulo) }));
  } catch {
    return [];
  }
}
