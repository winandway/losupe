/**
 * Medios y organismos de confianza: cuando una noticia sale en treinta sitios, el robot se apoya en
 * estos y los nombra ("según The New York Times"). El nivel sube el puntaje del candidato.
 */

export const SOURCE_NAMES: Readonly<Record<string, string>> = {
  "nytimes.com": "The New York Times",
  "wsj.com": "The Wall Street Journal",
  "washingtonpost.com": "The Washington Post",
  "reuters.com": "Reuters",
  "apnews.com": "Associated Press",
  "bloomberg.com": "Bloomberg",
  "cnbc.com": "CNBC",
  "cnn.com": "CNN",
  "bbc.com": "BBC",
  "bbc.co.uk": "BBC",
  "theguardian.com": "The Guardian",
  "ft.com": "Financial Times",
  "economist.com": "The Economist",
  "forbes.com": "Forbes",
  "fortune.com": "Fortune",
  "axios.com": "Axios",
  "politico.com": "Politico",
  "npr.org": "NPR",
  "usatoday.com": "USA Today",
  "latimes.com": "Los Angeles Times",
  "nypost.com": "New York Post",
  "elpais.com": "El País",
  "elmundo.es": "El Mundo",
  "lavanguardia.com": "La Vanguardia",
  "infobae.com": "Infobae",
  "univision.com": "Univision",
  "telemundo.com": "Telemundo",
  "eluniversal.com.mx": "El Universal",
  "eltiempo.com": "El Tiempo",
  "clarin.com": "Clarín",
  "efe.com": "EFE",
  "bbc.com/mundo": "BBC Mundo",
  "techcrunch.com": "TechCrunch",
  "theverge.com": "The Verge",
  "wired.com": "Wired",
  "arstechnica.com": "Ars Technica",
  "blog.google": "Google",
  "openai.com": "OpenAI",
  "anthropic.com": "Anthropic",
  "coindesk.com": "CoinDesk",
  "cointelegraph.com": "Cointelegraph",
  "es.cointelegraph.com": "Cointelegraph en Español",
  "theblock.co": "The Block",
  "billboard.com": "Billboard",
  "variety.com": "Variety",
  "hollywoodreporter.com": "The Hollywood Reporter",
  "rollingstone.com": "Rolling Stone",
  "pitchfork.com": "Pitchfork",
  "entrepreneur.com": "Entrepreneur",
  "inc.com": "Inc.",
  "hbr.org": "Harvard Business Review",
  "federalreserve.gov": "Reserva Federal",
  "bls.gov": "Oficina de Estadísticas Laborales (BLS)",
  "sec.gov": "SEC",
  "irs.gov": "IRS",
  "whitehouse.gov": "Casa Blanca",
  "imf.org": "FMI",
  "worldbank.org": "Banco Mundial",
};

/** Nivel de confianza por dominio: 3 = primera línea, 2 = sólido, 1 = desconocido. */
export function trustLevel(url: string): 1 | 2 | 3 {
  let host: string;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return 1;
  }
  const top = [
    "nytimes.com",
    "wsj.com",
    "washingtonpost.com",
    "reuters.com",
    "apnews.com",
    "bloomberg.com",
    "cnbc.com",
    "bbc.com",
    "bbc.co.uk",
    "ft.com",
    "elpais.com",
    "federalreserve.gov",
    "bls.gov",
    "sec.gov",
    "irs.gov",
    "whitehouse.gov",
    "imf.org",
    "worldbank.org",
  ];
  if (top.some((d) => host === d || host.endsWith(`.${d}`))) return 3;
  if (Object.keys(SOURCE_NAMES).some((d) => host === d || host.endsWith(`.${d}`))) return 2;
  return 1;
}
