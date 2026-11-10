# Revisión de Google, publicaciones y videos — 10 de noviembre de 2026

> Pedido de Richard: «cómo va el posicionamiento y la entrada a Google, si ya nos reconoce como medio
> de comunicación, cómo van las publicaciones y las publicidades, y qué necesitan los videos de
> nuestro lado». Todo lo de abajo está medido ese día, con la cuenta de Richard; nada es de memoria.

## 1. Lo primero, porque cambia la pregunta: ya no existe «entrar a Google Noticias»

Publisher Center avisa en su propia portada: **desde marzo de 2025 Google Noticias genera las páginas
de publicación automáticamente.** No hay solicitud que mandar, ni revisión que esperar, ni sello de
«medio aprobado». Que una nota aparezca en Noticias depende de **que Google la rastree y la indexe
como noticia**, igual que en la búsqueda normal.

Publisher Center sirve hoy para dos cosas: la ficha de la publicación (nombre, idioma, sede, logo) y
Reader Revenue Manager (suscripciones y aportes, sin empezar).

**Estado de nuestra ficha:** publicación «losupe» creada, idioma español (Latinoamérica), sede Estados
Unidos, y el dominio **losupe.com verificado**. De ahí no falta nada.

## 2. Los números del posicionamiento

| Qué                                                  | Valor                                                     |
| ---------------------------------------------------- | --------------------------------------------------------- |
| Páginas indexadas                                    | **153**                                                   |
| Páginas sin indexar                                  | **708** (nueve motivos)                                   |
| Fecha del informe de páginas                         | 5 nov 2026 (todavía no refleja los arreglos del 7 y el 8) |
| Últimos 28 días                                      | **1 clic, 19 impresiones, posición media 18,1**           |
| Consultas que nos vieron                             | «versosperfectos» (2) y «cómo se puede» (1)               |
| Vídeos indexados                                     | **0**                                                     |
| Mapa del sitio · páginas descubiertas                | 501 (última lectura: 29 oct)                              |
| Mapa de noticias · páginas descubiertas              | **2** (leído el 7 nov)                                    |
| Google Noticias, pestaña Noticias, `site:losupe.com` | solo la portada, con extracto del 23 ago                  |

Las indexadas **bajaron** (eran 236 el 22 oct). Las sin indexar subieron de 457 a 708. Los motivos
grandes son los mismos del informe del 7 de noviembre y los dos primeros ya están arreglados en
código; lo que falta es que Google vuelva a pasar:

- Rastreada, actualmente sin indexar: 214
- Descubierta, sin indexar: 184
- Página con redirección: 142
- Duplicada, Google eligió otra canónica: 136
- Excluida por «noindex»: 24

**Lo que de verdad frena hoy no es un fallo técnico, es el volumen.** El mapa de noticias le ofreció a
Google **dos** notas en 48 horas. Google Noticias quiere un flujo diario y constante. Por eso el punto 3
de este informe es el más importante de los tres.

## 3. Las publicaciones: dos al día con un cupo de diez

Ritmo real de los últimos quince días, contado del feed: **29 notas**, menos de dos al día. Hubo dos
días con cero.

**Causa, y no era la que parecía.** El latido por tráfico (el piloto automático que se dispara con las
visitas) lanzaba **36 corridas al día y las 36 morían**. Mueren porque el trabajo va en segundo plano
de una petición que ya respondió: sin nadie esperando la respuesta, la nube lo corta mucho antes de
los minutos que tarda escribir una nota. Las del reloj de GitHub, que esperan, sí terminan.

Lo grave no era el gasto (dos centavos al día de un tope de un dólar) sino el daño colateral: **cada
corrida muerta gasta un intento del turno**, y con ocho intentos por turno el latido los quemaba todos
en una hora. Cuando el reloj llegaba, encontraba el turno agotado y se iba sin publicar. La huella
quedó en el canario de ese día: `turnoHecho: "2026-11-10:manana-2#7"`.

**Arreglado (candado 60):** el latido vuelve a ser la red de emergencia —si el reloj corrió en las
últimas tres horas, se aparta y no toca el turno— y el reloj deja de ser un disparo suelto: monta una
**guardia de cinco horas y media** que llama cada quince minutos. Los cron de GitHub, en un
repositorio público, llegan dos o tres veces al día aunque se programen veinticuatro; con la guardia
basta con que lleguen cuatro para cubrir el día entero.

### Las publicidades

- **Notas patrocinadas:** un patrocinador activo, **cuatro notas publicadas**, cola vacía. El ritmo
  está limitado a dos por semana con 72 horas de separación, para que la sección no parezca un
  catálogo.
- **«Desde Windoce»** (las notas de nuestros propios productos): la sección está publicada y
  funcionando, pero dice **«0 notas»**. Las siete de la primera semana están escritas y esperando en
  el panel, en «Notas → Para revisar». Hasta que Richard apruebe cinco, el robot no sigue solo.
- **Boletín:** activo y programado, nunca enviado: hay **0 suscriptores confirmados** y 2 sin
  confirmar. No hay a quién mandarlo todavía.
- **Redes sociales:** las cuatro (Telegram, Bluesky, Mastodon, Facebook) siguen escritas y apagadas
  por falta de llaves.

## 4. Los videos: qué necesitaban y qué necesitan ahora

Once de las doce notas recientes llevaban su video. Y Search Console decía **«0 vídeos indexados»**,
«vídeos descubiertos: 0» en los dos mapas, y el único que encontró marcado **«el vídeo no está en una
página de visualización»**.

No faltaba nada del lado de Richard. Faltaban tres cosas del nuestro, y las tres están hechas:

1. **El `<video>` no existía en el HTML.** Lo pintaba el navegador cuando el lector se acercaba, así
   que Google recibía solo una foto. Ahora viene del servidor con `preload="none"`: existe en la
   página y **no se descarga un byte del archivo hasta que se reproduce**. Y sin JavaScript quedan los
   controles del navegador, para que el video no sea una foto muerta.
2. **La nota no declaraba el video.** Ahora lleva su `VideoObject` con el archivo, la miniatura, la
   fecha y **la página donde se ve**, que era justo lo que Google echaba en falta.
3. **El mapa del sitio no lo nombraba.** Ahora cada nota con video lo declara ahí, igual que se hizo
   con las fotos en agosto.

### Lo único que puede hacer falta de parte de Richard

Hoy el video sale solo, de un banco de imágenes gratuito (Pexels), con su crédito y eligiendo el que
corresponde al tema; en notas delicadas no se pone ninguno. Eso cubre el día a día sin que nadie haga
nada.

Si se quiere **video propio** —grabado por él o sacado de sus canales— hace falta una decisión suya,
no un trabajo técnico: decir si quiere una casilla en el panel para pegar el enlace de un video suyo
en una nota concreta. Es media hora de trabajo y no depende de nadie más.

## 5. Qué mirar y cuándo

- **14 nov:** la lista del informe de indexación del 7 de noviembre (que el informe de páginas tenga
  fecha posterior al 7, que «Página con redirección» y «noindex» dejen de crecer, que «indexadas»
  suba de 153).
- **17 nov:** que «vídeos indexados» pase de 0 y que «vídeos descubiertos» en el mapa deje de ser 0.
- **Cada día:** que el canario muestre más de dos notas publicadas. Si vuelve a quedarse en dos, mirar
  si la guardia del reloj está corriendo.
