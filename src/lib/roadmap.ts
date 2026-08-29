/**
 * EL ROADMAP DEL PROYECTO, EN CÓDIGO.
 *
 * Vive aquí y no en un documento suelto por un motivo: un roadmap en un archivo aparte se queda
 * viejo en dos semanas y nadie se entera. Esto se lee desde el panel, y cada vez que algo cambia se
 * cambia aquí, en el mismo trabajo en que se hizo.
 *
 * Tres estados y ya: **hecho**, **falta** (rojo: es lo que bloquea) y **espera** (falta un dato que
 * solo puede dar Richard). Nada de porcentajes ni de «en progreso», que no dicen nada.
 */

export type EstadoTarea = "hecho" | "falta" | "espera";

export type Tarea = {
  titulo: string;
  detalle: string;
  estado: EstadoTarea;
  /** Quién lo tiene que hacer. `nosotros` = trabajo de código; `richard` = un dato o una cuenta. */
  quien: "nosotros" | "richard";
};

export type BloqueRoadmap = {
  id: string;
  titulo: string;
  resumen: string;
  tareas: Tarea[];
};

export const ROADMAP: BloqueRoadmap[] = [
  {
    id: "cimientos",
    titulo: "1 · Cimientos y portal",
    resumen:
      "El diario en pie: portada, secciones, buscador, dos idiomas y publicación automática.",
    tareas: [
      {
        titulo: "Portal bilingüe con secciones y buscador",
        detalle:
          "Portada, cinco secciones, buscador con sugerencias que aguanta acentos y sinónimos, y todo en español e inglés.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Publicación automática en YaDominios Cloud",
        detalle: "Cada cambio publicado sube solo, con las pruebas en verde antes de salir.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Diseño de diario en celular",
        detalle: "Portada tipo periódico, menú, botonera de secciones y buscador a mano.",
        estado: "hecho",
        quien: "nosotros",
      },
    ],
  },
  {
    id: "robot",
    titulo: "2 · Robot redactor y encargos",
    resumen: "El diario escribe solo, con firmas que rotan y clientes con notas contratadas.",
    tareas: [
      {
        titulo: "Redactor con fuentes citadas y anticopia",
        detalle:
          "Lee las fuentes, escribe en dos idiomas, cita de dónde sale cada dato y rechaza el borrador si repite frases ajenas.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Horario de publicación: 7:00, 12:00 y 17:00",
        detalle:
          "Tres franjas en hora del Este, una nota por franja y una firma distinta en cada una. Elegidas con los picos de lectura de los medios.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Notas patrocinadas en cola, con ritmo",
        detalle:
          "Cada empresa con sus ideas de titular; máximo 2 por semana y una cada 3 días, para que no parezca publicidad.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "La escaleta del día: 2 de actualidad + 2 de curiosidades",
        detalle:
          "Cuatro franjas con su género asignado: actualidad a las 7 y a las 17, curiosidades al mediodía y rankings a las 21. Se acabó el reparto por porcentajes, que fallaba.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Un día entero publicando solo, sin que nadie toque nada",
        detalle:
          "Es la prueba que falta. Hoy salen notas, pero algún turno se pierde porque el reloj de GitHub se retrasa. Con el disparo cada hora debería quedar cerrado.",
        estado: "falta",
        quien: "nosotros",
      },
      {
        titulo: "Llaves opcionales: imágenes propias y buscador",
        detalle:
          "FAL_KEY genera ilustraciones propias en vez de tirar de banco de fotos. BRAVE_API_KEY da búsqueda web al redactor. Sin ellas el robot funciona, pero con menos margen.",
        estado: "espera",
        quien: "richard",
      },
    ],
  },
  {
    id: "google",
    titulo: "3 · Google y posicionamiento",
    resumen: "Que Google Noticias nos acepte y que las notas salgan bien colocadas.",
    tareas: [
      {
        titulo: "Mapas del sitio y datos estructurados",
        detalle:
          "Sitemap general y de noticias (48 h), NewsArticle en cada nota, IndexNow para avisar al instante de cada publicación.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Transparencia: contacto y quién edita el medio",
        detalle:
          "Página de contacto con formulario, correo visible y la empresa responsable. Es lo primero que mira un revisor de Google Noticias.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Autoría verificable de cada firma",
        detalle:
          "Cada persona con su perfil, su especialidad y sus redes publicadas donde Google las cruza.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Portada fresca: la actualidad no se mezcla con el archivo",
        detalle: "Lo reciente manda arriba; lo de más de un mes baja a «Del archivo».",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Perfiles reales de LinkedIn y X del equipo",
        detalle:
          "Sin ellos, la autoría queda a medias: Google no tiene con qué comprobar que detrás de la firma hay una persona. En cuanto lleguen los enlaces, se cargan y listo.",
        estado: "espera",
        quien: "richard",
      },
      {
        titulo: "Correo de contacto definitivo",
        detalle:
          "Ahora dice contacto@losupe.com. Si va a ser otro, se cambia en el panel en un minuto.",
        estado: "espera",
        quien: "richard",
      },
      {
        titulo: "Alta en Google Publisher Center",
        detalle:
          "El último paso y el que hace Richard: crear la publicación, verificar el dominio, cargar los feeds de cada sección y los logotipos. Te paso el croquis pantalla por pantalla cuando toque.",
        estado: "espera",
        quien: "richard",
      },
      {
        titulo: "Bing y otros buscadores",
        detalle: "Alta en Bing Webmaster Tools, que además alimenta a varios asistentes de IA.",
        estado: "espera",
        quien: "richard",
      },
      {
        titulo: "Imágenes indexables",
        detalle:
          "Las fotos van en el mapa del sitio (antes no había ninguna), los nombres de archivo respetan las tildes y cada imagen lleva su pie. Falta la llave para generarlas propias.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Velocidad de carga medida y ajustada",
        detalle:
          "Medir Core Web Vitals con datos reales y corregir lo que salga. Google lo usa para decidir posiciones.",
        estado: "falta",
        quien: "nosotros",
      },
    ],
  },
  {
    id: "lectores",
    titulo: "4 · Lectores que vuelven",
    resumen: "Que la gente deje su correo y regrese sola, sin depender de Google.",
    tareas: [
      {
        titulo: "Suscripción con confirmación por correo",
        detalle:
          "Formulario en la portada, doble confirmación y aviso de cada nota nueva con su enlace. Ya envía de verdad.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Avisos internos al publicar",
        detalle: "Cada nota publicada llega al correo del equipo, con el enlace y quién la firmó.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Boletín de resumen cada pocos días",
        detalle:
          "Hoy sale un aviso por nota. Falta el boletín de verdad: un resumen con las mejores de la semana, que es lo que la gente abre y reenvía.",
        estado: "falta",
        quien: "nosotros",
      },
      {
        titulo: "Contador de lectores y sección de tráfico",
        detalle:
          "Cuenta solo personas, nunca robots, sin cookies ni guardar direcciones IP. Con historial por periodos, de qué país llegan, qué leyeron, por dónde vinieron y cuánto tiempo estuvieron.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Formularios blindados contra robots",
        detalle:
          "Cuatro capas: pase firmado, tiempo mínimo de rellenado, límite por hora y Turnstile listo para encenderse. Ya frenó el spam que entraba por contacto.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Publicación automática en redes",
        detalle:
          "Que cada nota salga sola en las redes con su imagen y su enlace. Analizado y elegido; falta conectarlo.",
        estado: "falta",
        quien: "nosotros",
      },
      {
        titulo: "Cuentas de las redes y sus permisos",
        detalle:
          "Para publicar solo hacen falta las cuentas del medio y sus permisos de aplicación. Sin eso no se puede conectar nada.",
        estado: "espera",
        quien: "richard",
      },
    ],
  },
  {
    id: "dinero",
    titulo: "5 · Que empiece a facturar",
    resumen:
      "Diez ideas ordenadas de la más fácil a la más grande. La primera ya está cobrando desde el día cero.",
    tareas: [
      {
        titulo: "Comunicados autoservicio: «Publica tu noticia»",
        detalle:
          "Cualquier empresa pide su nota desde la web, llega al panel y entra en la cola. Funcionando.",
        estado: "hecho",
        quien: "nosotros",
      },
      {
        titulo: "Precios definitivos y «precio fundador»",
        detalle:
          "Los precios de hoy son de prueba. Hay que fijar los de verdad y montar los niveles. Es una decisión de negocio: la toma Richard y yo la implemento.",
        estado: "espera",
        quien: "richard",
      },
      {
        titulo: "Patrocinio de sección y de boletín",
        detalle: "Una marca patrocina una sección entera o el boletín, con su logo y su mención.",
        estado: "falta",
        quien: "nosotros",
      },
      {
        titulo: "Menciones dentro de las guías duraderas",
        detalle:
          "Las guías que siguen trayendo visitas un año después son el mejor sitio para una mención pagada.",
        estado: "falta",
        quien: "nosotros",
      },
      {
        titulo: "Widget de noticias para sitios ajenos",
        detalle:
          "Otros sitios muestran nuestras notas en una cajita. Nos trae visitas y marca. Idea de Richard.",
        estado: "falta",
        quien: "nosotros",
      },
      {
        titulo: "Las cinco apuestas grandes",
        detalle:
          "Boletín por WhatsApp, radar de tendencias como servicio para empresas, sala de prensa de marca blanca, acceso de pago para las IA, y videos cortos automáticos. Cada una es un producto.",
        estado: "falta",
        quien: "nosotros",
      },
    ],
  },
];

export type ResumenRoadmap = { hecho: number; falta: number; espera: number; total: number };

export function contarRoadmap(bloques: readonly BloqueRoadmap[] = ROADMAP): ResumenRoadmap {
  const r: ResumenRoadmap = { hecho: 0, falta: 0, espera: 0, total: 0 };
  for (const b of bloques) {
    for (const t of b.tareas) {
      r[t.estado] += 1;
      r.total += 1;
    }
  }
  return r;
}

/** Lo que hace falta de Richard, junto: es la lista que de verdad desbloquea el resto. */
export function pendientesDeRichard(bloques: readonly BloqueRoadmap[] = ROADMAP): Tarea[] {
  return bloques.flatMap((b) =>
    b.tareas.filter((t) => t.quien === "richard" && t.estado !== "hecho"),
  );
}
