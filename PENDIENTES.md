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

## 🤖 Fila de la IA

- [x] 🤖 Indexación: el selector de idioma y los listados en inglés fabricaban redirecciones y copias con noindex (7 nov 2026, candado 58). Informe: [docs/INDEXACION-2026-11-07.md](docs/INDEXACION-2026-11-07.md).
- [x] 🤖 El diario publicaba dos notas al día: el latido de las visitas quemaba los intentos del turno
      y el reloj llegaba al turno agotado. Compuerta del latido + guardia larga en el reloj
      (10 nov 2026, candado 60).
- [x] 🤖 Google no veía ni un video: el `<video>` lo pintaba el navegador, no había `VideoObject` y el
      mapa del sitio no lo declaraba (10 nov 2026, candado 60).
- [ ] 🤖 **Revisar en Search Console (a partir del 17 nov) que los vídeos indexados pasen de 0** y que
      «vídeos descubiertos» en el mapa deje de ser cero.
- [ ] 🤖 **14 nov 2026: revisar Search Console** con la lista de la sección 4 del informe de indexación y anotar los números.
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
