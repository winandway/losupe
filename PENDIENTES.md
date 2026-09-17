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

- [ ] 👤 **DNS-AID: dos registros `SVCB` en la zona de losupe.com** (y DNSSEC si se puede). Es el
      único punto del escáner de agentes de IA que no se puede hacer desde el código. Se crean donde
      vive la zona (Cloudflare); el panel de YaDominios hoy solo crea A, CNAME, MX y TXT.

      Registro 1 — nombre: `_index._agents` · tipo: `SVCB` · valor:
              `1 losupe.com. alpn="h2,http/1.1" port=443`

              Registro 2 — nombre: `_mcp._agents` · tipo: `SVCB` · valor:
              `1 losupe.com. alpn="h2,http/1.1" port=443`

              Con eso, un agente que pregunte al DNS de losupe.com encuentra solo nuestro servidor MCP.
              Detalle: [`docs/agentes-ia.md`](docs/agentes-ia.md).

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
