export const es = {
  lang: "es" as const,
  locale: "es-US",
  ogLocale: "es_US",
  brand: {
    name: "losupe",
    domain: "losupe.com",
    tagline: "Lo que pasa, explicado.",
    description:
      "Noticias y guías de economía, ventas, tecnología e inteligencia artificial, cripto y tendencias, explicadas en claro cada mañana. En español e inglés.",
  },
  nav: {
    home: "Portada",
    sections: "Secciones",
    search: "Buscar",
    about: "Acerca de losupe",
    language: "Idioma",
    skip: "Saltar al contenido",
  },
  hero: {
    kicker: "Edición de hoy",
    title: "Lo que pasa, explicado.",
    subtitle:
      "Economía, ventas, tecnología e IA, cripto y tendencias. Notas claras cada mañana, en español e inglés.",
    searchPlaceholder: "¿Qué quieres saber hoy?",
    videoTitle: "Video de fondo: vista aérea de una ciudad",
  },
  home: {
    latest: "Lo último",
    topStory: "Lo más importante de hoy",
    moreFrom: "Más de",
    viewAll: "Ver toda la sección",
    empty: "Estamos preparando las primeras notas. Vuelve muy pronto.",
    welcomeTitle: "Lo que pasa, explicado.",
    welcomeBody:
      "Economía, ventas, tecnología e IA, cripto y tendencias. Notas claras y guías que sirven hoy y dentro de un año.",
  },
  article: {
    by: "Por",
    published: "Publicado",
    updated: "Actualizado",
    minutes: (m: number) => `${m} min de lectura`,
    sources: "Fuentes consultadas",
    aiNotice:
      "Redacción asistida por inteligencia artificial y revisada por el equipo editorial de losupe.",
    fallbackNotice: "Este artículo está disponible solo en español por ahora.",
    legacyNotice: "Publicado originalmente en MundosCrypto, el portal que dio origen a losupe.",
    related: "Te puede interesar",
    share: "Compartir",
    shareOn: (network: string) => `Compartir en ${network}`,
    tags: "Temas",
    backTo: "Volver a",
  },
  section: {
    count: (n: number) => (n === 1 ? "1 nota" : `${n} notas`),
    empty: "Todavía no hay notas en esta sección. El robot redactor empieza a publicar muy pronto.",
    page: (n: number) => `Página ${n}`,
  },
  search: {
    title: "Buscar en losupe",
    placeholder: "¿Qué quieres saber?",
    button: "Buscar",
    label: "Buscar",
    results: (n: number, q: string) =>
      n === 1 ? `1 resultado para “${q}”` : `${n} resultados para “${q}”`,
    none: (q: string) => `No encontramos nada con “${q}”. Prueba con otra palabra.`,
    hint: "Escribe al menos 2 letras.",
  },
  author: {
    articlesBy: "Notas de",
    newsroom: "Redacción",
  },
  about: {
    title: "Acerca de losupe",
    intro:
      "losupe es un medio digital en español e inglés que explica lo que pasa en economía, ventas y emprendimiento, tecnología e inteligencia artificial, criptomonedas y cultura. Publicamos cada mañana notas cortas y guías que sirven hoy y dentro de un año.",
    principlesTitle: "Cómo trabajamos",
    principles: [
      "Leemos varias fuentes antes de escribir y citamos de dónde sale cada dato.",
      "No copiamos: cada nota se escribe desde cero, en claro y sin relleno.",
      "Separamos la noticia de la opinión y corregimos en público cuando nos equivocamos.",
      "Priorizamos lo que dura: guías, explicaciones y consejos que siguen siendo útiles con el tiempo.",
    ],
    aiTitle: "Inteligencia artificial, con reglas",
    aiBody:
      "Parte de nuestra redacción se hace con ayuda de inteligencia artificial: un sistema propio lee las fuentes, propone borradores y los ilustra. El equipo editorial define los temas, revisa lo publicado y responde por ello. Cada nota asistida por IA lo indica al pie.",
    originTitle: "De dónde venimos",
    originBody:
      "losupe nace de MundosCrypto, un portal de noticias sobre criptomonedas. Conservamos su archivo y ampliamos la mirada a todo lo que mueve el dinero, el trabajo y la tecnología.",
  },
  footer: {
    sections: "Secciones",
    site: "Sitio",
    feeds: "RSS en español",
    rights: "All rights reserved.",
    developedBy: "Developed by",
  },
  notFound: {
    title: "No encontramos esa página",
    body: "Puede que el enlace esté mal escrito o que la nota ya no exista.",
    back: "Ir a la portada",
  },
  pagination: {
    prev: "Anteriores",
    next: "Siguientes",
    label: "Paginación",
  },
  languages: {
    es: "Español",
    en: "English",
  },
};

export type Dict = typeof es;
