# Redes sociales y video automático — qué se puede conectar

> Investigado el 23 de agosto de 2026 contra documentación oficial. Responde a dos preguntas de
> Richard: **(1)** en qué redes podemos publicar solos, por API, la imagen + un texto corto + el
> enlace a la nota; **(2)** qué API convierte una noticia en un video corto con voz e imágenes.

## 1. Redes donde el robot puede publicar solo

Ordenadas por «más fácil y barato primero». Todas parten de lo que ya tenemos: cada nota tiene
imagen propia (en R2), título, extracto y enlace.

| #   | Red                      | ¿Revisión de la app?            | Costo                         | Límite               | Imagen + enlace                         | Dificultad                                        |
| --- | ------------------------ | ------------------------------- | ----------------------------- | -------------------- | --------------------------------------- | ------------------------------------------------- |
| 1   | **Telegram** (canal)     | No                              | Gratis                        | 1 mensaje/seg        | Sí, foto + texto con enlace             | Muy baja: token que no expira                     |
| 2   | **Discord** (webhook)    | No                              | Gratis                        | ~5 envíos/2 s        | Sí, tarjeta completa                    | Muy baja: la URL del webhook es todo              |
| 3   | **Mastodon**             | No                              | Gratis                        | 300 peticiones/5 min | Sí (tarjeta automática)                 | Baja                                              |
| 4   | **Bluesky**              | No                              | Gratis                        | ~11.000 posts/día    | Sí, armando la tarjeta a mano           | Media                                             |
| 5   | **Facebook** (página)    | No, con acceso estándar         | Gratis                        | Amplio               | Enlace sí; la imagen la toma del sitio  | Baja; el token de página no expira                |
| 6   | **Instagram** (Business) | No, con acceso estándar         | Gratis                        | 100 posts/día        | Imagen sí; **el enlace no es clicable** | Baja                                              |
| 7   | **Threads**              | No                              | Gratis                        | 250 posts/día        | **O imagen, o enlace** (no juntos)      | Media; token de 60 días                           |
| 8   | **Tumblr**               | No                              | Gratis                        | 250 posts/día        | Sí                                      | Media                                             |
| 9   | **Pinterest**            | **Sí** (revisión con video)     | Gratis                        | 100/min              | Sí, es su formato                       | Media                                             |
| 10  | **X (Twitter)**          | No                              | **$0.20 por post con enlace** | Lo que pagues        | Sí                                      | Media                                             |
| 11  | **LinkedIn** (empresa)   | **Sí**, verificación de empresa | Gratis                        | 500/día              | Sí                                      | **Alta**: hay que reautorizar a mano cada 60 días |
| —   | **WhatsApp Canales**     | —                               | —                             | —                    | —                                       | **No existe API.** Solo manual desde la app       |
| —   | **YouTube / TikTok**     | Sí (auditoría)                  | Gratis                        | ~100/día             | **Solo video**                          | Alta                                              |
| —   | **Reddit**               | Sí, y cerrado desde nov 2025    | Comercial caro                | —                    | Sí                                      | Alta y con riesgo de bloqueo                      |

### Recomendación

**Empezar por cuatro:** Telegram (canal), Bluesky, Facebook + Instagram (mismo trabajo) y Mastodon.
Las cuatro son gratis, no piden revisión de aplicación y se automatizan de punta a punta.

**Dejar fuera por ahora:**

- **X**: cobra $0.20 por cada post que lleve enlace. Con 3 notas diarias en dos idiomas son unos
  **$36 al mes solo en X**, más que todo lo demás junto (que es $0). Es decisión de negocio, no
  técnica: si Richard lo quiere, se conecta.
- **LinkedIn**: sin ser socio comercial no dan renovación automática de permiso; cada 60 días
  alguien tendría que volver a autorizar en el navegador. Eso rompe la idea del robot.
- **WhatsApp Canales**: **no se puede por API**, punto. Los servicios que lo venden son ingeniería
  inversa, violan los términos y arriesgan el número. Para WhatsApp lo correcto es el boletín 1 a 1
  con la API oficial (bloque 4), con permiso del suscriptor.
- **Instagram**: el enlace del texto no es clicable; sirve para marca, no para traer visitas.

### Qué haría falta de Richard para conectarlas

| Red                | Qué necesito de él                                                                   |
| ------------------ | ------------------------------------------------------------------------------------ |
| Telegram           | Crear el canal, crear un bot con @BotFather y pasarme el token + el nombre del canal |
| Bluesky            | Cuenta de losupe y una «app password»                                                |
| Facebook/Instagram | Ser administrador de la página y de una app de Meta; me pasa el token de página      |
| Mastodon           | Cuenta en una instancia (p. ej. mastodon.social) y el token                          |

## 2. De la noticia al video corto (shorts)

Objetivo: cada nota se convierte sola en un video vertical de 20–30 segundos con voz en off,
imágenes de fondo, subtítulos y música, para TikTok, Reels, Shorts y Telegram.

### Cuánto cuesta cada camino (precios oficiales, 23 ago 2026)

| Camino                                               | Qué hace                                                                   | Costo por video de 25 s  | Costo al mes (300 videos: 5 notas × 2 idiomas × 30 días)                                            |
| ---------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| **JSON2Video** (recomendado)                         | Render completo por API: clips, movimiento, **voz y subtítulos incluidos** | $0.08–$0.14              | **$49.95** (plan Professional; con 3 shorts al día en español, **$16.95**)                          |
| Shotstack                                            | Igual, API madura                                                          | $0.08–$0.13              | ~$39 (el costo de su voz no está publicado hoy)                                                     |
| Creatomate                                           | Render por API; voz aparte                                                 | $0.21–$0.43              | ~$133                                                                                               |
| Remotion o ffmpeg en servidor propio                 | Lo armamos nosotros                                                        | $0.02–$0.05              | ~$10, **pero** hay que levantar un servidor de render fuera de YaDominios y construir todo el flujo |
| HeyGen (avatar que habla)                            | Presentador virtual                                                        | $0.42–$1.25              | ~$125                                                                                               |
| **Video generado por IA** (Veo, Runway, Luma, Kling) | Video inventado por IA                                                     | **$0.15–$1.60 por clip** | $360–$3.000 · **bloqueado por nuestra regla de costos**                                             |

### Voz en off (si queremos la nuestra en vez de la incluida)

| Servicio              | Precio                                                        | Por locución de 25 s            | Nota                                                       |
| --------------------- | ------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------- |
| **Google Chirp 3 HD** | $30 por millón de caracteres, **primer millón al mes gratis** | $0.0135 (en la práctica **$0**) | Mejor relación calidad/precio; muy buena en español latino |
| ElevenLabs Flash      | $0.05 por 1.000 caracteres                                    | $0.0225                         | La más natural del mercado                                 |
| Azure / OpenAI        | $15 por millón                                                | $0.0068                         | Buenas y baratas                                           |
| Deepgram Aura-2       | $0.03 por 1.000 caracteres                                    | $0.0135                         | 17 voces en español                                        |

Con 6 shorts diarios bilingües gastaríamos unos 165.000 caracteres al mes: **dentro del millón
gratis de Google**, o sea $0 en voz.

### Recomendación

**Empezar con JSON2Video (plan de $16.95 al mes)**: una llamada desde nuestro servidor devuelve el
MP4 con voz y subtítulos; las imágenes de fondo salen de Pexels (ya tenemos la llave) y la música de
Pixabay (gratis, sin atribución obligatoria). Sin servidores nuevos y sin salir de YaDominios Cloud.
Si más adelante el volumen crece, se migra a render propio (~$10/mes) que exige construir el flujo.

**Fuera por ahora: el video generado por IA.** El más barato (Veo 3.1 Lite, Luma) cuesta $0.15–$0.20
por clip, entre 3 y 4 veces nuestro tope de $0.05 por pieza. Si Richard lo quiere, hace falta su
autorización por escrito con el costo anotado.

**Ojo con dónde se renderiza:** el worker de YaDominios no puede armar video (128 MB de memoria y
5 minutos de CPU). Por eso el render vive fuera, en el servicio que se contrate.

### Qué haría falta de Richard

| Para qué              | Qué necesito                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Shorts automáticos    | Cuenta en JSON2Video (plan Hobby $16.95) y su llave de API                                                            |
| Voz propia (opcional) | Llave de Google Cloud Text-to-Speech (gratis hasta 1M de caracteres/mes)                                              |
| Publicar los shorts   | Auditoría de TikTok y de YouTube (tardan días); mientras tanto salen por Telegram y se descargan para subirlos a mano |

## 3. Orden sugerido

1. **Telegram** (media hora, gratis) — el robot avisa cada nota en el canal.
2. **Bluesky + Facebook/Instagram** — la mayor audiencia sin costo.
3. **Shorts con JSON2Video** — cuando Richard contrate la llave.
4. Mastodon, Threads, Tumblr, Pinterest — cuando haya tiempo.
5. X y LinkedIn — solo si Richard decide pagar / reautorizar a mano cada 60 días.
