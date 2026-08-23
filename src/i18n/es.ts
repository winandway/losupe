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
    seeAll: (q: string) => `Ver todos los resultados para “${q}”`,
    typing: "Escribe y te vamos sugiriendo notas.",
    seeAllTemplate: "Ver todos los resultados para “{q}”",
    noneTemplate: "No encontramos nada con “{q}”. Prueba con otra palabra.",
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
    editorial: "Política editorial",
    privacy: "Privacidad",
    terms: "Términos y condiciones",
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
  legal: {
    updated: "Última actualización: 23 de agosto de 2026",
    contact:
      "Las solicitudes de corrección, réplica o sobre datos personales se reciben por escrito en el correo de contacto de losupe (lo publicaremos en el pie de página en cuanto el buzón esté activo).",
    editorial: {
      title: "Política editorial",
      intro:
        "Esta es la forma en que losupe decide qué publica, cómo lo escribe y cómo responde cuando se equivoca. La escribimos para que cualquier lector, anunciante o buscador sepa a qué atenerse.",
      sections: [
        {
          h: "Qué publicamos",
          p: [
            "Notas breves de actualidad y guías que siguen siendo útiles con el tiempo, en cinco secciones: economía, ventas y motivación, tecnología e inteligencia artificial, criptomonedas y artistas y tendencias. Todo se publica en español e inglés.",
          ],
        },
        {
          h: "Cómo trabajamos",
          p: [
            "Leemos varias fuentes antes de escribir y citamos de dónde sale cada dato. No copiamos: cada nota se redacta desde cero, en claro y sin relleno. Las cifras que vienen de una empresa o de una persona se atribuyen como tales. Separamos la información de la opinión.",
          ],
        },
        {
          h: "Inteligencia artificial, con reglas",
          p: [
            "Parte de la redacción se hace con ayuda de un sistema propio de inteligencia artificial que lee fuentes, propone borradores y los ilustra. El equipo editorial define los temas, revisa lo publicado y responde por ello. Cada nota asistida por IA lo indica al pie. Ninguna cifra sin fuente, ninguna cita inventada.",
          ],
        },
        {
          h: "Autores y firmas",
          p: [
            "Las notas llevan la firma de una persona real con página propia, que responde por lo publicado. Las piezas colectivas se firman como Equipo editorial de losupe.",
          ],
        },
        {
          h: "Correcciones",
          p: [
            "Cuando nos equivocamos, corregimos rápido y en público: la nota se actualiza y al pie queda la fecha de la modificación. Si el error cambia el sentido de la historia, lo explicamos.",
          ],
        },
        {
          h: "Independencia y patrocinio",
          p: [
            "No publicamos publicidad disfrazada de noticia. Si algún día publicamos contenido patrocinado o enlaces de afiliados, estará marcado de forma clara y visible.",
          ],
        },
        {
          h: "Imágenes y derechos",
          p: [
            "Usamos imágenes propias, generadas con inteligencia artificial (marcadas como tales) o de bancos libres con su crédito, y capturas de los sitios que citamos, con la fuente indicada.",
          ],
        },
        {
          h: "Uso de nuestro contenido por sistemas de IA",
          p: [
            "Declaramos nuestras preferencias con Content Signals en robots.txt: permitimos que los buscadores y asistentes nos indexen, lean y citen con enlace (search=yes, ai-input=yes) y no autorizamos usar nuestro contenido para entrenar modelos (ai-train=no).",
          ],
        },
      ],
    },
    privacy: {
      title: "Política de privacidad",
      intro:
        "Explicamos qué datos se procesan cuando visitas losupe.com, para qué y qué puedes hacer al respecto. En pocas palabras: no te pedimos registro, no usamos cookies de seguimiento propias y no vendemos datos.",
      sections: [
        {
          h: "Qué datos se procesan",
          p: [
            "Hoy no pedimos cuenta ni registro. El buscador del sitio no guarda tus consultas asociadas a tu persona. La plataforma que aloja el sitio (YaDominios Cloud, sobre la red de Cloudflare) procesa datos técnicos como la dirección IP, el tipo de navegador y el país para seguridad, rendimiento y estadísticas agregadas de visitas (sin cookies ni perfiles individuales).",
          ],
        },
        {
          h: "Boletín por correo",
          p: [
            "Cuando exista el boletín, solo enviaremos correos a quien se suscriba y confirme su dirección. Cada correo llevará un enlace para darse de baja con un clic. No vendemos ni compartimos la lista.",
          ],
        },
        {
          h: "Enlaces a otros sitios",
          p: [
            "Las notas enlazan a fuentes externas. No respondemos por las políticas de privacidad de esos sitios.",
          ],
        },
        {
          h: "Tus derechos",
          p: [
            "Puedes pedir acceso, corrección o eliminación de los datos que tengamos sobre ti. Atendemos las solicitudes por escrito.",
          ],
        },
        {
          h: "Menores",
          p: [
            "losupe no está dirigido a menores de 13 años ni recopila a sabiendas datos de menores.",
          ],
        },
        {
          h: "Cambios",
          p: ["Si esta política cambia, actualizaremos la fecha que aparece arriba."],
        },
      ],
    },
    terms: {
      title: "Términos y condiciones",
      intro: "Al usar losupe.com aceptas estas condiciones. Son cortas a propósito.",
      sections: [
        {
          h: "Contenido informativo",
          p: [
            "Lo que publicamos es información periodística y de divulgación. No es asesoría financiera, legal, médica ni de inversión. Verifica con un profesional antes de tomar decisiones.",
          ],
        },
        {
          h: "Qué puedes hacer con el contenido",
          p: [
            "Leerlo, compartirlo con enlace y citar fragmentos breves con atribución a losupe. No está permitido reproducir notas completas, rasparlas de forma masiva ni usarlas para entrenar modelos de inteligencia artificial sin permiso por escrito.",
          ],
        },
        {
          h: "Propiedad intelectual",
          p: [
            "Los textos, la marca y el diseño de losupe son propiedad de losupe. Las imágenes de terceros aparecen con su crédito y pertenecen a sus autores.",
          ],
        },
        {
          h: "Exactitud y responsabilidad",
          p: [
            "Trabajamos para que todo sea correcto y corregimos cuando no lo es, pero el contenido se ofrece sin garantías. No respondemos por decisiones tomadas con base en lo publicado.",
          ],
        },
        {
          h: "Enlaces de terceros",
          p: ["Los sitios enlazados son responsabilidad de sus dueños."],
        },
        {
          h: "Cambios y ley aplicable",
          p: [
            "Podemos actualizar estas condiciones; la fecha de arriba indica la versión vigente. Se rigen por las leyes de Estados Unidos.",
          ],
        },
      ],
    },
  },
  languages: {
    es: "Español",
    en: "English",
  },
};

export type Dict = typeof es;
