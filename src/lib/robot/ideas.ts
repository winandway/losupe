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

/**
 * Los cuatro géneros de pieza propia.
 *
 * `ranking` es el que pidió Richard el 28 ago 2026, después de buscar en Google «cuál es el producto
 * más vendido del mundo» y encontrarse con que son el arroz y el trigo: *«ese tipo de curiosidades
 * son importantes… qué es lo que más se vende en Estados Unidos, qué consume la generación Z, cuál
 * es el país que bebe más licor»*.
 *
 * Y tenía razón en algo de fondo: el gancho está en **el tema**, no en el adjetivo. «El producto más
 * vendido del mundo» se lee solo; «la respuesta te sorprenderá» es lo que hace que no te lean nunca
 * más. Por eso los titulares de este género prometen un dato concreto, no una sorpresa.
 */
export type Genero = "curiosidades" | "errores" | "guia" | "ranking";

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
const TEMAS: Record<
  SectionId,
  { curiosidades: string[]; errores: string[]; guia: string[]; ranking: string[] }
> = {
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
    ranking: [
      "cuál es el producto más vendido del mundo",
      "los países donde la gente ahorra más dinero",
      "en qué se va de verdad el sueldo de una familia en Estados Unidos",
      "los países con el salario mínimo más alto del mundo",
      "cuánto cuesta vivir en las diez ciudades más caras del mundo",
      "cuál es la moneda más fuerte del mundo",
      "las diez empresas que más dinero ganan del planeta",
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
    ranking: [
      "qué es lo que más se vende en Estados Unidos",
      "qué compra de verdad la generación Z",
      "los diez productos más vendidos por internet",
      "qué es lo que más consumen los hogares mexicanos",
      "las marcas más valiosas del mundo y cuánto valen",
      "los países que más compran por internet",
      "qué día del año se vende más en el mundo",
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
    ranking: [
      "cuál es el celular más vendido de la historia",
      "las aplicaciones más descargadas del mundo",
      "los países con el internet más rápido",
      "cuánto tiempo pasa cada país frente a una pantalla",
      "los videojuegos más vendidos de todos los tiempos",
      "las páginas web más visitadas del planeta",
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
    ranking: [
      "los países donde más se usan las criptomonedas",
      "cuáles son las diez criptomonedas más grandes y qué hace cada una",
      "quiénes tienen más bitcoin del mundo",
      "los países que prohibieron las criptomonedas y por qué",
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
    ranking: [
      "cuál es la canción más escuchada de la historia",
      "cuál es el país que más licor bebe del mundo",
      "las películas más taquilleras de todos los tiempos",
      "los artistas que más entradas han vendido en una gira",
      "qué música escucha cada país",
      "los diez libros más vendidos de la historia",
      "qué país come más carne y cuál menos",
    ],
  },
};

const PLANTILLAS: Record<Genero, (tema: string) => string> = {
  curiosidades: (t) => `10 curiosidades sobre ${t} que casi nadie conoce`,
  errores: (t) => `Los 10 errores más grandes que cometen ${t}`,
  guia: (t) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`,
  // El titular es la propia pregunta, porque la pregunta ya engancha sola.
  ranking: (t) => `${t.charAt(0).toUpperCase()}${t.slice(1)}`,
};

const QUE_BUSCAR: Record<Genero, (tema: string) => string> = {
  curiosidades: (t) => `datos verificables, cifras y hechos históricos sobre ${t}`,
  errores: (t) => `errores frecuentes, estudios y casos documentados sobre ${t}`,
  guia: (t) => `explicación con fuentes y datos actualizados sobre ${t}`,
  ranking: (t) => `cifras oficiales, estadísticas y clasificaciones sobre ${t}`,
};

/** Todas las ideas posibles de una sección. */
export function ideasDeSeccion(sectionId: SectionId): Idea[] {
  const temas = TEMAS[sectionId];
  if (!temas) return [];
  const out: Idea[] = [];
  for (const genero of ["curiosidades", "errores", "guia", "ranking"] as const) {
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
  /** Si se pide, solo ideas de esta clase (la franja de la noche pide rankings). */
  soloGenero?: Genero | "curiosidades" | "ranking",
): Idea | null {
  const todas = ideasDeSeccion(sectionId);
  // «curiosidades» a secas incluye también las listas de errores y las guías: son piezas del mismo
  // tipo de lectura. El ranking sí va aparte, porque es otra cosa.
  const ideas = soloGenero
    ? todas.filter((i) =>
        soloGenero === "ranking" ? i.genero === "ranking" : i.genero !== "ranking",
      )
    : todas;
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
