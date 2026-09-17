# Pendientes de losupe.com

> 👤 = depende de Richard · 🤖 = lo hace la IA. La IA ejecuta los 🤖 en fila, sin esperar a que se
> los pidan, y recuerda los 👤 al final de cada respuesta hasta que estén hechos.

## 👤 Esperando por Richard

- [ ] 👤 **Verificar Search Console.** Pegar el código en la variable `GOOGLE_SITE_VERIFICATION`
      (YaDominios Cloud → sitio `losupe` → Variables de entorno). Sin esto se publica a ciegas: no se
      ve qué busca la gente ni se puede pedir que Google indexe una nota. Guía:
      [`docs/posicionamiento.md`](docs/posicionamiento.md).
- [ ] 👤 **Enlazar losupe.com desde mercatren.com, windoce.com y yadominios.com.** Es lo que más pesa
      para que Google confíe en un sitio nuevo, y lo único que no se puede programar.
- [ ] 👤 **Llaves de las redes sociales** (Telegram, Bluesky, Mastodon, Facebook). El código está listo
      desde el 29 ago 2026; con las llaves, cada nota se anuncia sola. Guía:
      [`docs/redes-sociales.md`](docs/redes-sociales.md).
- [ ] 👤 **Google Publisher Center.** Ya se puede: desde el 6 sep 2026 las notas se declaran como
      noticias.
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

- [x] 🤖 Vista previa de WhatsApp con la foto, no con el logo (17 sep 2026, candado 51).
- [x] 🤖 Guion para creadores y «¿Sabías qué?» en cada nota (17 sep 2026, candado 52).
- [x] 🤖 Auditoría SEO del código: un solo dominio, foto de portada rápida en celular, imagen y
      dirección propia al compartir, página 2 canónica, descripciones cortas (17 sep 2026, candado 53).
- [ ] 🤖 (bajo) Página 404 vacía desde el servidor: se pinta con JavaScript. Status 404 correcto.
- [ ] 🤖 (bajo) Contraste de las etiquetas de sección y tamaño táctil de los nombres de autor
      (accesibilidad). Proponer tonos a Richard con captura antes de tocar colores de marca.
- [x] 🤖 Servidor MCP público, tarjeta de descubrimiento y auth.md para asistentes de IA
      (17 sep 2026, candado 54).
