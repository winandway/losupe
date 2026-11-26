import type { Lang } from "@/i18n/config";

export type SectionId =
  "economia" | "ventas" | "tecnologia" | "cripto" | "artistas" | "delivery" | "windoce";

export type Section = {
  id: SectionId;
  slug: Record<Lang, string>;
  name: Record<Lang, string>;
  description: Record<Lang, string>;
  /** Color de la sección (fondo de la etiqueta). */
  color: string;
  /** Color del texto sobre `color`. */
  onColor: string;
  /**
   * Tonos de la etiqueta pequeña cuando `color`/`onColor` no llegan al contraste mínimo (4,5:1) en
   * letra de 10 px. La marca no cambia: es el mismo color, un punto más hondo, o el texto en tinta.
   */
  badge?: { bg: string; fg: string };
  perDay: number;
  /**
   * Sección de la CASA («Desde Windoce»): notas sobre los productos del grupo dueño del medio.
   * No es noticia: no la escribe el robot de noticias, no entra al mapa de Google Noticias y cada
   * nota lleva su aviso de contenido de la casa (ver `src/lib/casa/`, candado 57).
   */
  house?: boolean;
};

export const SECTIONS: readonly Section[] = [
  {
    id: "economia",
    slug: { es: "economia", en: "economy" },
    name: { es: "Economía", en: "Economy" },
    description: {
      es: "Dinero, mercados, inflación, dólar, impuestos y decisiones financieras del día a día, explicados en claro.",
      en: "Money, markets, inflation, the dollar, taxes, and everyday financial decisions, explained clearly.",
    },
    color: "#2EE6A6",
    onColor: "#0B1F3A",
    perDay: 2,
  },
  {
    id: "ventas",
    slug: { es: "ventas", en: "sales" },
    name: { es: "Ventas y motivación", en: "Sales & Motivation" },
    description: {
      es: "Cómo vender más y mejor: técnicas, negociación, emprendimiento, hábitos y mentalidad.",
      en: "How to sell more and better: techniques, negotiation, entrepreneurship, habits, and mindset.",
    },
    color: "#FFD60A",
    onColor: "#0B1F3A",
    perDay: 1,
  },
  {
    id: "tecnologia",
    slug: { es: "tecnologia", en: "technology" },
    name: { es: "Tecnología e IA", en: "Tech & AI" },
    description: {
      es: "Lo último en inteligencia artificial y tecnología: ChatGPT, Claude, Gemini y las herramientas para crear, programar y trabajar.",
      en: "The latest in AI and tech: ChatGPT, Claude, Gemini, and the tools to create, code, and work.",
    },
    color: "#3B82F6",
    onColor: "#FFFFFF",
    badge: { bg: "#2563EB", fg: "#FFFFFF" },
    perDay: 3,
  },
  {
    id: "cripto",
    slug: { es: "cripto", en: "crypto" },
    name: { es: "Cripto", en: "Crypto" },
    description: {
      es: "Bitcoin, Ethereum, regulación, mercados y guías para entender las criptomonedas sin humo.",
      en: "Bitcoin, Ethereum, regulation, markets, and no-hype guides to understanding crypto.",
    },
    color: "#FB923C",
    onColor: "#0B1F3A",
    perDay: 1,
  },
  {
    id: "artistas",
    slug: { es: "artistas", en: "artists" },
    name: { es: "Artistas y tendencias", en: "Artists & Trends" },
    description: {
      es: "Música, cine, creadores y lo que está sonando en la cultura y las redes.",
      en: "Music, film, creators, and what's trending in culture and social media.",
    },
    color: "#FF5A5F",
    onColor: "#FFFFFF",
    badge: { bg: "#FF5A5F", fg: "#0B1F3A" },
    perDay: 3,
  },
  {
    /**
     * DELIVERY Y LOGÍSTICA (25 nov 2026). El segmento diario que pidió Richard: cómo funciona el
     * reparto de comida y de paquetes en el mundo — DoorDash, Uber Eats, Rappi, Instacart, los
     * bloques de Amazon Flex, los drones, la última milla — y cómo se vive en cada país.
     *
     * Es PERIODISMO DEL SECTOR, no el folleto de nadie. Divoox (producto de la casa) aparece aquí
     * solo cuando es noticia de verdad dentro del tema, y siempre con su línea de transparencia,
     * que pone el código (`src/lib/casa/aviso.ts`). Un segmento que solo hablara de nuestro producto
     * no lo guardaría Google, y con razón.
     */
    id: "delivery",
    slug: { es: "delivery", en: "delivery" },
    name: { es: "Delivery y logística", en: "Delivery & Logistics" },
    description: {
      es: "Cómo funciona el reparto de comida y de paquetes: las apps, lo que gana un repartidor, lo que paga un restaurante y la última milla, país por país.",
      en: "How food and package delivery really works: the apps, what a driver earns, what a restaurant pays, and the last mile, country by country.",
    },
    color: "#8B5CF6",
    onColor: "#FFFFFF",
    badge: { bg: "#6D28D9", fg: "#FFFFFF" },
    perDay: 3,
  },
  {
    id: "windoce",
    slug: { es: "desde-windoce", en: "from-windoce" },
    name: { es: "Desde Windoce", en: "From Windoce" },
    // Redactada de nuevo el 26 nov 2026. La anterior se presentaba como «contenido de la casa… de
    // la empresa dueña de Losupe»: era un cartel sobre nosotros, no una descripción de lo que hay.
    description: {
      es: "Lanzamientos, guías y novedades de los productos de Windoce.",
      en: "Launches, guides, and updates from Windoce's products.",
    },
    color: "#0B1F3A",
    onColor: "#FFFFFF",
    perDay: 0,
    house: true,
  },
];

/** La sección de contenido de la casa. */
export const HOUSE_SECTION_ID = "windoce" as const;

/** Solo las secciones de NOTICIAS: las que escribe el robot, aceptan encargos y van a Google Noticias. */
export const NEWS_SECTIONS: readonly Section[] = SECTIONS.filter((s) => !s.house);

export function isHouseSection(id: string): boolean {
  return id === HOUSE_SECTION_ID;
}

export const SECTION_IDS: readonly SectionId[] = SECTIONS.map((s) => s.id);

export function isSectionId(value: string): value is SectionId {
  return (SECTION_IDS as readonly string[]).includes(value);
}

export function getSection(id: string): Section | undefined {
  return SECTIONS.find((s) => s.id === id);
}

export function sectionBySlug(lang: Lang, slug: string): Section | undefined {
  return SECTIONS.find((s) => s.slug[lang] === slug);
}

export function sectionByAnySlug(slug: string): { section: Section; lang: Lang } | undefined {
  for (const section of SECTIONS) {
    if (section.slug.es === slug) return { section, lang: "es" };
    if (section.slug.en === slug) return { section, lang: "en" };
  }
  return undefined;
}

export function sectionSlug(id: SectionId, lang: Lang): string {
  const s = getSection(id);
  return s ? s.slug[lang] : id;
}
