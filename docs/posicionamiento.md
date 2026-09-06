# Posicionamiento: dónde estamos y qué falta

> Auditoría del 6 de septiembre de 2026. El sitio se publicó el **22 de agosto de 2026**: tiene
> **dos semanas de vida**. Ese dato cambia cómo se lee todo lo demás.

## Lo primero, sin rodeos

**Hoy no aparecemos en las búsquedas, y es lo normal a las dos semanas.** Un dominio nuevo tarda
entre uno y tres meses en empezar a salir, aunque todo esté bien hecho. No hay ningún castigo ni
nada roto: hay que esperar y seguir publicando.

Lo comprobado el 6 de septiembre:

| Comprobación                                              | Resultado                                                  |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| Búsqueda `site:losupe.com` en DuckDuckGo (índice de Bing) | **Sin resultados**                                         |
| ¿Está bloqueado el rastreo?                               | **No.** `robots.txt` permite todo salvo las rutas internas |
| ¿Hay etiquetas «no indexar»?                              | **No**, ninguna                                            |
| ¿Los buscadores tienen el mapa del sitio?                 | **Sí:** 161 páginas y 18 noticias                          |
| ¿Podemos ver por qué palabras nos buscan?                 | **NO.** Search Console sin verificar                       |

Esa última línea es la importante: **estamos publicando a ciegas.** Sin Search Console no hay forma
de saber qué busca la gente, qué páginas ve Google ni pedir que indexe una nota nueva.

## Lo que ya está hecho y funcionando

Esto no hay que tocarlo; está comprobado en producción:

- **Mapa del sitio y mapa de noticias**, los dos servidos y al día.
- **`robots.txt` completo**, con permisos explícitos para los rastreadores de IA (ChatGPT, Claude,
  Perplexity, Gemini) y la señal de que se puede citar pero no entrenar.
- **Aviso automático a los buscadores (IndexNow)**: cada nota nueva se les notifica sola.
- **Datos estructurados** en cada nota: autor, medio, fechas de publicación y actualización, imagen.
- **Dos idiomas bien declarados** (`hreflang` español/inglés/x-default), que es lo que evita que
  Google trate las dos versiones como contenido duplicado.
- **Enlace canónico** en todas las páginas.
- **Páginas de confianza**, que Google exige a un medio: contacto, acerca de, política editorial y
  una ficha por cada firma con su especialidad.
- **Tarjeta social** al compartir (imagen, título y descripción).
- **Velocidad medida el 6 sep:** entre 0,42 s y 1,8 s hasta el primer byte, con la mayoría alrededor
  de 0,8 s. Aceptable. La primera visita tras un rato de silencio es más lenta (arranque en frío) y
  llegó a marcar 4,4 s en una medición aislada.

## Lo que estaba MAL y se arregló hoy

**Ninguna nota se marcaba como noticia.** El tipo de nota se decidía con un porcentaje que, con
cuatro notas al día, daba siempre el mismo resultado. En los datos estructurados todas salían como
`Article` (guía) y no como `NewsArticle` (noticia), así que **Google Noticias no veía ni una sola
noticia nuestra**. Detalle completo en el candado 47 de [`candados.md`](candados.md).

Desde hoy, toda nota de actualidad se declara como noticia. Es el cambio que abre esa puerta.

## Lo que falta, en orden

### 1. Verificar Search Console — lo hace Richard, 5 minutos

Es lo primero y lo más importante. Sin esto no se puede medir nada ni pedir indexación.

El código ya está preparado: solo hay que pegar el valor y republicar.

1. Entra a `https://search.google.com/search-console` y añade la propiedad `https://losupe.com`.
2. Elige el método **«Etiqueta HTML»**. Google muestra algo así:
   `<meta name="google-site-verification" content="AbC123..." />`
3. Copia **solo el valor de `content`**, sin la etiqueta.
4. Pégalo en YaDominios Cloud → tarjeta del sitio `losupe` → Variables de entorno, en una variable
   nueva llamada `GOOGLE_SITE_VERIFICATION`.
5. Guarda y republica. Vuelve a Search Console y pulsa «Verificar».

Después, dentro de Search Console: enviar el mapa del sitio
(`https://losupe.com/sitemap.xml`) y el de noticias (`https://losupe.com/news-sitemap.xml`).

**Lo mismo para Bing** en `https://www.bing.com/webmasters`, con la variable
`BING_SITE_VERIFICATION`. Bing alimenta también a DuckDuckGo y a ChatGPT.

### 2. Google Publisher Center — lo hace Richard, cuando quiera

Es el registro para aparecer en la pestaña de Noticias y en Google Discover. Ya se puede hacer:
las páginas de confianza están, las firmas tienen ficha y desde hoy las notas se declaran como
noticias.

### 3. Que alguien nos enlace — lo hace Richard

**Es lo que más pesa y es lo único que no se puede programar.** Google confía en un sitio nuevo
cuando otros sitios lo enlazan. Hoy no nos enlaza nadie.

Lo que de verdad mueve la aguja, en orden de facilidad:

- Enlazar losupe.com desde los otros sitios del grupo (mercatren.com, windoce.com, yadominios.com).
- Las cuentas de redes sociales, con el enlace en la biografía.
- Un perfil de empresa en Google (Google Business Profile).

### 4. Encender las redes sociales — falta una llave

El código está escrito y probado desde el 29 de agosto: cada nota se anuncia sola en Telegram,
Bluesky, Mastodon y Facebook. **Solo falta pegar las llaves.** Paso a paso en
[`redes-sociales.md`](redes-sociales.md). Además de traer visitas, cada anuncio es un enlace que
ayuda al posicionamiento.

### 5. Seguir publicando

Un medio nuevo se posiciona por constancia. Cuatro notas al día, todos los días, es exactamente lo
que hay que hacer — y ya funciona solo.

## Cómo se comprueba dentro de un mes

1. En Search Console → Rendimiento: tiene que haber impresiones (veces que salimos en una búsqueda).
   Al principio serán pocas y por el nombre «losupe»; eso es normal.
2. En Search Console → Páginas: cuántas están indexadas de las 161 del mapa.
3. Buscar `site:losupe.com` en Google: deberían empezar a salir páginas.
4. En el panel de tráfico de losupe (`https://losupe.com/panel/trafico`), en «Por dónde llegan»,
   tiene que empezar a aparecer Google como origen.

## Qué NO hacer

- **No comprar enlaces.** Es la forma más rápida de que Google castigue un dominio nuevo.
- **No publicar el mismo tema dos veces** para «cubrir más palabras»: Google lo lee como contenido
  duplicado y elige una sola, o ninguna. (Ese es justo el fallo del candado 47.)
- **No tocar el `robots.txt` ni los canónicos** sin leer antes este documento.
