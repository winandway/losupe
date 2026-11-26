/**
 * QUIÉN ES QUIÉN EN EL REPARTO — el directorio del sector (25 nov 2026).
 *
 * Antes, al pie de la sección de delivery había UNA ficha: la de Divoox, bajo el título «Nuestra
 * propia app de reparto». Richard lo vio y tenía razón: una pieza fija que solo habla de nuestro
 * producto, en la sección entera, le dice a Google que la sección existe para promocionarlo. Es lo
 * que sus políticas de spam llaman contenido hecho para el buscador y no para el lector, y nos
 * delata solos. Las reglas que salieron de ahí están en `docs/SEO-IMPARCIALIDAD.md`.
 *
 * Ahora es un directorio del sector, con las mismas cuatro casillas para todas: qué es, dónde está,
 * qué paga el restaurante y cómo cobra quien reparte. La nuestra es una fila más, **la última**,
 * porque el orden es de la más grande a la más nueva y esa es la verdad.
 *
 * REGLAS DE ESTE ARCHIVO:
 *  1. Cada línea sale de una fuente que se puede comprobar, y la fuente se nombra en la ficha.
 *     Cuando una empresa NO publica un dato, se dice que no lo publica: eso también informa.
 *  2. Las mismas casillas para todas. Nada de contar de la nuestra lo que no se cuenta de las demás.
 *  3. El orden lo decide un criterio neutro y declarado (tamaño), nunca de quién es la empresa.
 *  4. Los enlaces salen sin pasar autoridad: `nofollow` a las demás y `sponsored` a la nuestra.
 */

export type EmpresaDelSector = {
  id: string;
  nombre: string;
  url: string;
  /** La nuestra. Cambia el `rel` del enlace y añade la línea de transparencia en SU ficha. */
  nuestra?: boolean;
  queEs: { es: string; en: string };
  donde: { es: string; en: string };
  /** Qué paga el comercio. */
  restaurante: { es: string; en: string };
  /** Cómo cobra quien reparte. */
  repartidor: { es: string; en: string };
  /** De dónde salen los datos de arriba. Se enseña en la ficha. */
  fuente: { es: string; en: string };
  verificado: string;
};

/**
 * Ordenadas de la más grande a la más nueva. El criterio va escrito en la página, para que nadie
 * tenga que preguntarse por qué una está antes que otra.
 */
export const DIRECTORIO: readonly EmpresaDelSector[] = [
  {
    id: "ubereats",
    nombre: "Uber Eats",
    url: "https://www.ubereats.com",
    queEs: {
      es: "Reparto de comida y de tiendas dentro del ecosistema de Uber, con la misma cuenta que los viajes.",
      en: "Food and store delivery inside Uber's ecosystem, using the same account as the rides.",
    },
    donde: {
      es: "Decenas de países. Las tarifas cambian de uno a otro: su página de Reino Unido publica 13 % y la de Chile, 16,5 %.",
      en: "Dozens of countries. Rates change from one to another: its UK page lists 13% and its Chilean page 16.5%.",
    },
    restaurante: {
      es: "Sus términos para comercios de Estados Unidos, con fecha de junio de 2026, fijan 15 % cuando el restaurante reparte con su propia gente. Para los planes en los que reparte Uber, la prensa del sector sitúa las tarifas entre el 20 % y el 30 % según el nivel.",
      en: "Its U.S. merchant terms, dated June 2026, set 15% when the restaurant delivers with its own staff. For the plans where Uber delivers, trade press puts the rates between 20% and 30% depending on the tier.",
    },
    repartidor: {
      es: "Cobra por viaje. No publica una tarifa por hora.",
      en: "Paid per trip. It doesn't publish an hourly rate.",
    },
    fuente: {
      es: "Términos para comercios de Uber Eats (EE. UU.) y prensa del sector",
      en: "Uber Eats merchant terms (U.S.) and trade press",
    },
    verificado: "2026-11-25",
  },
  {
    id: "doordash",
    nombre: "DoorDash",
    url: "https://www.doordash.com",
    queEs: {
      es: "La app de reparto de comida más grande de Estados Unidos, que también reparte de supermercados y tiendas.",
      en: "The largest food delivery app in the United States, which also delivers from supermarkets and stores.",
    },
    donde: {
      es: "Estados Unidos, Canadá, Australia y otros mercados.",
      en: "The United States, Canada, Australia, and other markets.",
    },
    restaurante: {
      es: "Tres planes que su propia página publica: 15 % el básico, 25 % el intermedio y 30 % el completo, sobre los pedidos que reparte su gente. Cobra 6 % cuando el cliente recoge. Sin cuota mensual y sin contrato de permanencia.",
      en: "Three plans published on its own page: 15% basic, 25% mid-tier, and 30% full, on orders its couriers deliver. It charges 6% when the customer picks up. No monthly fee and no lock-in contract.",
    },
    repartidor: {
      es: "Cobra por pedido. No publica una tarifa por hora.",
      en: "Paid per order. It doesn't publish an hourly rate.",
    },
    fuente: {
      es: "Página de precios para comercios de DoorDash",
      en: "DoorDash merchant pricing page",
    },
    verificado: "2026-11-25",
  },
  {
    id: "instacart",
    nombre: "Instacart",
    url: "https://www.instacart.com",
    queEs: {
      es: "Compra y reparto de supermercado: una persona hace la compra en la tienda y la lleva a la casa.",
      en: "Grocery shopping and delivery: a person does the shopping in the store and brings it home.",
    },
    donde: { es: "Estados Unidos y Canadá.", en: "The United States and Canada." },
    restaurante: {
      es: "No es de restaurantes: trabaja con cadenas de supermercados y no publica lo que les cobra.",
      en: "It isn't a restaurant platform: it works with supermarket chains and doesn't publish what it charges them.",
    },
    repartidor: {
      es: "Cobra por tanda de compra, más promociones y propinas. Su propia página dice que el pago que se ve al aceptar no baja si la tanda se completa como se aceptó, y que las propinas son del comprador al cien por cien.",
      en: "Paid per shopping batch, plus promotions and tips. Its own page says the pay shown when accepting never goes down if the batch is completed as accepted, and that tips are 100% the shopper's.",
    },
    fuente: {
      es: "Páginas de ganancias para compradores de Instacart (EE. UU. y Canadá)",
      en: "Instacart shopper earnings pages (U.S. and Canada)",
    },
    verificado: "2026-11-25",
  },
  {
    id: "rappi",
    nombre: "Rappi",
    url: "https://www.rappi.com",
    queEs: {
      es: "La app de reparto más extendida de América Latina: comida, mercado, farmacia y mandados.",
      en: "The most widespread delivery app in Latin America: food, groceries, pharmacy, and errands.",
    },
    donde: {
      es: "Nueve países de América Latina y más de 350 ciudades, según la cifra que da la prensa de la región.",
      en: "Nine Latin American countries and more than 350 cities, according to the figure regional press reports.",
    },
    restaurante: {
      es: "No publica una comisión fija. Un directivo de Rappi Colombia explicó que varía según los puntos de venta, la cobertura y el tamaño de la marca, y que el porcentaje exacto se le dice al restaurante cuando se registra.",
      en: "It doesn't publish a fixed commission. A Rappi Colombia executive explained that it varies with the number of locations, the coverage, and the size of the brand, and that the exact percentage is given to the restaurant when it signs up.",
    },
    repartidor: {
      es: "Cobra por pedido. No publica sus tarifas.",
      en: "Paid per order. It doesn't publish its rates.",
    },
    fuente: {
      es: "Declaraciones de Rappi Colombia en prensa económica y guías locales para restaurantes",
      en: "Statements from Rappi Colombia in business press and local guides for restaurants",
    },
    verificado: "2026-11-25",
  },
  {
    id: "spark",
    nombre: "Spark Driver",
    url: "https://drive4spark.walmart.com",
    queEs: {
      es: "El reparto de Walmart hecho por gente con su propio carro: pedidos de la tienda llevados a la casa.",
      en: "Walmart's delivery done by people in their own cars: store orders taken to the door.",
    },
    donde: { es: "Estados Unidos.", en: "The United States." },
    restaurante: {
      es: "No es un mercado para restaurantes: reparte los pedidos de las tiendas de Walmart.",
      en: "It isn't a restaurant marketplace: it delivers Walmart's own store orders.",
    },
    repartidor: {
      es: "Cobra por oferta, y la oferta enseña la ganancia estimada antes de aceptarla. Hay ofertas de un solo pedido y ofertas en tanda, con dos o más pedidos de la misma tienda en un viaje. Su página dice que el repartidor se queda con el cien por cien de las propinas confirmadas. No publica una tarifa por hora.",
      en: "Paid per offer, and the offer shows the estimated earnings before accepting it. There are single offers and batched offers, with two or more orders from the same store in one trip. Its page says the driver keeps 100% of confirmed tips. It doesn't publish an hourly rate.",
    },
    fuente: {
      es: "Centro de ayuda y preguntas frecuentes de Spark Driver",
      en: "Spark Driver help center and FAQ",
    },
    verificado: "2026-11-25",
  },
  {
    id: "divoox",
    nombre: "Divoox",
    url: "https://divoox.com",
    nuestra: true,
    queEs: {
      es: "Reparto de comida, de tiendas y de paquetes, con tres aplicaciones: una para pedir, una para repartir y una para el restaurante.",
      en: "Food, store, and package delivery, with three apps: one to order, one to deliver, and one for the restaurant.",
    },
    donde: {
      es: "Abre ciudad por ciudad, y cada ciudad arranca con una franquicia local que paga las motos, el entrenamiento de los repartidores y una tableta para cada restaurante.",
      en: "It opens city by city, and every city launches with a local franchise that pays for the motorbikes, driver training, and a tablet for each restaurant.",
    },
    restaurante: {
      es: "Tres planes que publica en su página: 7,5 %, 12,5 % y 15 % según el nivel, sin contratos de permanencia.",
      en: "Three plans published on its page: 7.5%, 12.5%, and 15% depending on the tier, with no lock-in contracts.",
    },
    repartidor: {
      es: "Cobra por pedido, ve el pago y la distancia antes de aceptar, se queda con el cien por cien de la propina, y rechazar un pedido no le cuenta en contra. No publica una tarifa por hora.",
      en: "Paid per order, sees the pay and the distance before accepting, keeps 100% of the tip, and declining an order never counts against them. It doesn't publish an hourly rate.",
    },
    fuente: { es: "Páginas de Divoox", en: "Divoox's own pages" },
    verificado: "2026-11-25",
  },
];

/** La nuestra, para la línea de transparencia. Si algún día hay más de una, salen todas. */
export const NUESTRAS = DIRECTORIO.filter((e) => e.nuestra);
