import { decodeEntities, stripHtml } from "@/lib/html";
import type { SectionId } from "@/lib/sections";
import { trustLevel } from "./trusted-sources";

/**
 * Tendencias: lo que la gente busca HOY. Fuente principal: el RSS público de Google Trends
 * (trends.google.com/trending/rss?geo=US, en español e inglés). Cada tendencia trae los artículos
 * que la explican; el robot toma el de la fuente más confiable y clasifica el tema en una sección.
 */

export type TrendItem = {
  trend: string;
  traffic: number;
  publishedAt: string | null;
  news: { title: string; url: string; source: string }[];
};

function tag(block: string, name: string): string {
  const open = block.indexOf(`<${name}`);
  if (open < 0) return "";
  const gt = block.indexOf(">", open);
  if (gt < 0 || block.charAt(gt - 1) === "/") return "";
  const close = block.indexOf(`</${name}`, gt + 1);
  if (close < 0) return "";
  return decodeEntities(
    block
      .slice(gt + 1, close)
      .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, "$1")
      .trim(),
  );
}

/** Parser del RSS de Google Trends (etiquetas ht:*). */
export function parseTrendsFeed(xml: string, limit = 25): TrendItem[] {
  const out: TrendItem[] = [];
  for (const m of xml.matchAll(/<item>[\s\S]*?<\/item>/gi)) {
    const block = m[0];
    const trend = stripHtml(tag(block, "title"));
    if (!trend) continue;
    const traffic = Number(
      (tag(block, "ht:approx_traffic").match(/[\d,.]+/)?.[0] ?? "0").replace(/[,.]/g, ""),
    );
    const date = tag(block, "pubDate");
    const publishedAt =
      date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : null;
    const news: TrendItem["news"] = [];
    for (const n of block.matchAll(/<ht:news_item>[\s\S]*?<\/ht:news_item>/gi)) {
      const url = tag(n[0], "ht:news_item_url");
      const title = stripHtml(tag(n[0], "ht:news_item_title"));
      const source = tag(n[0], "ht:news_item_source");
      if (url && /^https?:\/\//i.test(url) && title) news.push({ title, url, source });
    }
    out.push({ trend, traffic, publishedAt, news });
    if (out.length >= limit) break;
  }
  return out;
}

const SKIP = [
  /\b(vs\.?|partido|pron[oó]stico|cuotas|odds|bet|apuesta|bracket|score|marcador|goles?)\b/i,
  /\b(nfl|nba|mlb|nhl|ncaa|ufc|wwe|f1|nascar|pga|atp|wta|liga mx|la liga|premier league|champions league|copa mundial|mundial de f[uú]tbol|world cup|super bowl|playoffs?)\b/i,
  // Palabras de fichajes y plantillas: «CB Trevon Diggs signing 1-year deal with Seahawks» no
  // llevaba ni «NFL» ni «football», y por eso se coló (24 ago 2026).
  /\b(signing|signs with|traded to|trade deadline|free agent|draft pick|roster|lineup|coach|quarterback|fichaje|traspaso|convocatoria|entrenador)\b/i,
  /\b(f[uú]tbol|soccer|baseball|basketball|football|hockey|tennis|golf|boxing|boxeo|cricket|rugby)\b/i,
  /\b(powerball|mega millions|loter[ií]a|lottery|jackpot)\b/i,
  /\b(porn|xxx|onlyfans|desnud|nude)\b/i,
  /\b(tiroteo|shooting|asesinat|murder|homicid|suicid|masacre|massacre)\b/i,
];

const SECTION_RULES: [SectionId, RegExp][] = [
  [
    "cripto",
    /\b(bitcoin|btc|ethereum|eth|crypto|cripto|solana|xrp|stablecoin|binance|coinbase|blockchain|nft|memecoin|dogecoin)\b/i,
  ],
  [
    "tecnologia",
    /\b(ai|ia|inteligencia artificial|chatgpt|gemini|openai|anthropic|claude|apple|iphone|ipad|mac|google|microsoft|windows|nvidia|tesla|samsung|android|app|software|robot|meta|instagram|tiktok|whatsapp|youtube|spacex|starlink|cybersecurity|ciberseguridad|gadget|smartphone)\b/i,
  ],
  [
    "economia",
    /\b(inflaci[oó]n|inflation|fed|reserva federal|tasas?|interest rate|d[oó]lar|dollar|econom[ií]a|economy|bolsa|stocks?|wall street|s&p|dow|nasdaq|empleo|jobs?|desempleo|unemployment|impuestos?|tax(es)?|irs|precio|prices?|gasolina|gas prices|housing|vivienda|hipoteca|mortgage|salario|wage|tarifas?|tariffs?|pib|gdp|recesi[oó]n|recession|seguro social|social security|medicare|estímulo|stimulus)\b/i,
  ],
  [
    "ventas",
    /\b(emprend\w*|startup|negocio|business|ventas|sales|marketing|amazon|shopify|ecommerce|e-commerce|pyme|small business|franquicia|franchise|side hustle|ingreso extra|walmart|costco|target|black friday|prime day|descuentos?|deals?)\b/i,
  ],
  // «Artistas y tendencias» también necesita SU regla. Antes era el cajón donde caía todo lo que no
  // se reconocía, y ahí es donde se coló el fichaje de los Seahawks.
  [
    "artistas",
    /\b(cantante|singer|m[uú]sic\w*|music|[aá]lbum|album|canci[oó]n|song|gira|tour|concierto|concert|pel[ií]cula|movie|film|serie|series|netflix|disney|hbo|prime video|estreno|premiere|tr[aá]iler|trailer|actor|actriz|actress|artista|artist|celebridad|celebrity|famos\w*|grammy|[oó]scar|oscars|emmy|billboard|moda|fashion|influencer|viral|tiktoker|youtuber|podcast|libro|book|autor|author)\b/i,
  ],
];

/**
 * ¿Es un tema que no tocamos (deportes, apuestas, sucesos)? Se usa también para limpiar candidatos
 * que YA estaban guardados cuando el filtro no los atrapaba: arreglar la entrada no sirve de nada si
 * lo que entró mal se queda dentro para siempre.
 *
 * Ojo: aquí va SOLO la lista de rechazo, nunca la lista blanca. Los candidatos de nuestras fuentes
 * RSS son legítimos aunque su titular no contenga ninguna palabra clave.
 */
export function esTemaVetado(texto: string): boolean {
  return SKIP.some((re) => re.test(texto));
}

/**
 * Sección para una tendencia, o `null` si no es tema de losupe.
 *
 * OJO CON EL SENTIDO DE ESTA FUNCIÓN. Antes rechazaba una lista de temas y **todo lo demás pasaba**,
 * cayendo en «artistas» como cajón de sastre. Así se coló «CB Trevon Diggs signing 1-year deal with
 * Seahawks» (24 ago 2026): no decía «NFL» ni «football», así que ninguna regla de rechazo lo vio, y
 * el robot se puso a escribir sobre un fichaje de fútbol americano.
 *
 * Ahora es al revés y es la única forma correcta para un medio con secciones definidas: **si no
 * encaja en ninguna de las nuestras, no se publica**. Las tendencias de Google traen de todo; el
 * criterio no puede ser «lo que no supe rechazar».
 */
export function classifyTrend(text: string): SectionId | null {
  if (SKIP.some((re) => re.test(text))) return null;
  for (const [section, re] of SECTION_RULES) if (re.test(text)) return section;
  return null;
}

/** Mejor artículo de una tendencia: primero la fuente más confiable. */
export function bestTrendArticle(item: TrendItem): TrendItem["news"][number] | null {
  const sorted = [...item.news].sort((a, b) => trustLevel(b.url) - trustLevel(a.url));
  return sorted[0] ?? null;
}

export const TRENDS_FEEDS = {
  es: "https://trends.google.com/trending/rss?geo=US&hl=es-419",
  en: "https://trends.google.com/trending/rss?geo=US&hl=en-US",
} as const;
