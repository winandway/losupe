import type { SectionId } from "@/lib/sections";

/**
 * EL BANCO DE IDEAS PROPIAS.
 *
 * Hasta ahora el robot solo escribía sobre lo que le traían las fuentes: si el RSS no lo mencionaba,
 * para nosotros no existía. Así se nos fueron los diez años sin Juan Gabriel y las lluvias de
 * Venezuela. Richard lo dijo claro el 24 ago 2026: *«hay tantas cosas para hacer… las curiosidades
 * como que a veces venden más»*.
 *
 * Esto es lo que un jefe de redacción tiene en la cabeza: una lista de piezas que **siempre**
 * funcionan, esperando a que haya un hueco en la agenda. No son noticias —no caducan—, y son lo que
 * la gente lee entero y reenvía: «10 curiosidades sobre…», «los 10 errores más grandes de…».
 *
 * OJO CON EL RIESGO DE ESTE GÉNERO: una lista de curiosidades es justo donde una IA se pone a
 * inventar datos que suenan bien. Por eso una idea de aquí **no es una nota**: es un encargo que
 * pasa por la misma investigación y las mismas fuentes citadas que todo lo demás (ver `mesa.ts`).
 */

export type Genero = "curiosidades" | "errores" | "guia";

export type Idea = {
  /** El titular que se le encarga al redactor. Él lo pulirá, pero el ángulo sale de aquí. */
  titular: string;
  sectionId: SectionId;
  genero: Genero;
  /** Qué buscar para documentarla. Sin esto, la nota se inventa. */
  busqueda: string;
};

/**
 * Los temas de cada sección. Se escriben aquí y no en la base para que se puedan leer de un vistazo
 * y ampliar en el mismo trabajo en que se piensan.
 */
const TEMAS: Record<SectionId, { curiosidades: string[]; errores: string[]; guia: string[] }> = {
  economia: {
    curiosidades: [
      "el dólar estadounidense",
      "la Reserva Federal",
      "la inflación",
      "los impuestos en Estados Unidos",
      "el salario mínimo",
      "las tarjetas de crédito",
      "el seguro social",
      "las hipotecas",
      "la bolsa de Nueva York",
      "el dinero en efectivo",
    ],
    errores: [
      "las personas al pedir un préstamo",
      "quien compra su primera casa",
      "quien invierte por primera vez",
      "las familias al hacer un presupuesto",
      "quien declara impuestos por su cuenta",
    ],
    guia: [
      "cómo leer un reporte de inflación",
      "qué mira un banco antes de darte un préstamo",
      "cómo funciona el crédito en Estados Unidos",
    ],
  },
  ventas: {
    curiosidades: [
      "las ventas por internet",
      "la publicidad",
      "las marcas más antiguas del mundo",
      "los mercados y ferias",
      "el Black Friday",
      "los vendedores más famosos de la historia",
      "los envases y las etiquetas",
      "las tiendas de barrio",
    ],
    errores: [
      "los vendedores por internet",
      "las tiendas físicas al abrir",
      "las empresas que fabrican productos",
      "las empresas de Estados Unidos al exportar",
      "las empresas chinas al vender fuera",
      "quien empieza un negocio desde casa",
      "las marcas en redes sociales",
    ],
    guia: [
      "cómo poner precio a un producto",
      "qué hacer cuando un cliente se queja en público",
      "cómo vender fuera de tu país sin morir en el intento",
    ],
  },
  tecnologia: {
    curiosidades: [
      "la inteligencia artificial",
      "los teléfonos celulares",
      "internet en sus primeros años",
      "las contraseñas",
      "los inventos más polémicos de la historia",
      "los robots",
      "los satélites",
      "los videojuegos",
    ],
    errores: [
      "las empresas al adoptar inteligencia artificial",
      "las personas con la seguridad de sus cuentas",
      "las empresas que fabrican hardware",
      "quien compra tecnología para su negocio",
    ],
    guia: [
      "cómo saber si una foto la hizo una inteligencia artificial",
      "qué hacer si te roban una cuenta",
      "cómo elegir tecnología para un negocio pequeño",
    ],
  },
  cripto: {
    curiosidades: [
      "bitcoin",
      "las estafas más grandes de las criptomonedas",
      "la minería de criptomonedas",
      "las billeteras digitales",
      "el creador de bitcoin",
    ],
    errores: [
      "quien empieza en criptomonedas",
      "quien guarda sus criptomonedas",
      "quien invierte siguiendo a influencers",
    ],
    guia: [
      "cómo reconocer una estafa de criptomonedas",
      "qué es y qué no es una stablecoin",
      "cómo se declara una ganancia en criptomonedas",
    ],
  },
  artistas: {
    curiosidades: [
      "Michael Jackson",
      "Juan Gabriel",
      "el cine",
      "los premios Grammy",
      "las giras musicales más grandes de la historia",
      "las telenovelas",
      "la música en español",
      "los videoclips",
      "el streaming de música",
    ],
    errores: [
      "los artistas al firmar su primer contrato",
      "los creadores de contenido al empezar",
      "los músicos independientes al publicar su música",
    ],
    guia: [
      "cómo se reparte el dinero de una canción en streaming",
      "qué hace un mánager de verdad",
      "cómo protege un artista sus derechos",
    ],
  },
};

const PLANTILLAS: Record<Genero, (tema: string) => string> = {
  curiosidades: (t) => `10 curiosidades sobre ${t} que casi nadie conoce`,
  errores: (t) => `Los 10 errores más grandes que cometen ${t}`,
  guia: (t) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`,
};

const QUE_BUSCAR: Record<Genero, (tema: string) => string> = {
  curiosidades: (t) => `datos verificables, cifras y hechos históricos sobre ${t}`,
  errores: (t) => `errores frecuentes, estudios y casos documentados sobre ${t}`,
  guia: (t) => `explicación con fuentes y datos actualizados sobre ${t}`,
};

/** Todas las ideas posibles de una sección. */
export function ideasDeSeccion(sectionId: SectionId): Idea[] {
  const temas = TEMAS[sectionId];
  if (!temas) return [];
  const out: Idea[] = [];
  for (const genero of ["curiosidades", "errores", "guia"] as const) {
    for (const tema of temas[genero]) {
      out.push({
        titular: PLANTILLAS[genero](tema),
        sectionId,
        genero,
        busqueda: QUE_BUSCAR[genero](tema),
      });
    }
  }
  return out;
}

/** El banco entero, por si hace falta recorrerlo. */
export function todasLasIdeas(): Idea[] {
  return (Object.keys(TEMAS) as SectionId[]).flatMap(ideasDeSeccion);
}

/**
 * La siguiente idea que toca, evitando las que ya se publicaron.
 *
 * `yaUsados` son los titulares que ya existen en el sitio. Se compara por el TEMA y no por el
 * titular exacto: el redactor pule el titular al escribir, así que comparar palabra por palabra
 * dejaría repetir el mismo tema una y otra vez con otras palabras.
 */
export function siguienteIdea(
  sectionId: SectionId,
  yaUsados: readonly string[],
  indice = 0,
): Idea | null {
  const ideas = ideasDeSeccion(sectionId);
  if (ideas.length === 0) return null;
  const usados = yaUsados.map((t) => normalizar(t));
  const libres = ideas.filter((idea) => {
    const tema = normalizar(temaDe(idea));
    return !usados.some((u) => u.includes(tema));
  });
  const lista = libres.length > 0 ? libres : ideas; // si se agotaron, se vuelve a empezar
  return lista[indice % lista.length] ?? null;
}

/** El tema desnudo de una idea, sin la plantilla («bitcoin», «los vendedores por internet»). */
export function temaDe(idea: Idea): string {
  if (idea.genero === "curiosidades") {
    return idea.titular
      .replace(/^10 curiosidades sobre /, "")
      .replace(/ que casi nadie conoce$/, "");
  }
  if (idea.genero === "errores") {
    return idea.titular.replace(/^Los 10 errores más grandes que cometen /, "");
  }
  return idea.titular;
}

export function normalizar(texto: string): string {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}
