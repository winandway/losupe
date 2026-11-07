/**
 * FICHAS DE LOS PRODUCTOS DE WINDOCE LLC para la sección «Desde Windoce» (contenido de la casa).
 *
 * Todo lo que dice cada ficha se LEYÓ EN VIVO en la página del producto el día que marca
 * `verificado`. Nada inventado: ni usuarios, ni premios, ni prensa. Lo que una página promete pero
 * no se pudo comprobar (por ejemplo «miles de usuarios») NO entra. Si un producto cambia, se vuelve
 * a leer su página y se actualiza la ficha con la fecha nueva.
 *
 * El orden de `PRODUCTOS` es el de la rotación diaria (un producto por día). Un producto nuevo en
 * windoce.com se agrega al final y entra solo a la rotación.
 */

export type ProductoId =
  | "divoox"
  | "pantalay"
  | "beellon"
  | "kipuu"
  | "yapanel"
  | "qrbott"
  | "mercatren"
  | "yadominios"
  | "aliramoney"
  | "tokiia";

export type Producto = {
  id: ProductoId;
  nombre: string;
  url: string;
  /** Foto de la nota: la imagen oficial del producto, copiada al sitio (no se enlaza a terceros). */
  imagen: string;
  /** Qué es, en una frase. */
  queEs: { es: string; en: string };
  /** A quién le sirve. */
  paraQuien: { es: string; en: string };
  /** Datos verdaderos leídos en su página (con la fecha de `verificado`). */
  datos: { es: readonly string[]; en: readonly string[] };
  /** Lo que el redactor NO puede decir de este producto (promesas sin comprobar, temas delicados). */
  cuidado?: string;
  /**
   * Cómo se cuenta la relación con Losupe en el aviso. Por defecto «Losupe y X son de Windoce LLC».
   * Mercatren la opera otra sociedad (Mercatren LLC) y la desarrolla Windoce: se dice así.
   */
  relacion?: { es: string; en: string };
  verificado: string;
};

export const PRODUCTOS: readonly Producto[] = [
  {
    id: "divoox",
    nombre: "Divoox",
    url: "https://divoox.com",
    imagen: "/img/casa/divoox.jpg",
    queEs: {
      es: "Una plataforma de delivery de comida, tiendas y paquetes, con app para clientes, para repartidores y para restaurantes.",
      en: "A delivery platform for food, stores, and packages, with apps for customers, drivers, and restaurants.",
    },
    paraQuien: {
      es: "Restaurantes que pagan comisiones altas, repartidores que quieren saber cuánto ganan antes de aceptar y clientes que quieren ver el desglose completo antes de pagar.",
      en: "Restaurants tired of high commissions, drivers who want to see their pay before accepting, and customers who want the full breakdown before paying.",
    },
    datos: {
      es: [
        "Su página anuncia «Próximamente en Miami» y dice que abre ciudad por ciudad.",
        "Comisiones para restaurantes de 7,5 %, 12,5 % y 15 % según el plan, sin contratos de permanencia.",
        "El repartidor se queda con el 100 % de la propina y ve el pago, la distancia y el punto de recogida antes de aceptar.",
        "Ya se puede pedir desde el navegador; las apps de iPhone y Android están anunciadas como «muy pronto».",
        "Las tiendas (mercados, farmacias, ferreterías) pueden subir su catálogo con una hoja de cálculo o por código de barras.",
      ],
      en: [
        "Its site says “Coming soon to Miami” and that it opens city by city.",
        "Restaurant commissions of 7.5%, 12.5%, and 15% depending on the plan, with no lock-in contracts.",
        "Drivers keep 100% of the tip and see pay, distance, and pickup spot before accepting.",
        "Customers can already order from a web browser; the iPhone and Android apps are listed as “coming very soon.”",
        "Stores (grocery, pharmacy, hardware) can upload their catalog with a spreadsheet or by barcode.",
      ],
    },
    cuidado:
      "No decir que ya opera en Miami ni en ninguna ciudad: la página dice «próximamente». No mencionar inversionistas, cifras de pedidos ni de restaurantes.",
    verificado: "2026-11-07",
  },
  {
    id: "pantalay",
    nombre: "Pantalay",
    url: "https://pantalay.com",
    imagen: "/img/casa/pantalay.jpg",
    queEs: {
      es: "Un grabador de pantalla y cámara gratis que funciona en el navegador, sin instalar nada, y entrega el enlace para compartir apenas terminas de grabar.",
      en: "A free screen and camera recorder that runs in the browser, with nothing to install, and hands you a share link the moment you stop recording.",
    },
    paraQuien: {
      es: "Profesores, creadores de tutoriales, equipos de soporte y cualquiera que tenga que explicar algo en la pantalla.",
      en: "Teachers, tutorial creators, support teams, and anyone who has to explain something on screen.",
    },
    datos: {
      es: [
        "Graba la pantalla, la cámara o las dos, hasta 4K.",
        "El video se sube mientras grabas: al parar, el enlace ya está copiado.",
        "Transcripción y subtítulos en vivo, en inglés y español.",
        "Se edita sin volver a grabar: recortar, cortar por la transcripción, quitar silencios, agregar texto y flechas.",
        "Quien mira puede comentar en el segundo exacto; quien graba ve vistas y cuánto se vio cada video.",
        "Se descarga en MP4. La cuenta gratis permite empezar; los planes de pago suman videos ilimitados, 4K, dibujo y funciones de IA.",
        "Según su página, no vende datos personales ni muestra anuncios.",
      ],
      en: [
        "Records your screen, your camera, or both, up to 4K.",
        "The video uploads while you record: when you stop, the link is already copied.",
        "Live transcript and captions in English and Spanish.",
        "Edit without re-recording: trim, cut by transcript, remove silences, add text and arrows.",
        "Viewers comment at the exact second; creators see views and how much of each video was watched.",
        "Downloads as MP4. The free account gets you started; paid plans add unlimited videos, 4K, drawing tools, and AI features.",
        "Its site says it doesn't sell personal data or show ads.",
      ],
    },
    verificado: "2026-11-07",
  },
  {
    id: "beellon",
    nombre: "Beellon",
    url: "https://beellon.com",
    imagen: "/img/casa/beellon.jpg",
    queEs: {
      es: "Un estudio creativo con inteligencia artificial: videos con sonido, anuncios de producto, imágenes, flyers con texto bien escrito, música y chat, en un solo lugar.",
      en: "An AI creative studio: videos with sound, product ads, images, flyers with clean text, music, and chat, all in one place.",
    },
    paraQuien: {
      es: "Negocios pequeños y creadores que necesitan anuncios y contenido para redes sin contratar un estudio.",
      en: "Small businesses and creators who need ads and social content without hiring a studio.",
    },
    datos: {
      es: [
        "«Anuncio en un clic»: de la foto de un producto a un comercial con voz y música, con 18 estilos.",
        "«Cambiar personaje»: te grabas con el celular y el video te convierte en otro personaje, con tus mismos gestos.",
        "Flyers con el precio y el texto bien escritos, con el logo del negocio.",
        "Se paga por créditos, lo que se crea. Tiene plan gratis y planes de 19, 59 y 129 dólares al mes.",
        "Cada herramienta tiene su guía paso a paso con capturas.",
      ],
      en: [
        "“One-click ad”: from a product photo to a commercial with voice and music, in 18 styles.",
        "“Change character”: record yourself on your phone and the video turns you into another character with your same gestures.",
        "Flyers with prices and text spelled correctly, with the business logo.",
        "You pay with credits for what you create. There's a free plan and plans at $19, $59, and $129 a month.",
        "Every tool has a step-by-step guide with screenshots.",
      ],
    },
    verificado: "2026-11-07",
  },
  {
    id: "kipuu",
    nombre: "Kipuu",
    url: "https://kipuu.com",
    imagen: "/img/casa/kipuu.jpg",
    queEs: {
      es: "Almacenamiento de archivos en la nube para empresas: subir, compartir y abrir archivos desde la web, el celular o una carpeta en la computadora.",
      en: "Cloud file storage for companies: upload, share, and open files from the web, your phone, or a folder on your computer.",
    },
    paraQuien: {
      es: "Empresas y equipos que comparten archivos, y creadores que guardan videos y fotos pesadas.",
      en: "Companies and teams that share files, and creators who store large videos and photos.",
    },
    datos: {
      es: [
        "Prueba gratis de 14 días con 10 GB, sin tarjeta.",
        "Planes mensuales desde 4,99 dólares para toda la empresa; cada persona extra cuesta 2 dólares al mes.",
        "Funciona en la web, en Android (iPhone anunciado como próximamente) y como carpeta en Windows y Mac.",
        "Archivos en centros de datos de Estados Unidos, cifrados, con enlaces privados que vencen y registro de actividad.",
        "Respaldo automático de la cámara del celular.",
      ],
      en: [
        "14-day free trial with 10 GB, no credit card.",
        "Monthly plans from $4.99 for the whole company; each extra person is $2 a month.",
        "Works on the web, on Android (iPhone listed as coming soon), and as a folder on Windows and Mac.",
        "Files stored in U.S. data centers, encrypted, with private links that expire and an activity log.",
        "Automatic phone camera backup.",
      ],
    },
    cuidado: "No comparar con marcas competidoras por su nombre.",
    verificado: "2026-11-07",
  },
  {
    id: "yapanel",
    nombre: "YaPanel",
    url: "https://yapanel.com",
    imagen: "/img/casa/yapanel.jpg",
    queEs: {
      es: "Un panel para vender dominios y hosting que corre completo en la nube, sin servidor propio ni cPanel.",
      en: "A panel for selling domains and hosting that runs entirely in the cloud, with no server of your own and no cPanel.",
    },
    paraQuien: {
      es: "Agencias, diseñadores web y revendedores que quieren vender dominios y hosting con su propia marca.",
      en: "Agencies, web designers, and resellers who want to sell domains and hosting under their own brand.",
    },
    datos: {
      es: [
        "Registra dominios a nombre del cliente, cobra, renueva y da hosting que se publica desde GitHub.",
        "Cobro con tarjeta, con saldo y en efectivo con PIN de activación de un solo uso.",
        "Marca blanca: el logo, los colores y el dominio del revendedor; los correos salen con su marca.",
        "Licencias desde 10 dólares al mes (Inicial) y 25 dólares (Ilimitada), según su página.",
        "Tiene un demo en vivo que se puede probar sin comprar.",
      ],
      en: [
        "Registers domains in the client's name, bills, renews, and provides hosting published from GitHub.",
        "Takes card payments, account balance, and cash through single-use activation PINs.",
        "White label: the reseller's logo, colors, and domain; emails go out under their brand.",
        "Licenses from $10 a month (Starter) and $25 (Unlimited), according to its site.",
        "There's a live demo you can try without buying.",
      ],
    },
    cuidado: "No dar cifras de clientes ni de ingresos: las del demo son de ejemplo.",
    verificado: "2026-11-07",
  },
  {
    id: "qrbott",
    nombre: "QRbott",
    url: "https://qrbott.com",
    imagen: "/img/casa/qrbott.jpg",
    queEs: {
      es: "Una tienda en línea con un asistente de inteligencia artificial que vende por chat, junto con un punto de venta para el mostrador.",
      en: "An online store with an AI assistant that sells over chat, plus a point of sale for the counter.",
    },
    paraQuien: {
      es: "Tiendas, bodegas, supermercados y negocios que venden en el local y por WhatsApp.",
      en: "Shops, corner stores, supermarkets, and businesses that sell in person and over WhatsApp.",
    },
    datos: {
      es: [
        "Un asistente de IA atiende y vende por chat las 24 horas, con el catálogo del negocio.",
        "Punto de venta en el celular Android que sigue vendiendo si se cae el internet e imprime recibos por Bluetooth.",
        "Calcula la utilidad del día: ventas menos costo de la mercancía menos gastos.",
        "Se le toma una foto a la factura del proveedor y la IA llena la compra en el inventario.",
        "Cobros con tarjeta, USDT y bolívares, y dominio propio para la tienda.",
      ],
      en: [
        "An AI assistant answers and sells over chat 24/7, using the store's own catalog.",
        "An Android point of sale that keeps selling when the internet drops and prints receipts over Bluetooth.",
        "Works out the day's profit: sales minus cost of goods minus expenses.",
        "Snap a photo of a supplier's invoice and the AI fills in the purchase and the inventory.",
        "Takes card, USDT, and bolívar payments, and gives the store its own domain.",
      ],
    },
    cuidado: "Se escribe QRbott. No es la app para leer códigos QR.",
    verificado: "2026-11-07",
  },
  {
    id: "mercatren",
    nombre: "Mercatren",
    url: "https://mercatren.com",
    imagen: "/img/casa/mercatren.jpg",
    queEs: {
      es: "Un mercado en línea para comprar en Estados Unidos y recibir donde estés, con una tienda por país.",
      en: "An online marketplace to shop in the United States and get it wherever you are, with a storefront per country.",
    },
    paraQuien: {
      es: "Personas en América Latina que compran productos de Estados Unidos y comercios que quieren vender con precio final publicado.",
      en: "People in Latin America who buy U.S. products, and merchants who want to sell with a final published price.",
    },
    datos: {
      es: [
        "Tiendas propias por país: Estados Unidos, Venezuela, Chile, Colombia y España.",
        "El precio que se ve es el precio final, con el envío incluido.",
        "Cada comercio tiene su vitrina con catálogo propio.",
        "La opera Mercatren LLC, en Michigan; la desarrolla Windoce LLC.",
      ],
      en: [
        "Separate storefronts per country: the United States, Venezuela, Chile, Colombia, and Spain.",
        "The price you see is the final price, shipping included.",
        "Every merchant has its own storefront and catalog.",
        "It's operated by Mercatren LLC in Michigan and developed by Windoce LLC.",
      ],
    },
    relacion: {
      es: "Losupe es de Windoce LLC, que desarrolla Mercatren",
      en: "Losupe is part of Windoce LLC, which develops Mercatren",
    },
    verificado: "2026-11-07",
  },
  {
    id: "yadominios",
    nombre: "YaDominios",
    url: "https://yadominios.com",
    imagen: "/img/casa/yadominios.jpg",
    queEs: {
      es: "Registro de dominios y hosting web con precios claros y renovación al mismo precio que se ve desde el primer día.",
      en: "Domain registration and web hosting with clear prices and a renewal price shown from day one.",
    },
    paraQuien: {
      es: "Emprendedores y negocios que quieren su dominio y su página sin letra pequeña.",
      en: "Entrepreneurs and businesses who want their domain and website without fine print.",
    },
    datos: {
      es: [
        "Dominios .com desde 14 dólares al año, con el precio de renovación visible desde el principio.",
        "Privacidad WHOIS y DNS incluidos sin costo extra.",
        "Hosting YaDominios Cloud desde 1,99 dólares al mes, publicando desde GitHub, con HTTPS gratis.",
        "Soporte en español.",
      ],
      en: [
        ".com domains from $14 a year, with the renewal price shown up front.",
        "WHOIS privacy and DNS included at no extra cost.",
        "YaDominios Cloud hosting from $1.99 a month, deploying from GitHub, with free HTTPS.",
        "Support in Spanish.",
      ],
    },
    cuidado: "No repetir años de trayectoria ni cifras de dominios: no se pudieron comprobar.",
    verificado: "2026-11-07",
  },
  {
    id: "aliramoney",
    nombre: "Alira",
    url: "https://aliramoney.com",
    imagen: "/img/casa/aliramoney.jpg",
    queEs: {
      es: "Una forma de comprar criptomonedas con tarjeta de débito o crédito y recibirlas directo en tu propia billetera.",
      en: "A way to buy crypto with a debit or credit card and receive it straight in your own wallet.",
    },
    paraQuien: {
      es: "Personas que ya tienen su billetera y quieren comprar USDT u otras monedas con su tarjeta, sin dejar el dinero en una plataforma.",
      en: "People who already have a wallet and want to buy USDT or other coins with their card without leaving funds on a platform.",
    },
    datos: {
      es: [
        "Compra USDT, USDC, Bitcoin, Ether, Solana, Polygon, Avalanche y Stellar con tarjeta.",
        "Alira no guarda las monedas ni el dinero: van directo a la billetera de quien compra.",
        "Los pagos con tarjeta los procesa un proveedor regulado y con licencia.",
        "La tasa y la comisión se ven antes de confirmar.",
        "La primera compra pide verificación de identidad; algunos activos no están disponibles en Nueva York. La venta está en mantenimiento.",
      ],
      en: [
        "Buy USDT, USDC, Bitcoin, Ether, Solana, Polygon, Avalanche, and Stellar with a card.",
        "Alira never holds the coins or the money: they go straight to the buyer's wallet.",
        "Card payments are processed by a regulated, licensed provider.",
        "The rate and fee are shown before you confirm.",
        "The first purchase requires identity verification; some assets aren't available in New York. Selling is under maintenance.",
      ],
    },
    cuidado:
      "Es un producto financiero: cero consejos de inversión, cero promesas de ganancia, y aclarar que las criptomonedas son volátiles. No decir que vende cripto: la venta está en mantenimiento.",
    verificado: "2026-11-07",
  },
  {
    id: "tokiia",
    nombre: "Tokiia",
    url: "https://tokiia.com",
    imagen: "/img/casa/tokiia.jpg",
    queEs: {
      es: "Una billetera de criptomonedas donde las llaves son tuyas, con intercambio entre personas (P2P) y cambio entre monedas integrados.",
      en: "A self-custody crypto wallet with built-in peer-to-peer (P2P) trading and token swaps.",
    },
    paraQuien: {
      es: "Quien quiere manejar sus criptomonedas sin dejarlas en manos de una plataforma, y comercios que quieren cobrar en cripto (Tokiia Pay).",
      en: "People who want to manage their crypto without handing it to a platform, and merchants who want to accept crypto (Tokiia Pay).",
    },
    datos: {
      es: [
        "Billetera sin custodia: las llaves privadas son del usuario.",
        "Enviar, recibir, cambiar entre monedas y comprar o vender entre personas desde la misma app.",
        "Historial de movimientos y gráficos del portafolio.",
        "Tokiia Pay: pasarela para que un negocio acepte pagos en cripto, con documentación para programadores.",
        "Desbloqueo con huella o rostro y verificación en dos pasos.",
      ],
      en: [
        "Self-custody wallet: private keys belong to the user.",
        "Send, receive, swap tokens, and buy or sell peer to peer from the same app.",
        "Transaction history and portfolio charts.",
        "Tokiia Pay: a gateway for businesses to accept crypto payments, with developer docs.",
        "Fingerprint or face unlock and two-step verification.",
      ],
    },
    cuidado:
      "Producto financiero: sin consejos de inversión ni promesas de ganancia. No repetir «miles de usuarios» ni «0 % de comisiones» (no comprobado) ni comparar con otras marcas por nombre.",
    verificado: "2026-11-07",
  },
];

export function getProducto(id: string): Producto | undefined {
  return PRODUCTOS.find((p) => p.id === id);
}
