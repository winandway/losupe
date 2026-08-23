/**
 * Grupos de sinónimos y equivalencias (español/inglés) para el buscador.
 * Cada grupo es un conjunto de términos intercambiables; si el usuario escribe uno,
 * se buscan todos. Se amplía con el tiempo (el robot puede proponer grupos nuevos).
 */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["bitcoin", "btc"],
  ["ethereum", "eth", "ether"],
  ["cripto", "criptomonedas", "criptomoneda", "crypto", "cryptocurrency", "cryptocurrencies"],
  ["ia", "inteligencia artificial", "ai", "artificial intelligence"],
  ["eeuu", "ee uu", "estados unidos", "usa", "united states", "us", "norteamerica"],
  ["dolar", "dolares", "usd", "dollar", "dollars"],
  [
    "tienda",
    "tienda en linea",
    "ecommerce",
    "e-commerce",
    "comercio electronico",
    "online store",
    "marketplace",
  ],
  ["empresa", "startup", "negocio", "compania", "company", "business", "emprendimiento"],
  ["emprendedor", "empresario", "fundador", "founder", "entrepreneur", "ceo"],
  ["ventas", "vender", "venta", "sales", "sell", "selling"],
  ["chatgpt", "openai", "gpt"],
  ["claude", "anthropic"],
  ["gemini", "google ai", "bard"],
  ["usdt", "tether"],
  ["stablecoin", "stablecoins", "moneda estable", "monedas estables"],
  ["fed", "reserva federal", "federal reserve"],
  ["inflacion", "inflation", "precios"],
  ["remesas", "remesa", "remittances", "envio de dinero"],
  ["musica", "music", "cancion", "song"],
  ["artista", "artistas", "artist", "cantante", "singer"],
  ["pelicula", "peliculas", "cine", "movie", "film"],
  ["amazon", "ebay", "gigantes del comercio"],
  ["venezuela", "venezolano", "venezolana", "venezuelan"],
  ["colombia", "colombiano", "colombiana", "colombian"],
  ["chile", "chileno", "chilena"],
  ["mercado", "mercados", "market", "markets", "bolsa", "wall street"],
  ["tasa", "tasas", "interes", "intereses", "rates", "interest rate"],
  ["celular", "movil", "smartphone", "telefono", "phone", "iphone", "android"],
  ["trabajo", "empleo", "jobs", "work", "laboral"],
  ["ahorro", "ahorrar", "savings", "save money"],
  ["impuestos", "taxes", "irs", "tributario"],
  ["etf", "fondo cotizado", "fondos"],
  ["xrp", "ripple"],
  ["nvidia", "chips", "semiconductores"],
  ["tesla", "musk", "elon"],
  ["mercatren", "pedro llerena"],
  ["regulacion", "regulation", "ley", "sec", "regulador"],
  ["banco", "bancos", "bank", "banks", "banca"],
  ["tecnologia", "tech", "technology", "tecnologica"],
  ["noticias", "news", "actualidad"],
  ["guia", "guias", "guide", "how to", "como"],
];

const INDEX: Map<string, readonly string[]> = (() => {
  const m = new Map<string, readonly string[]>();
  for (const group of SYNONYM_GROUPS) for (const term of group) m.set(term, group);
  return m;
})();

/** Quita acentos y signos, baja a minúsculas, colapsa espacios. */
export function normalizeTerm(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Devuelve el término y todos sus equivalentes (sin repetir). */
export function synonymsFor(term: string): string[] {
  const key = normalizeTerm(term);
  const group = INDEX.get(key);
  if (!group) return [key];
  return [key, ...group.filter((t) => t !== key)];
}
