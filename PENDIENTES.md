# Pendientes de losupe.com

> 👤 = depende de Richard · 🤖 = lo hace la IA. La IA ejecuta los 🤖 en fila, sin esperar a que se
> los pidan, y recuerda los 👤 al final de cada respuesta hasta que estén hechos.

## 🔴 Bloque nuevo: «Desde Windoce» (Richard, 7 nov 2026) 🤖

- [x] 🤖 Construir la sección de notas de nuestros productos con su aviso de contenido de la casa, la rotación diaria y la primera semana de notas para revisión. Todo el detalle y la regla en [docs/DESDE-WINDOCE.md](docs/DESDE-WINDOCE.md). Aprobado por Richard «con el aviso». Hecho el 7 nov 2026 (candado 57).
- [ ] 👤 **Revisar las siete notas de la primera semana** en el panel (Notas → Para revisar) y aprobar las que sirvan. Documento: [docs/DESDE-WINDOCE-SEMANA-1.md](docs/DESDE-WINDOCE-SEMANA-1.md). Sale una por día; tras cinco aprobadas el robot sigue solo.

## 👤 Esperando por Richard

- [x] 👤 **Search Console verificado** (propiedad de dominio, cuenta windoce1; confirmado el 7 nov 2026).
- [ ] 👤 **Enlazar losupe.com desde mercatren.com, windoce.com y yadominios.com.** Es lo que más pesa
      para que Google confíe en un sitio nuevo, y lo único que no se puede programar.
- [ ] 👤 **Llaves de las redes sociales** (Telegram, Bluesky, Mastodon, Facebook). El código está listo
      desde el 29 ago 2026; con las llaves, cada nota se anuncia sola. Guía:
      [`docs/redes-sociales.md`](docs/redes-sociales.md).
- [x] 👤 **Google Publisher Center.** Hecho el 7 nov 2026 por Gerencia con Richard: cuenta windoce1, publicación «losupe», Estados Unidos, español (Latinoamérica), logo cuadrado, dominio verificado. Mapas reenviados en Search Console el mismo día.
- [ ] 👤 **Bing Webmaster Tools** (variable `BING_SITE_VERIFICATION`). Alimenta Bing, DuckDuckGo y
      ChatGPT.

- [x] 👤 **DNS-AID: los dos registros `SVCB` ya están puestos** (17 sep 2026). Comprobado en los dos
      resolvedores que usa el escáner: `_index._agents.losupe.com` y `_mcp._agents.losupe.com`
      responden `1 losupe.com. alpn=h2,http/1.1 port=443`.
- [ ] 👤 **El DS de DNSSEC en el registrador.** La zona ya está FIRMADA (Cloudflare), pero el
      registrador (YaDominios) todavía no publica el `DS`, y sin él ningún resolvedor puede validar
      la firma — es lo único que el escáner sigue marcando en rojo del DNS. Se pega en
      YaDominios → Servicios → losupe.com → DNSSEC (si no aparece la sección, la habilita Soporte).

      Key tag: `2371` · Algoritmo: `13` (ECDSAP256SHA256) · Tipo de digest: `2` (SHA-256)
                                                                                              Digest: `674D6A1D62D32BFD81F8582CD4C69E958CD87E6D068B9A9F245D0D832CA78365`
                                                                                              En una sola línea: `losupe.com. IN DS 2371 13 2 674D6A1D62D32BFD81F8582CD4C69E958CD87E6D068B9A9F245D0D832CA78365`

                                                                                              Se comprueba con `dig +short DS losupe.com`: cuando devuelva esa línea, está listo (tarda
                                                                                              hasta unas horas). Detalle: [`docs/agentes-ia.md`](docs/agentes-ia.md).

## 🔴 Segmento de delivery (Richard, 25 nov 2026)

- [x] 🤖 Sección «Delivery y logística», nueve fuentes del sector, tres turnos al día, firma de Pedro
      Llerena con su LinkedIn y línea de transparencia automática (candado 61). Plan:
      [docs/DELIVERY.md](docs/DELIVERY.md).
- [x] 👤 La página de Divoox dice «próximamente» en Venezuela: la sesión de Divoox lo va a quitar
      porque ya abrieron (Richard, 25 nov 2026). Comprobado en vivo el 25 de noviembre a las 20:50:
      **la página todavía dice «Coming soon»**, el cambio no había llegado al sitio. No hace falta
      avisar a mano: la ficha vigila esa frase y, cuando desaparezca, queda marcada como vencida en
      `/__health` (candado 61 g).
- [x] 🤖 La ficha ya no obliga a decir lo contrario: el «cuidado» decía «no decir que ya opera» y el
      modelo escribía «todavía no opera». Ahora la etapa es un dato de la ficha y no se afirma en
      ninguna de las dos direcciones. Ficha releída el 25 de noviembre, con Flex bien contado
      (logística para empresas, no bloques tipo Amazon Flex). Candado 61 h.
- [ ] 🤖 **Cuando el canario marque una ficha como vencida** (por la frase o por cumplir 30 días):
      releer la página de ese producto y actualizar sus datos, su «cuidado» y la fecha de
      `verificado` en `src/lib/casa/productos.ts`. El canario avisa una semana antes en
      `fichasPorCaducar`. Las nueve fichas del 7 de noviembre caducan el **7 de diciembre**.
- [x] 🤖 El pie de la sección pasa de una ficha sola de Divoox al directorio del sector, con seis
      empresas y las mismas casillas (Richard, 25 nov 2026). Regla escrita en
      [docs/SEO-IMPARCIALIDAD.md](docs/SEO-IMPARCIALIDAD.md); candado 63.
- [x] 🤖 **El directorio se quitó entero el 26 de noviembre** y con él la etiqueta «De la casa»
      (Richard: «no necesitamos tener una ficha de cada una de ellas… me parece vanidoso»). Fuera de
      «Desde Windoce» ya no hay ninguna pieza fija que nombre un producto del grupo. Candado 64.
- [x] 🤖 El sector se abre: de doce empresas a veintiséis en la rotación, con los temas de los que
      sale noticia (lanzamientos, carros sin conductor, robots, drones, soporte por WhatsApp,
      recargas, seguros, huelgas y leyes) y tres fuentes nuevas comprobadas vivas (26 nov 2026).
- [ ] 👤 **Avisar cuando el soporte por WhatsApp de Divoox esté funcionando de verdad** (canal
      autorizado por Meta). Ese día: nota de lanzamiento en «Desde Windoce» y, aparte, el tema del
      sector «cómo dan soporte las apps de reparto por WhatsApp», donde Divoox es una más. Hasta
      que no esté vivo no se publica: un diario que anuncia lo que su dueño todavía no lanzó deja
      de ser un diario.
- [ ] 👤 **Lo mismo con «Reserva»** (recargar el saldo con un clic y pagarlo en la próxima recarga,
      para no quedarse sin carreras a mitad del turno). Richard dice que la directiva lo aprobó; en
      cuanto esté en la app se escribe. Tema del sector ya listo en la rotación: «cómo recarga su
      saldo un repartidor sin parar de trabajar».
- [ ] 🤖 Vigilar la primera semana del segmento: que salgan las tres al día y que ninguna se vaya a
      otra sección. **Medido el 25 de noviembre: salió UNA de tres** (trece notas en total ese día,
      el ritmo bien, el reparto mal). El canario ahora enseña `turnos` con los intentos y el motivo
      de cada turno (candado 62), así que mañana se ve sin deducir nada.
- [ ] 🤖 Mirar si el filtro de calidad rechaza de más en delivery: los dos rechazos de «copia
      fuentes» fueron del borrador en INGLÉS, y las fuentes del sector son revistas con mucha jerga.
      Si se confirma, se refuerza la instrucción del inglés — nunca se baja el filtro.

## 🤖 Fila de la IA

- [x] 🤖 Indexación: el selector de idioma y los listados en inglés fabricaban redirecciones y copias con noindex (7 nov 2026, candado 58). Informe: [docs/INDEXACION-2026-11-07.md](docs/INDEXACION-2026-11-07.md).
- [x] 🤖 El diario publicaba dos notas al día: el latido de las visitas quemaba los intentos del turno
      y el reloj llegaba al turno agotado. Compuerta del latido + guardia larga en el reloj
      (10 nov 2026, candado 60).
- [x] 🤖 Google no veía ni un video: el `<video>` lo pintaba el navegador, no había `VideoObject` y el
      mapa del sitio no lo declaraba (10 nov 2026, candado 60).
- [ ] 🤖 **Revisar en Search Console (a partir del 17 nov) que los vídeos indexados pasen de 0** y que
      «vídeos descubiertos» en el mapa deje de ser cero.
- [x] 🤖 **14 nov 2026: revisión de la sección 4 del informe de indexación, por fuera.** Las 631 direcciones del mapa dan 200 con su canónica y sin noindex; arreglado el mapa de videos, que daba la página como reproductor (candado 61). Números en la bitácora del informe.
- [ ] 🤖 **Anotar los números de Search Console de la sección 4** (indexadas, redirecciones, noindex, otra canónica, fecha del informe, Noticias) en cuanto Richard vuelva a entrar con windoce1. Juntarlo con la revisión de videos del 17 nov.
- [ ] 👤 **Volver a entrar a Google con la cuenta windoce1 en el Chrome de la oficina.** El 14 nov salía «saliste de la cuenta» y la otra cuenta no tiene acceso a Search Console de losupe.com. Sin eso no se pueden leer los números.
- [ ] 👤 **Decidir el tipo de notas:** Google rastrea y no guarda las efemérides («7 curiosidades a 100 años…») ni las guías genéricas. Recomendación: menos de esas y más noticias del día con fuente. Detalle en el informe de indexación, sección 3.
- [x] 🤖 Selector de idioma estilo Amazon (botón «🇪🇸 ES ▾», ventanita «Cambiar idioma», opciones con círculo). Hecho el 8 nov 2026 (candado 59).

- [x] 🤖 Vista previa de WhatsApp con la foto, no con el logo (17 sep 2026, candado 51).
- [x] 🤖 Guion para creadores y «¿Sabías qué?» en cada nota (17 sep 2026, candado 52).
- [x] 🤖 Auditoría SEO del código: un solo dominio, foto de portada rápida en celular, imagen y
      dirección propia al compartir, página 2 canónica, descripciones cortas (17 sep 2026, candado 53).
- [x] 🤖 Página 404 hecha desde el servidor, no pintada con JavaScript (8 nov 2026, candado 59).
- [x] 🤖 Contraste de las etiquetas de sección (Tecnología y Artistas no llegaban a 4,5:1) y tamaño
      táctil de los nombres de autor. Sin cambiar los colores de marca (8 nov 2026, candado 59).
- [x] 🤖 Servidor MCP público, tarjeta de descubrimiento y auth.md para asistentes de IA
      (17 sep 2026, candado 54).
- [x] 🤖 Tres noticias nuevas al día en Tecnología e IA y en Artistas y tendencias: fuentes vivas,
      escaleta de diez turnos y cupo que no se comen las efemérides (1 oct 2026, candado 55).
- [x] 🤖 Guion para creadores en dos medidas (1 y 2 minutos), con título para el video, sin
      Wikipedia y escrito para el oído (1 oct 2026, candado 55).
- [x] 🤖 Por qué las corridas «se cortaban»: el trabajo de fondo de una visita dura segundos y
      escribir una nota lleva minutos. La escaleta pasó a ser lista de pendientes y el reloj de
      GitHub se dispara a mano cuando hace falta (1 oct 2026, candado 55).
- [x] 🤖 Guiones que fallaban con «sin respuesta del modelo»: ahora dicen el motivo real, reintentan
      con espera un 503 y `/__health` cuenta los que quedan sin guion en 24 h (8 nov 2026, candado 59).
- [x] 🤖 Video dentro de la lectura, copiando lo bueno de los diarios grandes y tirando la basura
      (19 oct 2026, candado 56).
- [x] 🤖 Clasificación de sección: deporte fuera de Tecnología y finanzas a Economía aunque lleguen
      por otra fuente (8 nov 2026, candado 59).
