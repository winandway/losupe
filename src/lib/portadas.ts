import { getSection, type SectionId } from "@/lib/sections";

/**
 * PORTADAS PROPIAS: la imagen que se pinta cuando una nota no tiene foto.
 *
 * Nace de algo que vio Richard el 29 ago 2026 en la nota de los cierres de cuentas bancarias: donde
 * debía ir la miniatura había un cuadro azul oscuro con la «l.» del logotipo, que además se lee como
 * un uno. Sus palabras: *«quedó horrible, de fea… las miniaturas son muy importantes porque son las
 * que jalan al usuario a leer»*. Y es exactamente así: en una portada, la miniatura decide si
 * alguien entra o pasa de largo. Un marcador vacío es una nota que nadie abre.
 *
 * Su idea también estaba bien encaminada: para esa nota, «un banco con una X grande roja o el
 * símbolo de prohibido». Eso es lo que hace esto — **dibuja el tema**, no un adorno.
 *
 * POR QUÉ SVG DIBUJADO POR NOSOTROS Y NO UNA IMAGEN GENERADA CON IA:
 * - Sale al instante y no cuesta ni un centavo, así que puede ir en TODAS las notas sin foto, no en
 *   las que alcance el presupuesto del día.
 * - No depende de ninguna llave. Funciona hoy, sin esperar a nadie.
 * - Es nítido en cualquier pantalla y pesa unos pocos kilobytes.
 * - Es siempre el mismo estilo, así que el diario se reconoce de un vistazo.
 *
 * El orden completo de la casa está en `docs/imagenes.md`: primero una imagen propia generada
 * (Seedream), luego una foto real de Pexels cuando el tema la pide (historia, personas, lugares), y
 * esto como red que nunca falla. Lo que ya no vuelve es el cuadro vacío.
 */

/** Medida de tarjeta social: es la que piden Google, WhatsApp y las redes. */
export const ANCHO = 1200;
export const ALTO = 630;

const TINTA = "#0B1F3A";
const PAPEL = "#FBF9F4";

/**
 * Los símbolos, dibujados a mano en trazo grueso para que se lean a 140 píxeles de ancho, que es el
 * tamaño real de una miniatura en el celular. Un icono con detalle fino ahí se convierte en una
 * mancha.
 *
 * Cada uno se dibuja dentro de un cuadro de 200×200 y se coloca después.
 */
const SIMBOLOS: Record<string, string> = {
  // Cuenta cancelada: una tarjeta bancaria tachada. El caso que pidió Richard.
  "cuenta-cerrada": `
    <rect x="18" y="52" width="164" height="106" rx="14" fill="none" stroke="currentColor" stroke-width="11"/>
    <path d="M18 88h164" stroke="currentColor" stroke-width="11"/>
    <rect x="40" y="112" width="46" height="12" rx="6" fill="currentColor"/>
    <line x1="34" y1="38" x2="166" y2="172" stroke="var(--alerta)" stroke-width="15" stroke-linecap="round"/>`,
  // Prohibido / bloqueado
  prohibido: `
    <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" stroke-width="13"/>
    <line x1="49" y1="49" x2="151" y2="151" stroke="var(--alerta)" stroke-width="15" stroke-linecap="round"/>`,
  // Algo que se cae: mercados, precios, despidos
  caida: `
    <polyline points="20,58 76,116 112,80 180,148" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="146,148 180,148 180,114" fill="none" stroke="var(--alerta)" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Algo que sube
  subida: `
    <polyline points="20,148 76,90 112,126 180,58" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
    <polyline points="146,58 180,58 180,92" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Ley, demanda, multa, regulación: una balanza
  ley: `
    <line x1="100" y1="34" x2="100" y2="166" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>
    <line x1="38" y1="62" x2="162" y2="62" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>
    <line x1="62" y1="166" x2="138" y2="166" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>
    <path d="M14 108a24 24 0 0048 0z" fill="none" stroke="currentColor" stroke-width="11" stroke-linejoin="round"/>
    <path d="M138 108a24 24 0 0048 0z" fill="none" stroke="currentColor" stroke-width="11" stroke-linejoin="round"/>
    <line x1="38" y1="62" x2="38" y2="108" stroke="currentColor" stroke-width="9"/>
    <line x1="162" y1="62" x2="162" y2="108" stroke="currentColor" stroke-width="9"/>`,
  // Un bulo, una alerta
  alerta: `
    <path d="M100 26 186 168H14z" fill="none" stroke="var(--alerta)" stroke-width="13" stroke-linejoin="round"/>
    <line x1="100" y1="82" x2="100" y2="118" stroke="var(--alerta)" stroke-width="13" stroke-linecap="round"/>
    <circle cx="100" cy="141" r="8" fill="var(--alerta)"/>`,
  // Inteligencia artificial, tecnología: un chip
  chip: `
    <rect x="52" y="52" width="96" height="96" rx="12" fill="none" stroke="currentColor" stroke-width="12"/>
    <rect x="82" y="82" width="36" height="36" rx="5" fill="currentColor"/>
    <g stroke="currentColor" stroke-width="11" stroke-linecap="round">
      <line x1="76" y1="52" x2="76" y2="22"/><line x1="124" y1="52" x2="124" y2="22"/>
      <line x1="76" y1="148" x2="76" y2="178"/><line x1="124" y1="148" x2="124" y2="178"/>
      <line x1="52" y1="76" x2="22" y2="76"/><line x1="52" y1="124" x2="22" y2="124"/>
      <line x1="148" y1="76" x2="178" y2="76"/><line x1="148" y1="124" x2="178" y2="124"/>
    </g>`,
  // Dinero, moneda, cripto
  moneda: `
    <circle cx="100" cy="100" r="72" fill="none" stroke="currentColor" stroke-width="13"/>
    <line x1="100" y1="42" x2="100" y2="158" stroke="currentColor" stroke-width="11" stroke-linecap="round"/>
    <path d="M126 72H88a19 19 0 000 38h24a19 19 0 010 38H74" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>`,
  // Una lista, un ranking
  lista: `
    <g stroke="currentColor" stroke-width="13" stroke-linecap="round">
      <line x1="76" y1="52" x2="178" y2="52"/><line x1="76" y1="100" x2="178" y2="100"/>
      <line x1="76" y1="148" x2="140" y2="148"/>
    </g>
    <circle cx="34" cy="52" r="11" fill="currentColor"/>
    <circle cx="34" cy="100" r="11" fill="currentColor"/>
    <circle cx="34" cy="148" r="11" fill="currentColor"/>`,
  // Personas, trabajo, comunidad
  gente: `
    <circle cx="76" cy="66" r="30" fill="none" stroke="currentColor" stroke-width="12"/>
    <path d="M20 168c0-31 25-56 56-56s56 25 56 56" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>
    <circle cx="146" cy="76" r="22" fill="none" stroke="currentColor" stroke-width="11"/>
    <path d="M124 152c8-22 26-36 48-32" fill="none" stroke="currentColor" stroke-width="11" stroke-linecap="round"/>`,
  // El tiempo: efemérides, aniversarios, historia
  tiempo: `
    <circle cx="100" cy="100" r="74" fill="none" stroke="currentColor" stroke-width="13"/>
    <polyline points="100,52 100,102 138,124" fill="none" stroke="currentColor" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Música, cultura
  musica: `
    <circle cx="60" cy="146" r="28" fill="none" stroke="currentColor" stroke-width="12"/>
    <circle cx="150" cy="126" r="24" fill="none" stroke="currentColor" stroke-width="12"/>
    <path d="M88 146V44l86-18v100" fill="none" stroke="currentColor" stroke-width="12" stroke-linejoin="round"/>`,
  // Comercio, tienda
  tienda: `
    <path d="M28 76h144l-12 92H40z" fill="none" stroke="currentColor" stroke-width="12" stroke-linejoin="round"/>
    <path d="M72 76V52a28 28 0 0156 0v24" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>`,
};

/** Si el titular no dice nada claro, cada sección tiene su símbolo. */
const POR_SECCION: Record<SectionId, string> = {
  economia: "moneda",
  ventas: "tienda",
  tecnologia: "chip",
  cripto: "moneda",
  artistas: "musica",
};

/**
 * Qué dibujar, leído del titular.
 *
 * Se mira PRIMERO lo más específico. «Cierres de cuentas bancarias» tiene que dar la tarjeta
 * tachada, no la moneda genérica de la sección de economía: el símbolo bueno cuenta la nota, el
 * genérico solo rellena.
 */
const PISTAS: readonly [RegExp, string][] = [
  [
    /cierr|cerrad|clos(e|ing|ure)|cancelad|bloque|congel|frozen|freez|sin banco|unbank/i,
    "cuenta-cerrada",
  ],
  [/prohib|veta|ban(ned|ea)|censur|restring|restrict|niega|denied|rechaz/i, "prohibido"],
  [
    /bulo|falso|fake|mentira|enga(ñ|n)|hoax|estafa|scam|fraude|fraud|alerta|warning|cuidado/i,
    "alerta",
  ],
  // Sucesos: un terremoto, un incendio, una emergencia. Llevan alerta, no la moneda de su sección.
  [
    /terremoto|sismo|earthquake|hurac(a|á)n|hurricane|incendio|wildfire|inundaci(o|ó)n|flood|emergencia|emergency|muert(o|e)s|fallecid|v(i|í)ctima|victim|heridos|desastre|disaster|derrumbe|accidente/i,
    "alerta",
  ],
  [
    /demanda|lawsuit|multa|fine|juez|court|ley|law|regula|sanci(o|ó)n|sanction|denuncia|derechos|rights/i,
    "ley",
  ],
  [
    /ca(e|í)da|desplom|baja|cae|drop|fall|crash|p(e|é)rdida|loss|recesi(o|ó)n|despido|layoff/i,
    "caida",
  ],
  [
    /sube|subida|r(e|é)cord|record|dispara|surge|rally|crece|growth|gana|m(a|á)ximo|high/i,
    "subida",
  ],
  [
    /\bia\b|inteligencia artificial|\bai\b|chatgpt|gemini|claude|robot|algoritmo|algorithm|chip|software|app\b/i,
    "chip",
  ],
  [
    /bitcoin|btc|cripto|crypto|ethereum|d(o|ó)lar|dollar|dinero|money|precio|price|salario|wage|banco|bank|pago|payment/i,
    "moneda",
  ],
  [
    /\d+\s+(curiosidad|error|clave|cosa|raz(o|ó)n|truco|fact|mistake|reason|thing|tip)|ranking|los m(a|á)s|the most|mejores|best|top\b/i,
    "lista",
  ],
  [
    /inmigrant|immigrant|latino|hispan|trabajador|worker|empleo|jobs|familia|famil|gente|people|generaci(o|ó)n/i,
    "gente",
  ],
  // Efemérides: «diez años sin…», «a 50 años de…». El número puede venir en palabra.
  [
    /\d+\s*a(ñ|n)os|(un|dos|tres|cinco|diez|veinte|treinta|cuarenta|cincuenta|cien)\s+a(ñ|n)os|a(ñ|n)os (sin|de|desde|despu(e|é)s)|aniversario|anniversary|years (since|ago)|\bhistoria\b|\bhistory\b|efem(e|é)ride/i,
    "tiempo",
  ],
  [
    /m(u|ú)sica|music|canci(o|ó)n|song|artista|artist|cantant|singer|(a|á)lbum|album|concierto|concert/i,
    "musica",
  ],
  [/tienda|store|shop|vend|sell|comercio|retail|compra|buy|ecommerce/i, "tienda"],
];

export function simboloPara(titulo: string, sectionId: SectionId): string {
  for (const [pista, simbolo] of PISTAS) if (pista.test(titulo)) return simbolo;
  return POR_SECCION[sectionId] ?? "lista";
}

/** Escapa lo que va dentro del SVG. Un `&` suelto en un titular deja la imagen en blanco. */
export function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Ancho aproximado de cada letra, en fracción del tamaño de la fuente.
 *
 * Hace falta porque SVG no sabe ajustar texto: si el titular no se parte a mano, se sale de la
 * imagen por la derecha y se pierde media frase (pasó a la primera, con la nota de los bancos).
 * Y contar LETRAS no vale: «mmm» ocupa el triple que «lil». Hay que medir el ancho de verdad, que
 * es lo que hace cualquier motor de texto.
 */
const ANCHOS: readonly [RegExp, number][] = [
  [/[ .,;:'!|]/, 0.27],
  [/[ijlItf(){}[\]]/, 0.33],
  [/[rs]/, 0.42],
  [/[mwMW]/, 0.86],
  [/[A-ZÁÉÍÓÚÑ]/, 0.68],
  [/[0-9]/, 0.55],
];

/** Cuánto mide un texto, en píxeles, a un tamaño dado. */
export function anchoAprox(texto: string, tamano: number): number {
  let em = 0;
  for (const c of texto) {
    const regla = ANCHOS.find(([re]) => re.test(c));
    em += regla ? regla[1] : 0.55;
  }
  // Un 6 % de margen. Es una estimación, y equivocarse por ancho solo hace el titular un punto más
  // pequeño; equivocarse por estrecho lo saca de la imagen, que es lo que no puede pasar.
  return em * tamano * 1.06;
}

/**
 * Parte el titular en líneas que quepan de verdad en el ancho dado, y devuelve también el tamaño de
 * letra que hay que usar.
 *
 * Si con el tamaño grande no cabe en las líneas disponibles, se baja un punto y se vuelve a probar,
 * como haría un diagramador. Solo cuando ya no se puede bajar más se recorta con puntos suspensivos:
 * un titular cortado es peor que uno pequeño, pero un titular gigante que se sale es lo peor de todo.
 */
export function componerTitular(
  titulo: string,
  ancho: number,
  maxLineas = 4,
  tamanoMax = 54,
  tamanoMin = 34,
): { lineas: string[]; tamano: number } {
  const palabras = titulo.trim().split(/\s+/);
  for (let tamano = tamanoMax; tamano >= tamanoMin; tamano -= 2) {
    const lineas: string[] = [];
    let actual = "";
    let cabe = true;
    for (const palabra of palabras) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (anchoAprox(prueba, tamano) > ancho && actual) {
        lineas.push(actual);
        actual = palabra;
        if (lineas.length >= maxLineas) {
          cabe = false;
          break;
        }
      } else {
        actual = prueba;
      }
    }
    if (cabe && actual) lineas.push(actual);
    if (cabe && lineas.length <= maxLineas) return { lineas, tamano };
  }
  // Ni al tamaño más pequeño cabe: se recorta la última línea.
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (anchoAprox(prueba, tamanoMin) > ancho && actual) {
      lineas.push(actual);
      actual = palabra;
      if (lineas.length === maxLineas) break;
    } else {
      actual = prueba;
    }
  }
  if (lineas.length < maxLineas && actual) lineas.push(actual);
  const ultima = lineas[lineas.length - 1] ?? "";
  while (lineas.length > 0 && anchoAprox(`${ultima}…`, tamanoMin) > ancho) {
    lineas[lineas.length - 1] = (lineas[lineas.length - 1] ?? "").replace(/\s*\S+$/, "");
    if ((lineas[lineas.length - 1] ?? "").length < 4) break;
  }
  lineas[lineas.length - 1] = `${(lineas[lineas.length - 1] ?? "").replace(/[\s,;:.]+$/, "")}…`;
  return { lineas, tamano: tamanoMin };
}

export type OpcionesPortada = {
  titulo: string;
  sectionId: SectionId;
  lang?: "es" | "en";
};

/**
 * La portada, dibujada.
 *
 * Composición: el símbolo grande a la izquierda sobre un tinte de la sección, el titular a la
 * derecha sobre papel, y la marca abajo. Se lee igual de bien a 1200 píxeles que a 140.
 */
export function portadaSvg({ titulo, sectionId, lang = "es" }: OpcionesPortada): string {
  const section = getSection(sectionId);
  const color = section?.color ?? "#2EE6A6";
  const nombre = section?.name[lang] ?? sectionId;
  const simbolo = SIMBOLOS[simboloPara(titulo, sectionId)] ?? SIMBOLOS.lista ?? "";
  // El ancho real que queda para el texto: desde la columna del símbolo hasta el margen derecho.
  const anchoTexto = ANCHO - 530 - 70;
  const { lineas, tamano } = componerTitular(titulo, anchoTexto);
  // El bloque de texto se centra en vertical, así un titular de una línea no queda flotando arriba.
  const alturaLinea = Math.round(tamano * 1.22);
  const inicioY = ALTO / 2 - ((lineas.length - 1) * alturaLinea) / 2 - 6;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="${escaparXml(titulo)}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.30"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0.06"/>
    </linearGradient>
  </defs>
  <rect width="${ANCHO}" height="${ALTO}" fill="${PAPEL}"/>
  <rect width="470" height="${ALTO}" fill="url(#fondo)"/>
  <rect x="466" width="4" height="${ALTO}" fill="${color}"/>

  <g transform="translate(135 215) scale(1.0)" color="${TINTA}" style="--alerta:#E23D3D">
    ${simbolo}
  </g>

  <g transform="translate(530 0)">
    <rect x="0" y="86" width="${(nombre.length + 2) * 15}" height="42" rx="21" fill="${color}"/>
    <text x="${((nombre.length + 2) * 15) / 2}" y="115" text-anchor="middle"
          font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="20"
          font-weight="800" letter-spacing="1.6" fill="${section?.onColor ?? TINTA}">${escaparXml(nombre.toUpperCase())}</text>
    ${lineas
      .map(
        (l, i) =>
          `<text x="0" y="${inicioY + i * alturaLinea}" font-family="Georgia, 'Times New Roman', serif" font-size="${tamano}" font-weight="700" fill="${TINTA}">${escaparXml(l)}</text>`,
      )
      .join("\n    ")}
    <text x="0" y="${ALTO - 62}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"
          font-size="26" font-weight="800" fill="${TINTA}" opacity="0.55">losupe<tspan fill="${color}">.</tspan>com</text>
  </g>
</svg>`;
}

/**
 * LA MINIATURA: solo el símbolo, sin una letra.
 *
 * Hacen falta DOS versiones y la diferencia se vio a la primera, en pantalla. La portada grande
 * lleva el titular dentro porque está pensada para viajar sola —WhatsApp, Google, una red social—,
 * donde no hay nada más que la acompañe. Pero en una tarjeta del sitio esa misma imagen se pinta a
 * unos 140 píxeles **con el titular escrito al lado**: el texto de dentro no se lee, y encima
 * compite con el de fuera. Sucia y repetida.
 *
 * Aquí el símbolo puede ocupar todo el espacio, que es lo que se reconoce de un vistazo mientras se
 * baja por la portada con el pulgar.
 */
export function miniaturaSvg({ titulo, sectionId }: OpcionesPortada): string {
  const section = getSection(sectionId);
  const color = section?.color ?? "#2EE6A6";
  const simbolo = SIMBOLOS[simboloPara(titulo, sectionId)] ?? SIMBOLOS.lista ?? "";
  const ancho = 640;
  const alto = 360;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="${escaparXml(titulo)}">
  <defs>
    <linearGradient id="mini" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.34"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0.10"/>
    </linearGradient>
  </defs>
  <rect width="${ancho}" height="${alto}" fill="${PAPEL}"/>
  <rect width="${ancho}" height="${alto}" fill="url(#mini)"/>
  <g transform="translate(${ancho / 2} ${alto / 2}) scale(1.45) translate(-100 -100)" color="${TINTA}" style="--alerta:#E23D3D">
    ${simbolo}
  </g>
</svg>`;
}

/**
 * Rutas públicas. `mini` es la de las tarjetas del sitio (solo el símbolo) y la normal es la que se
 * comparte, con el titular dentro.
 */
export function rutaPortada(articleId: string, mini = false): string {
  return `/media/portada/${encodeURIComponent(articleId)}${mini ? "-mini" : ""}.svg`;
}
